# ============================================================
# scripts/sync_daily.py
# Daily job: compute Poisson lambdas from standings, fetch
# real bookmaker odds (Bet365 / Pinnacle) via The Odds API,
# calculate probabilities, detect sanitized +EV, and update Supabase.
#
# Scheduled via GitHub Actions at 06:00 UTC daily.
# Uses football-data.org v4 and The Odds API v4.
# ============================================================

from __future__ import annotations

import re
import unicodedata
import time
from datetime import date, datetime, timedelta, timezone

import requests

from config import (
    BASE_URL,
    HEADERS,
    REQUEST_DELAY,
    ACTIVE_LEAGUES,
    HOME_ADVANTAGE,
    ODDS_API_KEY,
    ODDS_API_BASE,
    ODDS_SPORT_KEYS,
    supabase,
)
from engine import (
    calc_probabilities,
    compute_attack_defense_strength,
    compute_lambdas,
)


# ---- Team name matching for The Odds API --------------------

def normalize_name(name: str) -> str:
    """Normalize team name for fuzzy matching across data providers."""
    if not name:
        return ""
    # Strip diacritics and accents (e.g. Munchen, Atletico, Inter)
    s = unicodedata.normalize("NFKD", name).encode("ASCII", "ignore").decode("utf-8").lower()
    # Strip common football club prefixes / suffixes
    s = re.sub(r"\b(fc|cf|afc|ac|as|ssc|sc|vfb|bayer|bv|tsv|rb|1\.|cd|ud|rcd)\b", "", s)
    s = re.sub(r"[^\w\s]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def teams_match(name1: str, name2: str) -> bool:
    """Check if two team names refer to the same football club."""
    if not name1 or not name2:
        return False
    n1 = normalize_name(name1)
    n2 = normalize_name(name2)
    if not n1 or not n2:
        return False
    if n1 == n2:
        return True
    if len(n1) >= 4 and len(n2) >= 4:
        if n1 in n2 or n2 in n1:
            return True
    w1 = set(n1.split())
    w2 = set(n2.split())
    if w1 and w2 and (w1.issubset(w2) or w2.issubset(w1)):
        return True
    return False


# ---- The Odds API (v4) --------------------------------------

def fetch_real_odds(league_code: str) -> list[dict]:
    """
    Fetch live 1X2 market odds for a league from The Odds API.
    Returns list of odds events, or [] if unconfigured or error.
    """
    sport_key = ODDS_SPORT_KEYS.get(league_code)
    if not sport_key:
        return []

    if not ODDS_API_KEY:
        print(f"    [INFO] ODDS_API_KEY not configured. Skipping real odds fetch for {league_code}.")
        return []

    url = f"{ODDS_API_BASE}/{sport_key}/odds"
    params = {
        "apiKey":     ODDS_API_KEY,
        "regions":    "eu",
        "markets":    "h2h",
        "oddsFormat": "decimal",
    }
    try:
        resp = requests.get(url, params=params, timeout=15)
        if resp.status_code == 200:
            events = resp.json()
            remaining = resp.headers.get("x-requests-remaining")
            rem_str = f" ({remaining} requests remaining this month)" if remaining else ""
            print(f"    [The Odds API] Fetched {len(events)} events for {sport_key}{rem_str}")
            return events
        print(f"    [The Odds API Error] {sport_key}: HTTP {resp.status_code} - {resp.text}")
        return []
    except Exception as exc:
        print(f"    [The Odds API Error] Failed to fetch odds for {sport_key}: {exc}")
        return []


def extract_event_odds(event: dict) -> tuple[float | None, float | None, float | None]:
    """
    Extract 1X2 decimal odds from an Odds API event.
    Prefers 'bet365', falls back to 'pinnacle', then any available EU bookmaker.
    """
    bookmakers = event.get("bookmakers", [])
    if not bookmakers:
        return None, None, None

    selected_bm = None
    for target in ["bet365", "pinnacle"]:
        for bm in bookmakers:
            if bm.get("key") == target:
                selected_bm = bm
                break
        if selected_bm:
            break

    if not selected_bm:
        selected_bm = bookmakers[0]

    odds_home = None
    odds_draw = None
    odds_away = None
    event_home = event.get("home_team", "")
    event_away = event.get("away_team", "")

    for market in selected_bm.get("markets", []):
        if market.get("key") == "h2h":
            for outcome in market.get("outcomes", []):
                name = outcome.get("name", "")
                price = outcome.get("price")
                if price is not None:
                    try:
                        price_float = float(price)
                    except (ValueError, TypeError):
                        continue
                    if name == event_home or teams_match(name, event_home):
                        odds_home = price_float
                    elif name == event_away or teams_match(name, event_away):
                        odds_away = price_float
                    elif name.lower() == "draw":
                        odds_draw = price_float

    return odds_home, odds_draw, odds_away


def find_matching_odds(
    home_name: str,
    away_name: str,
    odds_events: list[dict],
) -> tuple[float | None, float | None, float | None, bool]:
    """
    Find matching Odds API event for given home and away team names.
    Returns (odds_home, odds_draw, odds_away, is_real_odds).
    """
    for event in odds_events:
        ev_home = event.get("home_team", "")
        ev_away = event.get("away_team", "")
        if teams_match(home_name, ev_home) and teams_match(away_name, ev_away):
            oh, od, oa = extract_event_odds(event)
            if oh or od or oa:
                return oh, od, oa, True

    return None, None, None, False


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
    Parse standings into per-team attack/defense strength ratios with Bayesian shrinkage.
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

        # compute_attack_defense_strength applies Bayesian shrinkage: (raw * games + 4) / (games + 4)
        attack, defense = compute_attack_defense_strength(
            gf, ga, played, league_avg_for, league_avg_against
        )
        strength_table[team_id] = {
            "attack":             attack,
            "defense":            defense,
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
        .select("id, league_id, home_team_id, away_team_id, home_team_name, away_team_name, match_date, status, odds_home, odds_draw, odds_away")
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
    For one competition:
      1. Fetch real market odds from The Odds API.
      2. Fetch standings and build strength table with shrinkage.
      3. Process fixtures: compute clamped lambdas, match real odds, and detect +EV.
    """
    code = league["code"]
    name = league["name"]
    lid  = league["id"]

    league_fixtures = [f for f in fixtures if f["league_id"] == lid]
    if not league_fixtures:
        return 0

    print(f"  [{name}] ({code}) {len(league_fixtures)} upcoming match(es).")

    # 1. Fetch real bookmaker odds for this competition
    odds_events = fetch_real_odds(code)

    # 2. Fetch standings
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
        home_name = fixture.get("home_team_name", "")
        away_name = fixture.get("away_team_name", "")

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

            # Compute lambdas with Dixon-Coles model (clamped strictly between 0.6 and 3.2)
            lambda_home, lambda_away = compute_lambdas(
                home_attack=home_str["attack"],
                home_defense=home_str["defense"],
                away_attack=away_str["attack"],
                away_defense=away_str["defense"],
                league_avg_for=safe_avg_goals,
                home_advantage=HOME_ADVANTAGE,
            )

            # Match real market odds from The Odds API
            real_h, real_d, real_a, has_real_odds = find_matching_odds(
                home_name, away_name, odds_events
            )

            # Run Poisson analytics
            if has_real_odds:
                analytics = calc_probabilities(
                    lambda_home, lambda_away,
                    real_h, real_d, real_a,
                )
                final_odds_home = round(min(999.0, max(1.01, float(real_h))), 2) if real_h else None
                final_odds_draw = round(min(999.0, max(1.01, float(real_d))), 2) if real_d else None
                final_odds_away = round(min(999.0, max(1.01, float(real_a))), 2) if real_a else None
                final_value_pick = analytics.value_pick
                final_ev_pct = analytics.ev_percentage
            else:
                # No real bookmaker odds available yet
                analytics = calc_probabilities(lambda_home, lambda_away)
                # Keep fair odds for display so UI shows numbers, but NEVER fabricate +EV
                fair_h = round(min(999.0, max(1.01, 100.0 / analytics.prob_home)), 2) if analytics.prob_home > 0 else None
                fair_d = round(min(999.0, max(1.01, 100.0 / analytics.prob_draw)), 2) if analytics.prob_draw > 0 else None
                fair_a = round(min(999.0, max(1.01, 100.0 / analytics.prob_away)), 2) if analytics.prob_away > 0 else None

                # Keep existing odds if present in DB, otherwise use model fair odds
                final_odds_home = fixture.get("odds_home") or fair_h
                final_odds_draw = fixture.get("odds_draw") or fair_d
                final_odds_away = fixture.get("odds_away") or fair_a
                final_value_pick = None
                final_ev_pct = None

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
                "value_pick":       final_value_pick,
                "ev_percentage":    round(min(999.0, max(-100.0, final_ev_pct)), 2) if final_ev_pct is not None else None,
                "updated_at":       datetime.now(timezone.utc).isoformat(),
            }

            supabase.table("fixtures").upsert(update_row, on_conflict="id").execute()
            odds_source = " [REAL ODDS]" if has_real_odds else " [FAIR ODDS]"
            pick_label = f" | +EV: {final_value_pick} +{final_ev_pct}%" if final_value_pick else ""
            print(f"    Fixture {fid} ({home_name} vs {away_name}): {lambda_home:.2f}/{lambda_away:.2f}{odds_source}{pick_label}")
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
