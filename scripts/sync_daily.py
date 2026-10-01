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

try:
    from scripts.config import (
        BASE_URL,
        HEADERS,
        ACTIVE_LEAGUES,
        ODDS_API_KEY,
        ODDS_API_KEYS,
        ODDS_API_BASE,
        ODDS_SPORT_KEYS,
        APP_BASE_URL,
        supabase,
        prune_stale_fixtures,
    )
    from scripts.engine import (
        calc_probabilities,
        calculate_lambdas,
    )
    from scripts.evaluator import (
        fetch_and_settle_completed_matches,
        evaluate_recent_settlement,
        compute_multi_market_analytics,
    )
    from scripts.telegram_notifier import (
        send_daily_sitrep,
    )
    from scripts.odds_client import odds_pool
except ImportError:
    from config import (
        BASE_URL,
        HEADERS,
        ACTIVE_LEAGUES,
        ODDS_API_KEY,
        ODDS_API_KEYS,
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
        compute_multi_market_analytics,
    )
    from telegram_notifier import (
        send_daily_sitrep,
    )
    from odds_client import odds_pool

LAST_QUOTA_REMAINING: int | None = None

# ---- Normalized Schema & Team Metadata Caching --------------

DEFAULT_LEAGUE_SHIELDS: dict[str, str] = {
    "PL": "https://crests.football-data.org/PL.png",
    "PD": "https://crests.football-data.org/PD.png",
    "SA": "https://crests.football-data.org/SA.png",
    "BL1": "https://crests.football-data.org/BL1.png",
    "FL1": "https://crests.football-data.org/FL1.png",
    "CL": "https://crests.football-data.org/CL.png",
}

CACHED_TEAM_IDS: set[int] = set()
MAX_PARLAY_ODDS: float = 250.00


def ensure_team_metadata(
    *args: Any,
    **kwargs: Any,
) -> int | None:
    """
    Ensure team exists in public.teams table.
    Upserts metadata: id, name, short_name, tla, crest_url, and competition_code.
    Guardrail: If crest_url is missing, fallback to local league shield placeholder.

    Supported calling patterns:
    1) ensure_team_metadata(supabase_client, team_dict, competition_code)
    2) ensure_team_metadata(team_id, team_name, crest_url, competition_code, supabase_client, tla=..., short_name=...)
    3) ensure_team_metadata(team_dict, competition_code, supabase_client)
    """
    supabase_client: Any = None
    team_id: int | None = None
    team_name: str | None = None
    crest_url: str | None = None
    competition_code: str = ""
    tla: str | None = None
    short_name: str | None = None

    if len(args) >= 1 and hasattr(args[0], "table"):
        supabase_client = args[0]
        team_data = args[1] if len(args) > 1 else kwargs.get("team")
        competition_code = args[2] if len(args) > 2 else kwargs.get("competition_code", "")
        if isinstance(team_data, dict):
            team_id = team_data.get("id")
            team_name = team_data.get("name")
            crest_url = team_data.get("crest") or team_data.get("crest_url")
            tla = team_data.get("tla")
            short_name = team_data.get("shortName") or team_data.get("short_name")
        else:
            team_id = team_data
            team_name = kwargs.get("team_name")
            crest_url = kwargs.get("crest_url")
    elif len(args) >= 1 and isinstance(args[0], dict):
        team_data = args[0]
        team_id = team_data.get("id")
        team_name = team_data.get("name")
        crest_url = team_data.get("crest") or team_data.get("crest_url")
        tla = team_data.get("tla")
        short_name = team_data.get("shortName") or team_data.get("short_name")
        competition_code = args[1] if len(args) > 1 else kwargs.get("competition_code", "")
        supabase_client = args[2] if len(args) > 2 else kwargs.get("supabase_client", kwargs.get("supabase"))
    else:
        team_id = args[0] if len(args) > 0 else kwargs.get("team_id")
        team_name = args[1] if len(args) > 1 else kwargs.get("team_name")
        crest_url = args[2] if len(args) > 2 else kwargs.get("crest_url")
        competition_code = args[3] if len(args) > 3 else kwargs.get("competition_code", "")
        supabase_client = args[4] if len(args) > 4 else kwargs.get("supabase_client", kwargs.get("supabase"))
        tla = kwargs.get("tla")
        short_name = kwargs.get("short_name")

    if not team_id or not team_name:
        return team_id

    if team_id in CACHED_TEAM_IDS:
        return team_id

    fallback_crest = DEFAULT_LEAGUE_SHIELDS.get(
        competition_code, "https://crests.football-data.org/PL.png"
    )
    final_crest = (crest_url or "").strip() or fallback_crest
    final_tla = tla or (team_name[:3].upper() if len(team_name) >= 3 else "TBD")
    final_short = short_name or team_name

    team_row = {
        "id": team_id,
        "name": team_name,
        "short_name": final_short,
        "tla": final_tla,
        "crest_url": final_crest,
        "competition_code": competition_code,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        if supabase_client:
            supabase_client.table("teams").upsert(team_row, on_conflict="id").execute()
            CACHED_TEAM_IDS.add(team_id)
    except Exception as exc:
        print(f"    [WARN] Failed to upsert team {team_id} ({team_name}): {exc}")

    return team_id


def settle_portfolio_positions(supabase_client: Any, max_odds: float = 250.00) -> int:
    """
    Settle pending user portfolio positions against completed fixtures.
    Enforces a strict max parlay odds cap (max_odds = 250.00) to prevent
    runaway ROI spikes from compounding invalid odds entries.
    """
    if not supabase_client:
        return 0

    try:
        res = (
            supabase_client.table("portfolio_positions")
            .select("*")
            .eq("status", "PENDING")
            .execute()
        )
        pending = res.data or []
        if not pending:
            return 0

        f_res = (
            supabase_client.table("fixtures")
            .select("id, status, home_score, away_score, match_date")
            .in_("status", ["FT", "FINISHED", "AET", "PEN"])
            .not_.is_("home_score", "null")
            .not_.is_("away_score", "null")
            .execute()
        )
        finished_map = {f["id"]: f for f in (f_res.data or [])}

        settled_count = 0
        now_iso = datetime.now(timezone.utc).isoformat()

        for pos in pending:
            fid = pos.get("fixture_id") or pos.get("fixtureId")
            f = finished_map.get(fid)
            if not f:
                continue

            try:
                h_score = int(f["home_score"])
                a_score = int(f["away_score"])
            except (ValueError, TypeError):
                continue

            total_goals = h_score + a_score
            sel = str(pos.get("selection") or pos.get("pick") or pos.get("selection_label") or "").upper()
            status = "LOST"

            if sel == "HOME" or (sel.startswith("HOME") and "AWAY" not in sel):
                if h_score > a_score:
                    status = "WON"
            elif sel == "DRAW" or "DRAW" in sel or sel == "X":
                if h_score == a_score:
                    status = "WON"
            elif sel == "AWAY" or (sel.startswith("AWAY") and "HOME" not in sel):
                if a_score > h_score:
                    status = "WON"
            elif "OVER" in sel:
                line = 1.5 if "1.5" in sel else 3.5 if "3.5" in sel else 2.5
                if total_goals > line:
                    status = "WON"
            elif "UNDER" in sel:
                line = 1.5 if "1.5" in sel else 3.5 if "3.5" in sel else 2.5
                if total_goals < line:
                    status = "WON"

            try:
                raw_odds = float(pos.get("odds", 1.0))
            except (ValueError, TypeError):
                raw_odds = 1.0

            capped_odds = min(max_odds, max(1.0, raw_odds))

            try:
                stake = float(pos.get("stake_amount") or pos.get("stake") or 0.0)
            except (ValueError, TypeError):
                stake = 0.0

            payout = round(stake * capped_odds, 2) if status == "WON" else 0.0

            try:
                supabase_client.table("portfolio_positions").update({
                    "status": status,
                    "payout": payout,
                    "capped_odds": capped_odds,
                    "settled_at": now_iso,
                }).eq("id", pos["id"]).execute()
                settled_count += 1
            except Exception as upd_err:
                print(f"    [WARN] Failed to settle portfolio position {pos.get('id')}: {upd_err}")

        if settled_count > 0:
            print(f"    Settled {settled_count} portfolio position(s) with max odds cap ({max_odds:.2f}).")
        return settled_count

    except Exception as exc:
        print(f"    [WARN] Exception while settling portfolio positions: {exc}")
        return 0


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
    # Fetch comprehensive multi-market odds (1X2, totals, spreads) for a league
    global LAST_QUOTA_REMAINING
    sport_key = ODDS_SPORT_KEYS.get(league_code)
    if not sport_key:
        return []

    if odds_pool.key_count == 0:
        print(f"    [INFO] No Odds API keys configured in pool. Skipping real odds fetch for {league_code}.")
        return []

    events = odds_pool.fetch_odds_events(
        sport_key,
        regions="eu",
        markets="h2h,totals,spreads",
        odds_format="decimal"
    )
    quota_sum = odds_pool.get_quota_summary()
    if quota_sum.get("total_remaining") is not None:
        LAST_QUOTA_REMAINING = quota_sum["total_remaining"]
    return events


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


def parse_multi_market_event_odds(event: dict) -> dict[str, Any]:
    """
    Parse comprehensive multi-market odds from an Odds API event.
    Extracts:
      - h2h: Primary and best decimal odds + no-vig consensus
      - totals: Over/Under odds for lines (1.5, 2.5, 3.5)
      - spreads: Asian Handicap odds for primary handicap lines
    """
    bookmakers = event.get("bookmakers", [])
    if not bookmakers:
        return {}

    event_home = event.get("home_team", "")
    event_away = event.get("away_team", "")

    pinnacle_bm = None
    bet365_bm = None
    for bm in bookmakers:
        if bm.get("key") == "pinnacle":
            pinnacle_bm = bm
        elif bm.get("key") == "bet365":
            bet365_bm = bm

    primary_bm = pinnacle_bm or bet365_bm or bookmakers[0]

    # --- 1. Parse H2H (1X2) ---
    best_home, best_draw, best_away = 0.0, 0.0, 0.0
    primary_home, primary_draw, primary_away = None, None, None

    for bm in bookmakers:
        for market in bm.get("markets", []):
            if market.get("key") == "h2h":
                h_p, d_p, a_p = None, None, None
                for out in market.get("outcomes", []):
                    name = out.get("name", "")
                    try:
                        price = float(out.get("price", 0))
                    except (ValueError, TypeError):
                        continue
                    if price <= 1.0:
                        continue
                    if name.lower() == "draw":
                        d_p = price
                        if price > best_draw:
                            best_draw = price
                    elif teams_match(name, event_home):
                        h_p = price
                        if price > best_home:
                            best_home = price
                    elif teams_match(name, event_away):
                        a_p = price
                        if price > best_away:
                            best_away = price

                if bm == primary_bm:
                    primary_home, primary_draw, primary_away = h_p, d_p, a_p

    h2h_home = primary_home or (best_home if best_home > 0 else None)
    h2h_draw = primary_draw or (best_draw if best_draw > 0 else None)
    h2h_away = primary_away or (best_away if best_away > 0 else None)

    # Compute no-vig consensus
    no_vig = None
    if h2h_home and h2h_draw and h2h_away and h2h_home > 1.0 and h2h_draw > 1.0 and h2h_away > 1.0:
        inv_h = 1.0 / h2h_home
        inv_d = 1.0 / h2h_draw
        inv_a = 1.0 / h2h_away
        overround = inv_h + inv_d + inv_a
        if overround > 0:
            p_h = round((inv_h / overround) * 100.0, 2)
            p_d = round((inv_d / overround) * 100.0, 2)
            p_a = round((inv_a / overround) * 100.0, 2)
            no_vig = {
                "home_prob": p_h,
                "draw_prob": p_d,
                "away_prob": p_a,
                "fair_odds_home": round(100.0 / p_h, 2) if p_h > 0 else None,
                "fair_odds_draw": round(100.0 / p_d, 2) if p_d > 0 else None,
                "fair_odds_away": round(100.0 / p_a, 2) if p_a > 0 else None,
            }

    h2h_data = {
        "home": h2h_home,
        "draw": h2h_draw,
        "away": h2h_away,
        "best_home": best_home if best_home > 0 else h2h_home,
        "best_draw": best_draw if best_draw > 0 else h2h_draw,
        "best_away": best_away if best_away > 0 else h2h_away,
        "no_vig": no_vig,
    }

    # --- 2. Parse Totals (Over / Under) ---
    totals_data: dict[str, dict[str, Any]] = {}
    ordered_bms = [primary_bm] + [b for b in bookmakers if b != primary_bm]

    for bm in ordered_bms:
        for market in bm.get("markets", []):
            if market.get("key") == "totals":
                by_point: dict[float, dict[str, float]] = {}
                for out in market.get("outcomes", []):
                    pt = out.get("point")
                    if pt is None:
                        continue
                    try:
                        pt_val = float(pt)
                        price = float(out.get("price", 0))
                    except (ValueError, TypeError):
                        continue
                    if price <= 1.0:
                        continue
                    name = out.get("name", "").lower()
                    if pt_val not in by_point:
                        by_point[pt_val] = {}
                    if name == "over":
                        by_point[pt_val]["over"] = price
                    elif name == "under":
                        by_point[pt_val]["under"] = price

                for pt_val, prices in by_point.items():
                    k = str(pt_val)
                    if k not in totals_data and "over" in prices and "under" in prices:
                        totals_data[k] = {
                            "point": pt_val,
                            "over": prices["over"],
                            "under": prices["under"],
                        }

    # --- 3. Parse Spreads (Asian Handicap) ---
    spreads_data: dict[str, dict[str, Any]] = {}

    for bm in ordered_bms:
        for market in bm.get("markets", []):
            if market.get("key") == "spreads":
                by_point: dict[float, dict[str, float]] = {}
                for out in market.get("outcomes", []):
                    pt = out.get("point")
                    if pt is None:
                        continue
                    try:
                        pt_val = float(pt)
                        price = float(out.get("price", 0))
                    except (ValueError, TypeError):
                        continue
                    if price <= 1.0:
                        continue
                    name = out.get("name", "")
                    if teams_match(name, event_home):
                        if pt_val not in by_point:
                            by_point[pt_val] = {}
                        by_point[pt_val]["home"] = price
                    elif teams_match(name, event_away):
                        home_line = -pt_val
                        if home_line not in by_point:
                            by_point[home_line] = {}
                        by_point[home_line]["away"] = price

                for line_val, prices in by_point.items():
                    k = f"+{line_val}" if line_val > 0 else f"{line_val}"
                    if k not in spreads_data and "home" in prices and "away" in prices:
                        spreads_data[k] = {
                            "line": line_val,
                            "home": prices["home"],
                            "away": prices["away"],
                        }

    return {
        "h2h": h2h_data,
        "totals": totals_data,
        "spreads": spreads_data,
    }


def find_matching_multi_market_odds(
    home_name: str,
    away_name: str,
    odds_events: list[dict],
) -> tuple[dict[str, Any] | None, bool]:
    # Locate comprehensive multi-market odds for a specific fixture
    for event in odds_events:
        ev_home = event.get("home_team", "")
        ev_away = event.get("away_team", "")
        if teams_match(home_name, ev_home) and teams_match(away_name, ev_away):
            parsed = parse_multi_market_event_odds(event)
            if parsed and parsed.get("h2h", {}).get("home"):
                return parsed, True
    return None, False

def find_matching_odds(
    home_name: str,
    away_name: str,
    odds_events: list[dict],
) -> tuple[float | None, float | None, float | None, bool]:
    # Locate odds for a specific fixture from fetched Odds API events
    parsed, ok = find_matching_multi_market_odds(home_name, away_name, odds_events)
    if ok and parsed:
        h2h = parsed.get("h2h", {})
        return h2h.get("home"), h2h.get("draw"), h2h.get("away"), True
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
        home_logo = fixture.get("home_team_logo") or fixture.get("home_crest")
        away_logo = fixture.get("away_team_logo") or fixture.get("away_crest")

        # Ingestion & Team Metadata Caching in public.teams
        ensure_team_metadata(home_id, home_name, home_logo, code, supabase)
        ensure_team_metadata(away_id, away_name, away_logo, code, supabase)

        try:
            home_stats = standings_map.get(f"{code}_{home_id}") or standings_map.get(home_id) or {}
            away_stats = standings_map.get(f"{code}_{away_id}") or standings_map.get(away_id) or {}

            # Calculate Poisson lambdas with Home/Away split stats and Bayesian shrinkage
            lambda_home, lambda_away = calculate_lambdas(home_stats, away_stats, averages)

            # Match comprehensive multi-market odds from The Odds API
            market_odds, has_real_odds = find_matching_multi_market_odds(
                home_name, away_name, odds_events
            )

            # Compute comprehensive multi-market analytics and EV
            multi_analytics = compute_multi_market_analytics(
                lambda_home, lambda_away, market_odds=market_odds
            )

            if has_real_odds and market_odds:
                h2h = market_odds.get("h2h", {})
                real_h = h2h.get("home")
                real_d = h2h.get("draw")
                real_a = h2h.get("away")
                final_odds_home = round(min(999.0, max(1.01, float(real_h))), 2) if real_h else None
                final_odds_draw = round(min(999.0, max(1.01, float(real_d))), 2) if real_d else None
                final_odds_away = round(min(999.0, max(1.01, float(real_a))), 2) if real_a else None
                final_value_pick = multi_analytics.get("value_pick")
                final_ev_pct = multi_analytics.get("ev_percentage")
            else:
                fair_h = round(min(999.0, max(1.01, 100.0 / multi_analytics["prob_home"])), 2) if multi_analytics["prob_home"] > 0 else None
                fair_d = round(min(999.0, max(1.01, 100.0 / multi_analytics["prob_draw"])), 2) if multi_analytics["prob_draw"] > 0 else None
                fair_a = round(min(999.0, max(1.01, 100.0 / multi_analytics["prob_away"])), 2) if multi_analytics["prob_away"] > 0 else None

                final_odds_home = fixture.get("odds_home") or fair_h
                final_odds_draw = fixture.get("odds_draw") or fair_d
                final_odds_away = fixture.get("odds_away") or fair_a
                final_value_pick = None
                final_ev_pct = None

            ev_opps = multi_analytics.get("ev_opportunities", [])

            # Build update payload with normalized schema columns & multi-market data
            prob_o25 = round(min(100.0, max(0.0, multi_analytics["prob_over_25"])), 2)
            prob_u25 = round(min(100.0, max(0.0, 100.0 - multi_analytics["prob_over_25"])), 2)
            prob_btts_val = round(min(100.0, max(0.0, multi_analytics["prob_btts"])), 2)

            best_ev = ev_opps[0] if ev_opps else (
                {
                    "market": "h2h",
                    "selection": final_value_pick,
                    "odds": (
                        final_odds_home if final_value_pick == "HOME"
                        else final_odds_draw if final_value_pick == "DRAW"
                        else final_odds_away
                    ),
                    "ev_percentage": final_ev_pct,
                    "model_prob": (
                        multi_analytics["prob_home"] if final_value_pick == "HOME"
                        else multi_analytics["prob_draw"] if final_value_pick == "DRAW"
                        else multi_analytics["prob_away"]
                    ),
                } if final_value_pick and final_ev_pct else None
            )

            update_row = {
                "id":                  fid,
                "home_team_id":        home_id,
                "away_team_id":        away_id,
                "home_xg":             lambda_home,
                "away_xg":             lambda_away,
                "lambda_home":         lambda_home,
                "lambda_away":         lambda_away,
                "prob_home":           round(min(100.0, max(0.0, multi_analytics["prob_home"])), 2),
                "prob_draw":           round(min(100.0, max(0.0, multi_analytics["prob_draw"])), 2),
                "prob_away":           round(min(100.0, max(0.0, multi_analytics["prob_away"])), 2),
                "predicted_score":     multi_analytics["predicted_score"],
                "prob_over_25":        prob_o25,
                "prob_under_25":       prob_u25,
                "prob_btts_yes":       prob_btts_val,
                "prob_btts":           prob_btts_val,
                "odds_home":           final_odds_home,
                "odds_draw":           final_odds_draw,
                "odds_away":           final_odds_away,
                "value_pick":          final_value_pick,
                "ev_percentage":       round(min(999.0, max(-100.0, final_ev_pct)), 2) if final_ev_pct is not None else None,
                "market_odds":         market_odds,
                "ev_opportunities":    ev_opps,
                "best_ev_opportunity": best_ev,
                "updated_at":          datetime.now(timezone.utc).isoformat(),
            }

            try:
                supabase.table("fixtures").upsert(update_row, on_conflict="id").execute()
            except Exception as upsert_err:
                err_str = str(upsert_err)
                base_keys = (
                    "id", "home_team_id", "away_team_id", "lambda_home", "lambda_away",
                    "prob_home", "prob_draw", "prob_away", "predicted_score",
                    "prob_over_25", "prob_btts", "odds_home", "odds_draw", "odds_away",
                    "value_pick", "ev_percentage", "market_odds", "ev_opportunities", "updated_at"
                )
                fallback_row = {k: v for k, v in update_row.items() if k in base_keys}
                try:
                    supabase.table("fixtures").upsert(fallback_row, on_conflict="id").execute()
                except Exception:
                    minimal_row = {
                        k: v for k, v in fallback_row.items()
                        if k not in ("market_odds", "ev_opportunities")
                    }
                    supabase.table("fixtures").upsert(minimal_row, on_conflict="id").execute()

            odds_source = " [REAL ODDS: MULTI-MARKET]" if has_real_odds else " [FAIR ODDS]"
            opp_count_str = f" | +EV opps: {len(ev_opps)}" if ev_opps else ""
            pick_label = f" | +EV: {final_value_pick} +{final_ev_pct}%" if final_value_pick else ""
            print(f"    Fixture {fid} ({home_name} vs {away_name}): {lambda_home:.2f}/{lambda_away:.2f}{odds_source}{pick_label}{opp_count_str}")
            updated += 1

            if ev_opps and ev_collector is not None:
                for opp in ev_opps:
                    ev_count += 1
                    ev_collector.append({
                        "fixture_id": fid,
                        "home_team": home_name,
                        "away_team": away_name,
                        "league_code": code,
                        "league_name": name,
                        "market": opp.get("market"),
                        "selection": opp.get("selection"),
                        "value_pick": opp.get("selection"),
                        "odds": opp.get("odds", 1.0),
                        "model_prob": opp.get("model_prob", 0.0),
                        "ev_percentage": opp.get("ev_percentage", 0.0),
                    })
            elif final_value_pick and ev_collector is not None:
                ev_count += 1
                pick_odds = (
                    final_odds_home if final_value_pick == "HOME"
                    else final_odds_draw if final_value_pick == "DRAW"
                    else final_odds_away
                )
                pick_prob = (
                    multi_analytics["prob_home"] if final_value_pick == "HOME"
                    else multi_analytics["prob_draw"] if final_value_pick == "DRAW"
                    else multi_analytics["prob_away"]
                )
                ev_collector.append({
                    "fixture_id": fid,
                    "home_team": home_name,
                    "away_team": away_name,
                    "league_code": code,
                    "league_name": name,
                    "market": "h2h",
                    "selection": final_value_pick,
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
    LAST_QUOTA_REMAINING: Any = "N/A"
    now_str = date.today().isoformat()
    print(f"Daily Odds & Analytics sync starting: {now_str} UTC")

    # 1. Settle recent completed matches and evaluate accuracy
    print("Settling recent completed matches from Football-Data.org...")
    fetch_and_settle_completed_matches(BASE_URL, HEADERS, supabase)

    # 1b. Settle user portfolio positions with strict odds cap (250.00)
    print("Settling user portfolio positions with max odds cap (250.00)...")
    settle_portfolio_positions(supabase, max_odds=MAX_PARLAY_ODDS)

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

    # Log Odds API Key Pool Quota Summary
    odds_pool.log_quota_summary()
    quota_sum = odds_pool.get_quota_summary()
    if quota_sum.get("total_remaining") is not None:
        LAST_QUOTA_REMAINING = quota_sum["total_remaining"]

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
