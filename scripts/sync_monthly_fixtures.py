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
    RAPIDAPI_BASE,
    RAPIDAPI_HEADERS,
    REQUEST_DELAY,
    SEASON,
    LEAGUES,
    supabase,
)


def fetch_fixtures_range(league_id: int, from_date: str, to_date: str) -> list[dict]:
    """Fetch fixtures from API-Football for a league within a date range."""
    url = f"{RAPIDAPI_BASE}/fixtures"
    params = {
        "league":  league_id,
        "season":  SEASON,
        "from":    from_date,
        "to":      to_date,
        "status":  "NS",           # Not Started only
        "timezone": "UTC",
    }
    resp = requests.get(url, headers=RAPIDAPI_HEADERS, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    return data.get("response", [])


def parse_fixture_row(f: dict) -> dict:
    """Extract and flatten the fields we need from a raw API-Football fixture."""
    fixture   = f["fixture"]
    league    = f["league"]
    teams     = f["teams"]

    return {
        "id":              fixture["id"],
        "league_id":       league["id"],
        "league_name":     league["name"],
        "league_logo":     league["logo"],
        "league_country":  league["country"],
        "season":          league["season"],
        "match_date":      fixture["date"],
        "status":          fixture["status"]["short"],
        "home_team_id":    teams["home"]["id"],
        "home_team_name":  teams["home"]["name"],
        "home_team_logo":  teams["home"]["logo"],
        "away_team_id":    teams["away"]["id"],
        "away_team_name":  teams["away"]["name"],
        "away_team_logo":  teams["away"]["logo"],
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

    for league_name, league_id in LEAGUES.items():
        print(f"  League: {league_name} (ID={league_id})")
        try:
            raw = fetch_fixtures_range(league_id, from_str, to_str)
            rows = [parse_fixture_row(f) for f in raw]
            upsert_fixtures(rows)
            total += len(rows)
        except requests.HTTPError as exc:
            print(f"    HTTP error for {league_name}: {exc}")
        except Exception as exc:
            print(f"    Unexpected error for {league_name}: {exc}")
        time.sleep(REQUEST_DELAY)

    print(f"\nDone. Total fixtures synced: {total}")


if __name__ == "__main__":
    main()
