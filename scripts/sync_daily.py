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


def build_strength_table(table_rows: list[dict]) -> tuple[dict[int, dict], float, float]:
    """
    Parse standings into per-team attack/defense strength ratios.
    Returns: (strength_table, league_avg_for, league_avg_against)
    """
    totals_for     = sum(t.get("goals_for", 0)     for t in table_rows)
    totals_against = sum(t.get("goals_against", 0) for t in table_rows)
    total_games    = sum(t.get("played", 0)        for t in table_rows)

    if total_games == 0 or totals_for == 0:
        league_avg_for     = 1.35
        league_avg_against = 1.35
    else:
        league_avg_for     = totals_for     / total_games
        league_avg_against = totals_against / total_games

    strength_table: dict[int, dict] = {}
    for team in table_rows:
        team_id = team.get("team_id")
        if not team_id:
            continue
        played  = team.get("played", 0)
        gf      = team.get("goals_for", 0)
        ga      = team.get("goals_against", 0)

        if played == 0:
            attack, defense = 1.0, 1.0
        else:
            attack, defense = compute_attack_defense_strength(
                gf, ga, played, league_avg_for, league_avg_against
            )
        strength_table[team_id] = {
            "attack":             max(0.1, attack),
            "defense":            max(0.1, defense),
            "league_avg_for":     league_avg_for,
            "league_avg_against": league_avg_against,
        }

    return strength_table, league_avg_for, league_avg_against


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
        print(f"    [INFO] No standings data available for {name}. Using baseline stats (1.0).")
        strength = {}
        league_avg_for = 1.35
        league_avg_against = 1.35
    else:
        strength, league_avg_for, league_avg_against = build_strength_table(table_rows)

    updated  = 0

    for fixture in league_fixtures:
        fid     = fixture["id"]
        home_id = fixture.get("home_team_id")
        away_id = fixture.get("away_team_id")

        try:
            # Fallback for Team Stats: if team not found or playedGames == 0, use baseline (1.0)
            home_str = strength.get(home_id) if home_id else None
            if not home_str or home_str.get("attack", 0) <= 0 or home_str.get("defense", 0) <= 0:
                home_str = {
                    "attack": 1.0,
                    "defense": 1.0,
                    "league_avg_for": league_avg_for,
                    "league_avg_against": league_avg_against,
                }

            away_str = strength.get(away_id) if away_id else None
            if not away_str or away_str.get("attack", 0) <= 0 or away_str.get("defense", 0) <= 0:
                away_str = {
                    "attack": 1.0,
                    "defense": 1.0,
                    "league_avg_for": league_avg_for,
                    "league_avg_against": league_avg_against,
                }

            # Safe floor for league average goals (avoid division by zero or 0 goals)
            safe_avg_goals = max(0.5, float(home_str.get("league_avg_for") or league_avg_for or 1.35))

            # Compute lambdas with Dixon-Coles model
            lambda_home, lambda_away = compute_lambdas(
                home_attack=home_str["attack"],
                home_defense=home_str["defense"],
                away_attack=away_str["attack"],
                away_defense=away_str["defense"],
                league_avg_for=safe_avg_goals,
                home_advantage=HOME_ADVANTAGE,
            )

            # Ensure safe floor for lambdas
            lambda_home = round(max(0.1, float(lambda_home)), 2)
            lambda_away = round(max(0.1, float(lambda_away)), 2)

            existing_odds_home = fixture.get("odds_home")
            existing_odds_draw = fixture.get("odds_draw")
            existing_odds_away = fixture.get("odds_away")

            # Run analytics
            analytics = calc_probabilities(
                lambda_home, lambda_away,
                existing_odds_home, existing_odds_draw, existing_odds_away,
            )

            # Clamp odds safely to NUMERIC(5, 2) [between 1.01 and 999.0]
            def _safe_odds(val: float | None, prob_pct: float) -> float | None:
                if val and val > 1.0:
                    return round(min(999.0, max(1.01, float(val))), 2)
                if prob_pct > 0:
                    return round(min(999.0, max(1.01, 100.0 / prob_pct)), 2)
                return None

            final_odds_home = _safe_odds(existing_odds_home, analytics.prob_home)
            final_odds_draw = _safe_odds(existing_odds_draw, analytics.prob_draw)
            final_odds_away = _safe_odds(existing_odds_away, analytics.prob_away)

            # Build update payload
            update_row = {
                "id":               fid,
                "lambda_home":      lambda_home,
                "lambda_away":      lambda_away,
                "prob_home":        round(min(100.0, max(0.0, analytics.prob_home)), 2),
                "prob_draw":        round(min(100.0, max(0.0, analytics.prob_draw)), 2),
                "prob_away":        round(min(100.0, max(0.0, analytics.prob_away)), 2),
                "predicted_score":  analytics.predicted_score,
                "prob_over_25":     round(min(100.0, max(0.0, analytics.prob_over_25)), 2),
                "prob_btts":        round(min(100.0, max(0.0, analytics.prob_btts)), 2),
                "odds_home":        final_odds_home,
                "odds_draw":        final_odds_draw,
                "odds_away":        final_odds_away,
                "value_pick":       analytics.value_pick,
                "ev_percentage":    round(min(999.0, max(-100.0, analytics.ev_percentage)), 2) if analytics.ev_percentage is not None else None,
                "updated_at":       datetime.now(timezone.utc).isoformat(),
            }

            supabase.table("fixtures").upsert(update_row, on_conflict="id").execute()
            pick_label = f" | VALUE: {analytics.value_pick} +{analytics.ev_percentage}% EV" if analytics.value_pick else ""
            print(f"    Fixture {fid}: lambda {lambda_home:.2f}/{lambda_away:.2f}{pick_label}")
            updated += 1

        except Exception as err:
            print(f"[WARN] Skipping fixture {fid}: {err}")
            continue

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
