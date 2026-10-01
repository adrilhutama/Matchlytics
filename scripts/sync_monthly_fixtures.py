# ============================================================
# scripts/sync_monthly_fixtures.py
# Pulls scheduled fixtures for the next 30 days from API-Football
# and upserts normalized fixture and team metadata to Supabase.
#
# Run manually or on a separate monthly workflow to conserve
# the 100 req/day free-tier quota.
# ============================================================

from __future__ import annotations

import time
from datetime import date, timedelta
from typing import Any

import requests

try:
    from scripts.config import (
        BASE_URL,
        HEADERS,
        REQUEST_DELAY,
        SEASON,
        ACTIVE_LEAGUES,
        supabase,
    )
    from scripts.sync_daily import ensure_team_metadata
    from scripts.football_data_pool import football_pool
except ModuleNotFoundError:
    from config import (
        BASE_URL,
        HEADERS,
        REQUEST_DELAY,
        SEASON,
        ACTIVE_LEAGUES,
        supabase,
    )
    from sync_daily import ensure_team_metadata
    from football_data_pool import football_pool


def fetch_fixtures_range(competition_code: str, from_date: str, to_date: str, pool: Any = None) -> list[dict]:
    """Fetch scheduled fixtures from football-data.org for a competition within a date range."""
    client = pool or football_pool
    url = f"{BASE_URL}/competitions/{competition_code}/matches"
    params = {
        "dateFrom": from_date,
        "dateTo":   to_date,
        "status":   "SCHEDULED",
    }
    resp = client.get(url, params=params, timeout=15)
    if resp.status_code != 200:
        error_msg = resp.text
        try:
            error_msg = resp.json().get("message", error_msg)
        except Exception:
            pass
        print(f"    [football-data.org Error] {competition_code}: {resp.status_code} - {error_msg}")
        return []

    data = resp.json()
    return data.get("matches", [])


def parse_fixture_row(m: dict, league: dict, comp_code: str | None = None) -> dict:
    """
    Extract and map fields from a football-data.org match object to Supabase fixture row.
    Adheres strictly to the normalized schema with only essential relational columns:
    id, competition_code, home_team_id, away_team_id, kickoff_time, status.
    """
    comp = m.get("competition", {})
    home = m.get("homeTeam", {})
    away = m.get("awayTeam", {})

    code = comp_code or league.get("code") or comp.get("code") or ""
    raw_status = m.get("status", "SCHEDULED")
    status = "NS" if raw_status in ("SCHEDULED", "TIMED") else raw_status
    utc_date = m.get("utcDate")

    # Strictly normalized payload matching new schema
    return {
        "id":               m["id"],
        "competition_code": code,
        "home_team_id":     home.get("id"),
        "away_team_id":     away.get("id"),
        "kickoff_time":     utc_date,
        "status":           status,
    }


def upsert_fixtures(rows: list[dict], supabase_client: Any = None) -> None:
    """Upsert a batch of fixture rows into Supabase with resilient schema fallback."""
    client = supabase_client or supabase
    if not rows or not client:
        return
    try:
        client.table("fixtures").upsert(rows, on_conflict="id").execute()
        print(f"    Upserted {len(rows)} fixture(s).")
    except Exception as exc:
        err_msg = str(exc)
        if "PGRST204" in err_msg or "Could not find the" in err_msg:
            import re
            m = re.search(r"Could not find the '([^']+)' column", err_msg)
            if m:
                missing_col = m.group(1)
                print(f"    [Schema Adaptation] Dropping missing column '{missing_col}' and retrying upsert...")
                stripped_rows = [{k: v for k, v in r.items() if k != missing_col} for r in rows]
                upsert_fixtures(stripped_rows, client)
                return
        print(f"    [WARN] Upsert fixtures error: {exc}")


def main() -> None:
    today    = date.today()
    from_str = today.strftime("%Y-%m-%d")
    to_str   = (today + timedelta(days=30)).strftime("%Y-%m-%d")

    print(f"Syncing fixtures from {from_str} to {to_str}...")
    total = 0

    for league in ACTIVE_LEAGUES:
        code = league["code"]
        name = league["name"]
        print(f"  Competition: {name} ({code}) [ID={league['id']}]")
        try:
            raw = fetch_fixtures_range(code, from_str, to_str)
            rows = []
            for m in raw:
                home_team = m.get("homeTeam", {})
                away_team = m.get("awayTeam", {})

                # Ingestion & team metadata caching in public.teams
                if home_team:
                    ensure_team_metadata(supabase, home_team, code)
                if away_team:
                    ensure_team_metadata(supabase, away_team, code)

                row = parse_fixture_row(m, league, code)
                if row:
                    rows.append(row)

            upsert_fixtures(rows, supabase)
            total += len(rows)
        except requests.HTTPError as exc:
            print(f"    HTTP error for {name}: {exc}")
        except Exception as exc:
            print(f"    Unexpected error for {name}: {exc}")
        time.sleep(REQUEST_DELAY)

    print(f"\nDone. Total fixtures synced: {total}")


if __name__ == "__main__":
    main()
