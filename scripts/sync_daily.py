# ============================================================
# scripts/sync_daily.py
# Daily job: compute Poisson lambdas from standings, fetch
# Bet365 odds, run analytics engine, update Supabase fixtures.
#
# Scheduled via GitHub Actions at 06:00 UTC daily.
# Designed to stay within the 100 req/day free-tier quota:
#   - 5 leagues * 1 standings req = 5 requests
#   - Up to ~15 fixtures/day * 1 odds req each = ~15 requests
#   - Total: ~20 requests/day (well within quota)
# ============================================================

from __future__ import annotations

import time
from datetime import date, datetime, timezone

import requests

from config import (
    API_HOST,
    BASE_URL,
    HEADERS,
    REQUEST_DELAY,
    SEASON,
    LEAGUES,
    BET365_BOOKMAKER_ID,
    HOME_ADVANTAGE,
    supabase,
)
from engine import (
    calc_probabilities,
    compute_attack_defense_strength,
    compute_lambdas,
)


# ---- Standings / strength computation ----------------------

def fetch_standings(league_id: int) -> list[dict]:
    """Fetch league standings from API-Football."""
    url    = f"{BASE_URL}/standings"
    params = {"league": league_id, "season": SEASON}
    resp   = requests.get(url, headers=HEADERS, params=params, timeout=15)
    resp.raise_for_status()
    data   = resp.json()
    errors = data.get("errors")
    if errors:
        print(f"    [API-Sports Error] Standings for league {league_id}: {errors}")
    try:
        return data["response"][0]["league"]["standings"][0]
    except (IndexError, KeyError):
        return []


def build_strength_table(standings: list[dict]) -> dict[int, dict]:
    """
    Parse standings into per-team attack/defense strength ratios.
    Returns: { team_id: { attack, defense, avg_goals_for, avg_goals_against } }
    """
    totals_for     = sum(t["all"]["goals"]["for"]     for t in standings)
    totals_against = sum(t["all"]["goals"]["against"] for t in standings)
    total_games    = sum(t["all"]["played"]            for t in standings)

    if total_games == 0:
        return {}

    league_avg_for     = totals_for     / total_games
    league_avg_against = totals_against / total_games

    strength_table: dict[int, dict] = {}
    for team in standings:
        team_id  = team["team"]["id"]
        played   = team["all"]["played"]
        gf       = team["all"]["goals"]["for"]
        ga       = team["all"]["goals"]["against"]

        attack, defense = compute_attack_defense_strength(
            gf, ga, played, league_avg_for, league_avg_against
        )
        strength_table[team_id] = {
            "attack":            attack,
            "defense":           defense,
            "league_avg_for":    league_avg_for,
            "league_avg_against": league_avg_against,
        }

    return strength_table


# ---- Odds fetching -----------------------------------------

def fetch_odds(fixture_id: int) -> tuple[float | None, float | None, float | None]:
    """
    Fetch Bet365 1X2 odds for a fixture.
    Returns (odds_home, odds_draw, odds_away) or (None, None, None) if unavailable.
    """
    url    = f"{BASE_URL}/odds"
    params = {
        "fixture":    fixture_id,
        "bookmaker":  BET365_BOOKMAKER_ID,
        "bet":        1,           # Bet ID 1 = "Match Winner" (1X2)
    }
    try:
        resp = requests.get(url, headers=HEADERS, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        errors = data.get("errors")
        if errors:
            print(f"    [API-Sports Error] Odds for fixture {fixture_id}: {errors}")

        bookmakers = data.get("response", [])
        if not bookmakers:
            return None, None, None

        bets = bookmakers[0]["bookmakers"][0]["bets"]
        for bet in bets:
            if bet["id"] == 1:
                values     = {v["value"]: float(v["odd"]) for v in bet["values"]}
                odds_home  = values.get("Home")
                odds_draw  = values.get("Draw")
                odds_away  = values.get("Away")
                return odds_home, odds_draw, odds_away
    except Exception as exc:
        print(f"    Odds fetch failed for fixture {fixture_id}: {exc}")

    return None, None, None


# ---- Today's fixtures from Supabase ------------------------

def load_todays_fixtures() -> list[dict]:
    """Load today's not-started fixtures from Supabase."""
    today_utc = date.today().isoformat()
    resp = (
        supabase
        .table("fixtures")
        .select("id, league_id, home_team_id, away_team_id, match_date, status")
        .gte("match_date", f"{today_utc}T00:00:00+00:00")
        .lte("match_date", f"{today_utc}T23:59:59+00:00")
        .eq("status", "NS")
        .execute()
    )
    return resp.data or []


# ---- Main sync logic ----------------------------------------

def sync_league(league_name: str, league_id: int, todays_fixtures: list[dict]) -> int:
    """
    For one league: fetch standings, build strength table, then process
    each of today's fixtures in that league.
    Returns count of fixtures updated.
    """
    league_fixtures = [f for f in todays_fixtures if f["league_id"] == league_id]
    if not league_fixtures:
        return 0

    print(f"  [{league_name}] {len(league_fixtures)} match(es) today.")

    print(f"    Fetching standings...")
    standings = fetch_standings(league_id)
    time.sleep(REQUEST_DELAY)

    if not standings:
        print(f"    No standings data available. Skipping.")
        return 0

    strength = build_strength_table(standings)
    updated  = 0

    for fixture in league_fixtures:
        fid      = fixture["id"]
        home_id  = fixture["home_team_id"]
        away_id  = fixture["away_team_id"]

        home_str = strength.get(home_id)
        away_str = strength.get(away_id)

        if not home_str or not away_str:
            print(f"    Fixture {fid}: missing strength data, skipping.")
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

        # Fetch Bet365 odds
        print(f"    Fixture {fid}: fetching odds...")
        odds_home, odds_draw, odds_away = fetch_odds(fid)
        time.sleep(REQUEST_DELAY)

        # Run analytics
        analytics = calc_probabilities(
            lambda_home, lambda_away,
            odds_home, odds_draw, odds_away,
        )

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
            "odds_home":        odds_home,
            "odds_draw":        odds_draw,
            "odds_away":        odds_away,
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

    todays_fixtures = load_todays_fixtures()
    print(f"Fixtures today (all leagues): {len(todays_fixtures)}")

    if not todays_fixtures:
        print("No fixtures found for today. Run sync_monthly_fixtures.py first.")
        return

    total_updated = 0
    for league_name, league_id in LEAGUES.items():
        total_updated += sync_league(league_name, league_id, todays_fixtures)
        time.sleep(2)

    print(f"\nDone. Total fixtures updated: {total_updated}")


if __name__ == "__main__":
    main()
