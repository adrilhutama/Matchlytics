# ============================================================
# scripts/sync_daily.py
# Decoupled Daily Odds & Quant Analytics Sync:
# - Loads normalized Home/Away standings from Supabase
# - Computes split Poisson lambdas using calculate_lambdas()
# - Ingests real market odds (Bet365 / Pinnacle) via The Odds API
# - Detects sanitized +EV edges with strict risk guardrails
# - Settles completed matches and tracks Brier calibration
# - Dispatches daily Telegram SITREP and exports GitHub Step Summary
#
# Runs at 06:00 UTC and 14:00 UTC via GitHub Actions.
# ============================================================

from __future__ import annotations

import os
import re
import unicodedata
import time
from datetime import date, datetime, timedelta, timezone

import requests

from config import (
    BASE_URL,
    HEADERS,
    ACTIVE_LEAGUES,
    ODDS_API_KEY,
    ODDS_API_BASE,
    ODDS_SPORT_KEYS,
    APP_BASE_URL,
    supabase,
    prune_stale_fixtures,
)
from engine import (
    calc_probabilities,
    calculate_lambdas,
)
from evaluator import (
    fetch_and_settle_completed_matches,
    evaluate_recent_settlement,
)
from telegram_notifier import (
    send_daily_sitrep,
)

LAST_QUOTA_REMAINING: int | None = None


# ---- Team name matching for The Odds API --------------------

def normalize_name(name: str) -> str:
    # Normalize team name for fuzzy matching across data providers
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
    # Check if two team names refer to the same football club
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
    # Fetch live 1X2 market odds for a league from The Odds API
    global LAST_QUOTA_REMAINING
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
            if remaining is not None:
                try:
                    LAST_QUOTA_REMAINING = int(remaining)
                except ValueError:
                    pass
            rem_str = f" ({remaining} requests remaining this month)" if remaining else ""
            print(f"    [The Odds API] Fetched {len(events)} events for {sport_key}{rem_str}")
            return events
        print(f"    [The Odds API Error] {sport_key}: HTTP {resp.status_code} - {resp.text[:120]}")
        return []
    except Exception as exc:
        print(f"    [The Odds API Error] Failed to fetch odds for {sport_key}: {exc}")
        return []


def extract_event_odds(event: dict) -> tuple[float | None, float | None, float | None]:
    # Extract 1X2 decimal odds from an Odds API event
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
                outcome_name = outcome.get("name", "")
                price = outcome.get("price")
                if not price or float(price) <= 1.0:
                    continue

                if outcome_name.lower() == "draw":
                    odds_draw = float(price)
                elif teams_match(outcome_name, event_home):
                    odds_home = float(price)
                elif teams_match(outcome_name, event_away):
                    odds_away = float(price)

    return odds_home, odds_draw, odds_away


def find_matching_odds(
    home_name: str,
    away_name: str,
    odds_events: list[dict],
) -> tuple[float | None, float | None, float | None, bool]:
    # Locate odds for a specific fixture from fetched Odds API events
    for event in odds_events:
        ev_home = event.get("home_team", "")
        ev_away = event.get("away_team", "")
        if teams_match(home_name, ev_home) and teams_match(away_name, ev_away):
            h, d, a = extract_event_odds(event)
            if h and d and a:
                return h, d, a, True
    return None, None, None, False


# ---- Standings & League Averages Loader ---------------------

def load_team_standings_and_averages() -> tuple[dict[Any, dict], dict[str, dict]]:
    # Load all normalized team standings from Supabase and compute league averages
    try:
        res = supabase.table("team_standings").select("*").execute()
        rows = res.data or []
    except Exception as exc:
        print(f"    [WARN] Failed to load team_standings from Supabase: {exc}")
        rows = []

    standings_map: dict[Any, dict] = {}
    league_totals: dict[str, dict] = {}

    for r in rows:
        code = r.get("league_code")
        tid = r.get("team_id")
        rec_id = r.get("id")

        if rec_id:
            standings_map[rec_id] = r
        if tid:
            standings_map[tid] = r
            if code:
                standings_map[f"{code}_{tid}"] = r

        if code:
            if code not in league_totals:
                league_totals[code] = {
                    "home_goals_for": 0,
                    "home_played": 0,
                    "away_goals_for": 0,
                    "away_played": 0,
                }
            league_totals[code]["home_goals_for"] += r.get("home_goals_for", 0)
            league_totals[code]["home_played"] += r.get("home_played", 0)
            league_totals[code]["away_goals_for"] += r.get("away_goals_for", 0)
            league_totals[code]["away_played"] += r.get("away_played", 0)

    league_averages: dict[str, dict] = {}
    for code, totals in league_totals.items():
        h_games = totals["home_played"]
        a_games = totals["away_played"]
        h_avg = (totals["home_goals_for"] / h_games) if h_games > 0 else 1.50
        a_avg = (totals["away_goals_for"] / a_games) if a_games > 0 else 1.20
        league_averages[code] = {
            "home_avg_goals_for": max(0.5, round(h_avg, 3)),
            "away_avg_goals_for": max(0.5, round(a_avg, 3)),
        }

    return standings_map, league_averages


# ---- Fixtures Loader ----------------------------------------

def load_upcoming_fixtures(days_ahead: int = 30) -> list[dict]:
    # Load unplayed fixtures from Supabase within the upcoming window
    now = datetime.now(timezone.utc)
    from_date = now.isoformat()
    to_date = (now + timedelta(days=days_ahead)).isoformat()

    try:
        res = (
            supabase.table("fixtures")
            .select("*")
            .gte("match_date", from_date)
            .lte("match_date", to_date)
            .eq("status", "NS")
            .order("match_date", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as exc:
        print(f"    [ERROR] Failed to load fixtures from Supabase: {exc}")
        return []


# ---- Single Competition Sync --------------------------------

def sync_competition(
    league: dict,
    fixtures: list[dict],
    standings_map: dict[Any, dict],
    league_averages: dict[str, dict],
    ev_collector: list[dict] | None = None,
) -> tuple[int, int]:
    # Process upcoming fixtures for one league using pre-loaded standings
    code = league["code"]
    name = league["name"]
    lid  = league["id"]

    league_fixtures = [f for f in fixtures if f["league_id"] == lid]
    if not league_fixtures:
        return 0, 0

    print(f"  [{name}] ({code}) {len(league_fixtures)} upcoming match(es).")

    # Fetch real bookmaker odds for this competition
    odds_events = fetch_real_odds(code)
    averages = league_averages.get(code, {"home_avg_goals_for": 1.50, "away_avg_goals_for": 1.20})

    updated = 0
    ev_count = 0

    for fixture in league_fixtures:
        fid       = fixture["id"]
        home_id   = fixture.get("home_team_id")
        away_id   = fixture.get("away_team_id")
        home_name = fixture.get("home_team_name", "")
        away_name = fixture.get("away_team_name", "")

        try:
            home_stats = standings_map.get(f"{code}_{home_id}") or standings_map.get(home_id) or {}
            away_stats = standings_map.get(f"{code}_{away_id}") or standings_map.get(away_id) or {}

            # Calculate Poisson lambdas with Home/Away split stats and Bayesian shrinkage
            lambda_home, lambda_away = calculate_lambdas(home_stats, away_stats, averages)

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
                analytics = calc_probabilities(lambda_home, lambda_away)
                fair_h = round(min(999.0, max(1.01, 100.0 / analytics.prob_home)), 2) if analytics.prob_home > 0 else None
                fair_d = round(min(999.0, max(1.01, 100.0 / analytics.prob_draw)), 2) if analytics.prob_draw > 0 else None
                fair_a = round(min(999.0, max(1.01, 100.0 / analytics.prob_away)), 2) if analytics.prob_away > 0 else None

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

            if final_value_pick and ev_collector is not None:
                ev_count += 1
                pick_odds = (
                    final_odds_home if final_value_pick == "HOME"
                    else final_odds_draw if final_value_pick == "DRAW"
                    else final_odds_away
                )
                pick_prob = (
                    analytics.prob_home if final_value_pick == "HOME"
                    else analytics.prob_draw if final_value_pick == "DRAW"
                    else analytics.prob_away
                )
                ev_collector.append({
                    "fixture_id": fid,
                    "home_team": home_name,
                    "away_team": away_name,
                    "league_code": code,
                    "league_name": name,
                    "value_pick": final_value_pick,
                    "odds": pick_odds or 1.0,
                    "model_prob": pick_prob or 0.0,
                    "ev_percentage": final_ev_pct or 0.0,
                })

        except Exception as err:
            print(f"    [WARN] Skipping fixture {fid}: {err}")
            continue

    return updated, ev_count


# ---- GitHub Step Summary Export -----------------------------

def write_github_step_summary(
    sync_stats: dict,
    settlement_stats: dict,
    top_ev_picks: list[dict],
    league_breakdown: list[dict],
    quota_remaining: int | None,
) -> None:
    # Write structured markdown to $GITHUB_STEP_SUMMARY if present
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return

    try:
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        quota_str = str(quota_remaining) if quota_remaining is not None else "Active"

        lines = [
            "# Matchlytics Daily Sync Summary",
            f"**Timestamp:** {now_str} | **Dashboard:** [{APP_BASE_URL}]({APP_BASE_URL})",
            "",
            "## Processing Overview",
            "| Metric | Value |",
            "| :--- | :--- |",
            f"| Upcoming Fixtures Analyzed | {sync_stats.get('total_fixtures', 0)} |",
            f"| Fixtures Updated in Database | {sync_stats.get('total_updated', 0)} |",
            f"| +EV Opportunities Found | {len(top_ev_picks)} |",
            f"| The Odds API Quota Remaining | {quota_str} |",
            "",
            "## League Breakdown",
            "| Competition | Code | Matches Processed | +EV Found |",
            "| :--- | :---: | :---: | :---: |",
        ]

        for lb in league_breakdown:
            lines.append(f"| {lb['name']} | `{lb['code']}` | {lb['updated']} | {lb['ev_count']} |")

        lines.extend([
            "",
            "## Top Value Edges (+EV)",
            "| Match | League | Pick | Odds | Model Prob | Expected Value |",
            "| :--- | :---: | :---: | :---: | :---: | :---: |",
        ])

        if top_ev_picks:
            for p in top_ev_picks[:8]:
                lines.append(
                    f"| {p['home_team']} vs {p['away_team']} | `{p['league_code']}` | "
                    f"**{p['value_pick']}** | `{p['odds']:.2f}` | `{p['model_prob']:.1f}%` | "
                    f"**+{p['ev_percentage']:.1f}%** |"
                )
        else:
            lines.append("| *No value bets meeting guardrails today* | - | - | - | - | - |")

        lines.extend([
            "",
            "## Model Calibration & Settlement (Recent 48h)",
            "| Settled Matches | +EV Bets Evaluated | Record (W - L) | Win Rate | Net ROI | Brier Score |",
            "| :---: | :---: | :---: | :---: | :---: | :---: |",
            f"| {settlement_stats.get('settled_count', 0)} | {settlement_stats.get('ev_bets_count', 0)} | "
            f"{settlement_stats.get('wins', 0)}W - {settlement_stats.get('losses', 0)}L | "
            f"{settlement_stats.get('win_rate', 0.0)}% | {settlement_stats.get('roi_pct', 0.0)}% | "
            f"`{settlement_stats.get('brier_score', 0.0)}` |",
            "",
            "> Note: Brier score ranges from 0.0 (perfect foresight) to 1.0. Benchmark 0.18-0.22 indicates high calibration.",
        ])

        with open(summary_path, "a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        print("    [GitHub Actions] Step summary exported successfully.")

    except Exception as exc:
        print(f"    [WARN] Failed to write GitHub step summary: {exc}")


# ---- Main Pipeline Orchestrator ------------------------------

def main() -> None:
    now_str = date.today().isoformat()
    print(f"Daily Odds & Analytics sync starting: {now_str} UTC")

    # 1. Settle recent completed matches and evaluate accuracy
    print("Settling recent completed matches from Football-Data.org...")
    fetch_and_settle_completed_matches(BASE_URL, HEADERS, supabase)

    print("Evaluating model accuracy & Brier calibration...")
    settlement_stats = evaluate_recent_settlement(supabase)
    print(
        f"Settlement: {settlement_stats.get('settled_count', 0)} matches | "
        f"Win Rate: {settlement_stats.get('win_rate', 0.0)}% | "
        f"ROI: {settlement_stats.get('roi_pct', 0.0)}% | "
        f"Brier: {settlement_stats.get('brier_score', 0.0)}"
    )

    # 2. Pre-load team standings & compute league averages from Supabase
    print("Loading normalized team standings and league averages from database...")
    standings_map, league_averages = load_team_standings_and_averages()
    print(f"Loaded {len(standings_map)} standings records across {len(league_averages)} league(s).")

    # 3. Load upcoming fixtures
    upcoming_fixtures = load_upcoming_fixtures(days_ahead=30)
    print(f"Upcoming fixtures (next 30 days, all competitions): {len(upcoming_fixtures)}")

    if not upcoming_fixtures:
        print("No upcoming fixtures found. Run sync_monthly_fixtures.py first.")
        return

    # 4. Synchronize competitions and collect +EV opportunities
    total_updated = 0
    all_ev_picks: list[dict] = []
    league_breakdown: list[dict] = []

    for league in ACTIVE_LEAGUES:
        updated, ev_count = sync_competition(
            league, upcoming_fixtures, standings_map, league_averages, all_ev_picks
        )
        total_updated += updated
        league_breakdown.append({
            "name": league["name"],
            "code": league["code"],
            "updated": updated,
            "ev_count": ev_count,
        })

    # Sort value picks descending by expected value
    all_ev_picks.sort(key=lambda x: x.get("ev_percentage", 0.0), reverse=True)
    print(f"\nDone. Total fixtures updated: {total_updated} | +EV found: {len(all_ev_picks)}")

    # 5. Database housekeeping: prune matches finished > 45 days ago
    print("Running database housekeeping (clean_stale_fixtures)...")
    pruned = prune_stale_fixtures()
    print(f"Stale fixtures pruned: {pruned}")

    # 6. Dispatch Telegram Daily SITREP
    sync_stats = {
        "total_fixtures": len(upcoming_fixtures),
        "total_updated": total_updated,
    }
    print("Dispatching Telegram Daily SITREP...")
    send_daily_sitrep(sync_stats, settlement_stats, all_ev_picks, LAST_QUOTA_REMAINING)

    # 7. Output GitHub Actions Markdown Summary
    write_github_step_summary(
        sync_stats,
        settlement_stats,
        all_ev_picks,
        league_breakdown,
        LAST_QUOTA_REMAINING,
    )


if __name__ == "__main__":
    main()
