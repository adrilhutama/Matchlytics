# ============================================================
# scripts/sync_monthly_fixtures.py
# Pulls scheduled fixtures for the next 30 days from API-Football
# and upserts fixture metadata to Supabase.
#
# Run manually or on a separate monthly workflow to conserve
# the 100 req/day free-tier quota.
# ============================================================

from __future__ import annotations

import time
from datetime import date, timedelta

import requests

from config import (
    BASE_URL,
    HEADERS,
    REQUEST_DELAY,
    SEASON,
    ACTIVE_LEAGUES,
    supabase,
)


def fetch_fixtures_range(competition_code: str, from_date: str, to_date: str) -> list[dict]:
    """Fetch scheduled fixtures from football-data.org for a competition within a date range."""
    url = f"{BASE_URL}/competitions/{competition_code}/matches"
    params = {
        "dateFrom": from_date,
        "dateTo":   to_date,
        "status":   "SCHEDULED",
    }
    resp = requests.get(url, headers=HEADERS, params=params, timeout=15)
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


def parse_fixture_row(m: dict, league: dict) -> dict:
    """Extract and map fields from a football-data.org match object to Supabase fixture row."""
    comp = m.get("competition", {})
    home = m.get("homeTeam", {})
    away = m.get("awayTeam", {})
    area = m.get("area", {})
    season_info = m.get("season", {})

    season_val = SEASON
    if season_info and season_info.get("startDate"):
        try:
            season_val = int(season_info["startDate"][:4])
        except (ValueError, TypeError):
            season_val = SEASON

    raw_status = m.get("status", "SCHEDULED")
    status = "NS" if raw_status in ("SCHEDULED", "TIMED") else raw_status

    return {
        "id":              m["id"],
        "league_id":       league.get("id") or comp.get("id"),
        "league_name":     league.get("name") or comp.get("name"),
        "league_logo":     comp.get("emblem") or "",
        "league_country":  area.get("name") or "",
        "season":          season_val,
        "match_date":      m.get("utcDate"),
        "status":          status,
        "home_team_id":    home.get("id"),
        "home_team_name":  home.get("name"),
        "home_team_logo":  home.get("crest"),
        "away_team_id":    away.get("id"),
        "away_team_name":  away.get("name"),
        "away_team_logo":  away.get("crest"),
    }


def upsert_fixtures(rows: list[dict]) -> None:
    """Upsert a batch of fixture rows into Supabase."""
    if not rows:
        return
    supabase.table("fixtures").upsert(rows, on_conflict="id").execute()
    print(f"    Upserted {len(rows)} fixture(s).")


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
            rows = [parse_fixture_row(m, league) for m in raw]
            upsert_fixtures(rows)
            total += len(rows)
        except requests.HTTPError as exc:
            print(f"    HTTP error for {name}: {exc}")
        except Exception as exc:
            print(f"    Unexpected error for {name}: {exc}")
        time.sleep(REQUEST_DELAY)

    print(f"\nDone. Total fixtures synced: {total}")


if __name__ == "__main__":
    main()
