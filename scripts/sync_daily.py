# ============================================================
# scripts/sync_daily.py
# Daily job: compute Poisson lambdas from standings, calculate
# probabilities, retain fair odds, and update Supabase fixtures.
#
# Scheduled via GitHub Actions at 06:00 UTC daily.
# Uses football-data.org v4 API with 6.5s delay between calls.
# ============================================================

from __future__ import annotations

import time
from datetime import date, datetime, timedelta, timezone

import requests

from config import (
    BASE_URL,
    HEADERS,
    REQUEST_DELAY,
    ACTIVE_LEAGUES,
    HOME_ADVANTAGE,
    supabase,
)
from engine import (
    calc_probabilities,
    compute_attack_defense_strength,
    compute_lambdas,
)


# ---- Standings / strength computation ----------------------

def fetch_standings(competition_code: str) -> list[dict]:
    """
    Fetch standings table from football-data.org.
    Safely handles regular leagues, UCL league phase, and UCL group stage tables.
    Returns: list of dicts with keys: { team_id, team_name, played, goals_for, goals_against }
    """
    url = f"{BASE_URL}/competitions/{competition_code}/standings"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            error_msg = resp.text
            try:
                error_msg = resp.json().get("message", error_msg)
            except Exception:
                pass
            print(f"    [football-data.org Error] Standings for {competition_code}: {resp.status_code} - {error_msg}")
            return []

        data = resp.json()
        standings_list = data.get("standings", [])
        if not standings_list:
            return []

        # Find TOTAL tables across all stages/groups (e.g. Regular Season, League Phase, or Group Stage).
        total_tables = [s for s in standings_list if s.get("type") == "TOTAL"]
        if not total_tables:
            total_tables = [standings_list[0]]

        table_rows: list[dict] = []
        for s in total_tables:
            for row in s.get("table", []):
                team = row.get("team", {})
                tid = team.get("id")
                if not tid:
                    continue
                table_rows.append({
                    "team_id":       tid,
                    "team_name":     team.get("name"),
                    "played":        row.get("playedGames", 0),
                    "goals_for":     row.get("goalsFor", 0),
                    "goals_against": row.get("goalsAgainst", 0),
                })
        return table_rows
    except Exception as exc:
        print(f"    Error fetching standings for {competition_code}: {exc}")
        return []


def build_strength_table(table_rows: list[dict]) -> dict[int, dict]:
    """
    Parse standings into per-team attack/defense strength ratios.
    Returns: { team_id: { attack, defense, league_avg_for, league_avg_against } }
    """
    totals_for     = sum(t["goals_for"]     for t in table_rows)
    totals_against = sum(t["goals_against"] for t in table_rows)
    total_games    = sum(t["played"]        for t in table_rows)

    if total_games == 0:
        return {}

    league_avg_for     = totals_for     / total_games
    league_avg_against = totals_against / total_games

    strength_table: dict[int, dict] = {}
    for team in table_rows:
        team_id = team["team_id"]
        played  = team["played"]
        gf      = team["goals_for"]
        ga      = team["goals_against"]

        attack, defense = compute_attack_defense_strength(
            gf, ga, played, league_avg_for, league_avg_against
        )
        strength_table[team_id] = {
            "attack":             attack,
            "defense":            defense,
            "league_avg_for":     league_avg_for,
            "league_avg_against": league_avg_against,
        }

    return strength_table


# ---- Upcoming fixtures from Supabase -----------------------

def load_upcoming_fixtures(days_ahead: int = 30) -> list[dict]:
    """Load upcoming not-started fixtures from Supabase within the next 30 days."""
    now_utc = datetime.now(timezone.utc)
    from_iso = now_utc.isoformat()
    to_iso = (now_utc + timedelta(days=days_ahead)).isoformat()
    resp = (
        supabase
        .table("fixtures")
        .select("id, league_id, home_team_id, away_team_id, match_date, status, odds_home, odds_draw, odds_away")
        .gte("match_date", from_iso)
        .lte("match_date", to_iso)
        .eq("status", "NS")
        .order("match_date", desc=False)
        .execute()
    )
    return resp.data or []


# Backward-compatibility alias
load_todays_fixtures = load_upcoming_fixtures


# ---- Main sync logic ----------------------------------------

def sync_competition(league: dict, fixtures: list[dict]) -> int:
    """
    For one competition: fetch standings, build strength table, then process
    each upcoming fixture in that competition.
    Returns count of fixtures updated.
    """
    code = league["code"]
    name = league["name"]
    lid  = league["id"]

    league_fixtures = [f for f in fixtures if f["league_id"] == lid]
    if not league_fixtures:
        return 0

    print(f"  [{name}] ({code}) {len(league_fixtures)} upcoming match(es).")
    print(f"    Fetching standings...")
    table_rows = fetch_standings(code)
    time.sleep(REQUEST_DELAY)

    if not table_rows:
        print(f"    No standings data available for {name}. Skipping.")
        return 0

    strength = build_strength_table(table_rows)
    updated  = 0

    for fixture in league_fixtures:
        fid     = fixture["id"]
        home_id = fixture["home_team_id"]
        away_id = fixture["away_team_id"]

        home_str = strength.get(home_id)
        away_str = strength.get(away_id)

        if not home_str or not away_str:
            print(f"    Fixture {fid}: missing strength data for teams ({home_id} vs {away_id}), skipping.")
            continue

        # Compute lambdas
        lambda_home, lambda_away = compute_lambdas(
            home_attack=home_str["attack"],
            home_defense=home_str["defense"],
            away_attack=away_str["attack"],
            away_defense=away_str["defense"],
            league_avg_for=home_str["league_avg_for"],
            home_advantage=HOME_ADVANTAGE,
        )

        existing_odds_home = fixture.get("odds_home")
        existing_odds_draw = fixture.get("odds_draw")
        existing_odds_away = fixture.get("odds_away")

        # Run analytics
        analytics = calc_probabilities(
            lambda_home, lambda_away,
            existing_odds_home, existing_odds_draw, existing_odds_away,
        )

        # Retain fair odds generated by the model if bookmaker odds are missing
        fair_odds_home = round(100.0 / analytics.prob_home, 2) if analytics.prob_home > 0 else None
        fair_odds_draw = round(100.0 / analytics.prob_draw, 2) if analytics.prob_draw > 0 else None
        fair_odds_away = round(100.0 / analytics.prob_away, 2) if analytics.prob_away > 0 else None

        final_odds_home = existing_odds_home or fair_odds_home
        final_odds_draw = existing_odds_draw or fair_odds_draw
        final_odds_away = existing_odds_away or fair_odds_away

        # Build update payload
        update_row = {
            "id":               fid,
            "lambda_home":      analytics.lambda_home,
            "lambda_away":      analytics.lambda_away,
            "prob_home":        analytics.prob_home,
            "prob_draw":        analytics.prob_draw,
            "prob_away":        analytics.prob_away,
            "predicted_score":  analytics.predicted_score,
            "prob_over_25":     analytics.prob_over_25,
            "prob_btts":        analytics.prob_btts,
            "odds_home":        final_odds_home,
            "odds_draw":        final_odds_draw,
            "odds_away":        final_odds_away,
            "value_pick":       analytics.value_pick,
            "ev_percentage":    analytics.ev_percentage,
            "updated_at":       datetime.now(timezone.utc).isoformat(),
        }

        supabase.table("fixtures").upsert(update_row, on_conflict="id").execute()
        pick_label = f" | VALUE: {analytics.value_pick} +{analytics.ev_percentage}% EV" if analytics.value_pick else ""
        print(f"    Fixture {fid}: lambda {lambda_home:.2f}/{lambda_away:.2f}{pick_label}")
        updated += 1

    return updated


def main() -> None:
    print(f"Daily sync starting — {date.today().isoformat()} UTC")

    upcoming_fixtures = load_upcoming_fixtures(days_ahead=30)
    print(f"Upcoming fixtures (next 30 days, all competitions): {len(upcoming_fixtures)}")

    if not upcoming_fixtures:
        print("No upcoming fixtures found. Run sync_monthly_fixtures.py first.")
        return

    total_updated = 0
    for league in ACTIVE_LEAGUES:
        total_updated += sync_competition(league, upcoming_fixtures)
        time.sleep(REQUEST_DELAY)

    print(f"\nDone. Total fixtures updated: {total_updated}")


if __name__ == "__main__":
    main()
