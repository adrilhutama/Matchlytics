# ============================================================
# scripts/evaluator.py
# Model settlement, accuracy tracking, and Brier calibration engine.
#
# Computes multi-class Brier score for 1X2 probabilities,
# tracks win rates & ROI on +EV value selections, and updates
# finished match scores from official data providers.
# ============================================================

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

import requests

try:
    from scripts.football_data_pool import football_pool
except ImportError:
    try:
        from football_data_pool import football_pool
    except ImportError:
        football_pool = None



def calculate_brier_score(prob_home: float, prob_draw: float, prob_away: float, actual_outcome: str) -> float:
    """
    Compute multi-class Brier score for a three-way outcome (Home, Draw, Away).
    Brier = (p_h - y_h)^2 + (p_d - y_d)^2 + (p_a - y_a)^2
    """
    # Convert percentages to decimals
    ph = max(0.0, min(1.0, float(prob_home) / 100.0 if prob_home > 1.0 else float(prob_home)))
    pd = max(0.0, min(1.0, float(prob_draw) / 100.0 if prob_draw > 1.0 else float(prob_draw)))
    pa = max(0.0, min(1.0, float(prob_away) / 100.0 if prob_away > 1.0 else float(prob_away)))

    yh = 1.0 if actual_outcome == "HOME" else 0.0
    yd = 1.0 if actual_outcome == "DRAW" else 0.0
    ya = 1.0 if actual_outcome == "AWAY" else 0.0

    return (ph - yh) ** 2 + (pd - yd) ** 2 + (pa - ya) ** 2


def fetch_and_settle_completed_matches(
    base_url: str,
    headers: dict,
    supabase: Any,
    pool: Any = None,
    competitions: str | list[str] = "PL,PD,SA,BL1,FL1,CL",
) -> int:
    """
    Query football-data.org for fixtures finished in the last 48 hours across active competitions,
    and update their final scores and status in Supabase.
    """
    try:
        today = date.today()
        from_str = (today - timedelta(days=2)).strftime("%Y-%m-%d")
        to_str = today.strftime("%Y-%m-%d")
        comp_str = ",".join(competitions) if isinstance(competitions, list) else str(competitions)

        url = f"{base_url}/matches"
        params = {
            "competitions": comp_str,
            "dateFrom": from_str,
            "dateTo": to_str,
            "status": "FINISHED",
        }

        client = pool or football_pool
        if client and hasattr(client, "get"):
            resp = client.get(url, headers=headers, params=params, timeout=12)
        else:
            resp = requests.get(url, headers=headers, params=params, timeout=12)
        if resp.status_code != 200:
            print(f"    [WARN] Settlement fetch status {resp.status_code}: {resp.text[:120]}")
            return 0

        matches = resp.json().get("matches", [])
        settled_count = 0

        for m in matches:
            mid = m.get("id")
            score_data = m.get("score", {}).get("fullTime", {})
            h_score = score_data.get("home")
            a_score = score_data.get("away")

            if mid and h_score is not None and a_score is not None:
                try:
                    # Update fixture record in Supabase
                    update_payload = {
                        "status": "FT",
                        "actual_home_score": int(h_score),
                        "actual_away_score": int(a_score),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                    try:
                        supabase.table("fixtures").update(update_payload).eq("id", mid).execute()
                    except Exception:
                        legacy_payload = {
                            "status": "FT",
                            "home_score": int(h_score),
                            "away_score": int(a_score),
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }
                        supabase.table("fixtures").update(legacy_payload).eq("id", mid).execute()
                    settled_count += 1
                except Exception as inner_err:
                    print(f"    [WARN] Failed to settle fixture {mid}: {inner_err}")

        print(f"    Settled {settled_count} recent finished match(es).")
        return settled_count

    except Exception as exc:
        print(f"    [WARN] Exception while settling recent completed matches: {exc}")
        return 0


def evaluate_full_history(supabase: Any) -> dict:
    """
    Query Supabase for ALL finished fixtures (no date window).
    Returns full backtest stats plus a chronological equity-curve series
    suitable for the frontend Track Record dashboard.

    Returned keys:
        stats    : total_bets, wins, losses, win_rate, roi_pct, brier_score
        bets     : list of per-match result rows (chronological ASC)
        equity   : running-equity points for flat staking (bankroll=100)
        equity_k : running-equity points for quarter-Kelly (stake=2.5%)
    """
    defaults = {
        "stats": {"total_bets": 0, "wins": 0, "losses": 0,
                  "win_rate": 0.0, "roi_pct": 0.0, "brier_score": None},
        "bets": [],
        "equity": [],
        "equity_k": [],
    }

    try:
        try:
            res = (
                supabase.table("fixtures")
                .select("*")
                .in_("status", ["FT", "FINISHED", "AET", "PEN"])
                .not_.is_("actual_home_score", "null")
                .not_.is_("actual_away_score", "null")
                .order("kickoff_time", ascending=True)
                .execute()
            )
        except Exception:
            return defaults

        rows = res.data or []
        if not rows:
            return defaults

        brier_sum = 0.0
        brier_n = 0
        ev_bets_count = 0
        wins = 0
        losses = 0
        net_units = 0.0

        flat_bankroll = 100.0
        kelly_bankroll = 100.0
        kelly_stake_pct = 2.5

        bets = []
        equity_curve = []
        equity_curve_k = []

        for r in rows:
            h_val = r.get("actual_home_score") if r.get("actual_home_score") is not None else r.get("home_score")
            a_val = r.get("actual_away_score") if r.get("actual_away_score") is not None else r.get("away_score")
            if h_val is None or a_val is None:
                continue
            h_score = int(h_val)
            a_score = int(a_val)

            if h_score > a_score:
                actual_outcome = "HOME"
            elif h_score == a_score:
                actual_outcome = "DRAW"
            else:
                actual_outcome = "AWAY"

            # Brier score (probabilities stored as percentages)
            ph = r.get("prob_home")
            pd = r.get("prob_draw")
            pa = r.get("prob_away")
            if ph is not None and pd is not None and pa is not None:
                brier_val = calculate_brier_score(ph, pd, pa, actual_outcome)
                brier_sum += brier_val
                brier_n += 1

            # +EV track record
            val_pick = r.get("value_pick")
            if val_pick in ("HOME", "DRAW", "AWAY"):
                # Extract odds from best_ev_opportunity or fair_odds columns
                best_ev = r.get("best_ev_opportunity") or {}
                if val_pick == "HOME":
                    odds_val = best_ev.get("odds") or r.get("fair_odds_home")
                elif val_pick == "DRAW":
                    odds_val = best_ev.get("odds") or r.get("fair_odds_draw")
                else:
                    odds_val = best_ev.get("odds") or r.get("fair_odds_away")
                if odds_val is None:
                    odds_val = 1.0
                else:
                    try:
                        odds_val = float(odds_val)
                    except (ValueError, TypeError):
                        odds_val = 1.0

                if val_pick == actual_outcome:
                    wins += 1
                    profit = odds_val - 1.0
                    net_units += profit
                else:
                    losses += 1
                    net_units -= 1.0

                profit_flat = round(profit, 4) if val_pick == actual_outcome else -1.0
                profit_k = round(kelly_stake_pct / 100 * profit, 4) if val_pick == actual_outcome else round(-kelly_stake_pct / 100, 4)
            else:
                profit_flat = 0.0
                profit_k = 0.0

            flat_bankroll = round(flat_bankroll + profit_flat, 4)
            kelly_bankroll = round(kelly_bankroll + profit_k, 4)

            if val_pick in ("HOME", "DRAW", "AWAY"):
                home_t = r.get("home_team") or r.get("home_team_id") or "?"
                away_t = r.get("away_team") or r.get("away_team_id") or "?"
                league = r.get("competition_code") or "?"
                match_dt = r.get("kickoff_time") or ""
                bets.append({
                    "match_date": match_dt[:10] if match_dt else "",
                    "match_label": f"{home_t} vs {away_t}",
                    "league": league,
                    "selection": val_pick,
                    "odds": round(odds_val, 2),
                    "outcome": actual_outcome,
                    "result": "WIN" if val_pick == actual_outcome else "LOSS",
                    "flat_profit": profit_flat,
                    "kelly_profit": profit_k,
                })
                equity_curve.append({
                    "index": len(equity_curve),
                    "match_date": match_dt[:10] if match_dt else "",
                    "equity": flat_bankroll,
                })
                equity_curve_k.append({
                    "index": len(equity_curve_k),
                    "match_date": match_dt[:10] if match_dt else "",
                    "equity": kelly_bankroll,
                })

        avg_brier = round(brier_sum / brier_n, 3) if brier_n > 0 else None
        win_rate = round((wins / ev_bets_count) * 100, 1) if ev_bets_count > 0 else 0.0
        roi_pct = round((net_units / ev_bets_count) * 100, 1) if ev_bets_count > 0 else 0.0

        return {
            "stats": {
                "total_bets": ev_bets_count,
                "wins": wins,
                "losses": losses,
                "win_rate": win_rate,
                "roi_pct": roi_pct,
                "brier_score": avg_brier,
            },
            "bets": bets,
            "equity": equity_curve,
            "equity_k": equity_curve_k,
        }

    except Exception as exc:
        print(f"    [WARN] Exception evaluating full settlement history: {exc}")
        return defaults


def evaluate_recent_settlement(supabase: Any) -> dict:
    """
    Query Supabase for finished fixtures within the last 48 hours.
    Evaluates:
    - Brier score for probability calibration
    - Win rate and ROI for +EV selections
    """
    defaults = {
        "settled_count": 0,
        "ev_bets_count": 0,
        "wins": 0,
        "losses": 0,
        "win_rate": 0.0,
        "roi_pct": 0.0,
        "brier_score": 0.0,
    }

    try:
        two_days_ago = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        try:
            res = (
                supabase.table("fixtures")
                .select("*")
                .in_("status", ["FT", "FINISHED", "AET", "PEN"])
                .not_.is_("actual_home_score", "null")
                .not_.is_("actual_away_score", "null")
                .gte("kickoff_time", two_days_ago)
                .execute()
            )
        except Exception:
            return defaults

        rows = res.data or []
        if not rows:
            return defaults

        settled_count = len(rows)
        brier_sum = 0.0
        brier_n = 0

        ev_bets_count = 0
        wins = 0
        losses = 0
        net_units = 0.0

        for r in rows:
            h_val = r.get("actual_home_score") if r.get("actual_home_score") is not None else r.get("home_score")
            a_val = r.get("actual_away_score") if r.get("actual_away_score") is not None else r.get("away_score")
            if h_val is None or a_val is None:
                continue
            h_score = int(h_val)
            a_score = int(a_val)

            if h_score > a_score:
                actual_outcome = "HOME"
            elif h_score == a_score:
                actual_outcome = "DRAW"
            else:
                actual_outcome = "AWAY"

            # 1. Brier score calculation
            ph = r.get("prob_home")
            pd = r.get("prob_draw")
            pa = r.get("prob_away")
            if ph is not None and pd is not None and pa is not None:
                brier_val = calculate_brier_score(ph, pd, pa, actual_outcome)
                brier_sum += brier_val
                brier_n += 1

            # 2. +EV performance tracking
            val_pick = r.get("value_pick")
            if val_pick in ("HOME", "DRAW", "AWAY"):
                ev_bets_count += 1
                best_ev = r.get("best_ev_opportunity") or {}
                if val_pick == "HOME":
                    pick_odds = best_ev.get("odds") or r.get("fair_odds_home")
                elif val_pick == "DRAW":
                    pick_odds = best_ev.get("odds") or r.get("fair_odds_draw")
                else:
                    pick_odds = best_ev.get("odds") or r.get("fair_odds_away")
                odds_val = float(pick_odds) if pick_odds else 1.0

                if val_pick == actual_outcome:
                    wins += 1
                    profit = odds_val - 1.0
                    net_units += profit
                else:
                    losses += 1
                    net_units -= 1.0

        avg_brier = round(brier_sum / brier_n, 3) if brier_n > 0 else 0.0
        win_rate = round((wins / ev_bets_count) * 100, 1) if ev_bets_count > 0 else 0.0
        roi_pct = round((net_units / ev_bets_count) * 100, 1) if ev_bets_count > 0 else 0.0

        return {
            "settled_count": settled_count,
            "ev_bets_count": ev_bets_count,
            "wins": wins,
            "losses": losses,
            "win_rate": win_rate,
            "roi_pct": roi_pct,
            "brier_score": avg_brier,
        }

    except Exception as exc:
        print(f"    [WARN] Exception evaluating recent settlement: {exc}")
        return defaults




# ============================================================
# Multi-Market Poisson Analytics & EV Detection
# Evaluates Totals (Over/Under), Asian Handicap Spreads, and BTTS
# ============================================================

try:
    from scripts.engine import score_matrix, compute_ev, find_best_pick, MAX_GOALS
except ImportError:
    from engine import score_matrix, compute_ev, find_best_pick, MAX_GOALS
import numpy as np


def compute_totals_probabilities(
    matrix: np.ndarray,
    lines: tuple[float, ...] = (1.5, 2.5, 3.5),
) -> dict[str, dict[str, float]]:
    """
    Compute Over and Under probabilities for standard goal total lines
    from a (MAX_GOALS x MAX_GOALS) joint Poisson score probability matrix.
    Returns percentages (0.0 to 100.0).
    """
    max_goals = matrix.shape[0]
    results: dict[str, dict[str, float]] = {}
    for line in lines:
        over_prob = 0.0
        for i in range(max_goals):
            for j in range(max_goals):
                if (i + j) > line:
                    over_prob += float(matrix[i, j])
        under_prob = max(0.0, 1.0 - over_prob)
        results[str(line)] = {
            "over": round(over_prob * 100.0, 2),
            "under": round(under_prob * 100.0, 2),
        }
    return results


def compute_asian_handicap_probabilities(
    matrix: np.ndarray,
    lines: tuple[float, ...] = (-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5),
) -> dict[str, dict[str, float]]:
    """
    Compute Asian Handicap probabilities for primary handicap lines from home team perspective.
    Effective difference: (home_goals + line) - away_goals.
    - difference > 0: Home cover win
    - difference == 0: Push (stake refunded in 2-way Asian lines)
    - difference < 0: Away cover win
    Returns percentages (0.0 to 100.0).
    """
    max_goals = matrix.shape[0]
    results: dict[str, dict[str, float]] = {}
    for line in lines:
        p_home = 0.0
        p_away = 0.0
        p_push = 0.0
        for i in range(max_goals):
            for j in range(max_goals):
                diff = (i + line) - j
                val = float(matrix[i, j])
                if diff > 1e-6:
                    p_home += val
                elif diff < -1e-6:
                    p_away += val
                else:
                    p_push += val

        line_key = f"+{line}" if line > 0 else f"{line}"
        results[line_key] = {
            "home": round(p_home * 100.0, 2),
            "away": round(p_away * 100.0, 2),
            "push": round(p_push * 100.0, 2),
        }
    return results


def compute_btts_probabilities(matrix: np.ndarray) -> dict[str, float]:
    """
    Compute Both Teams To Score (BTTS) Yes and No probabilities.
    Returns percentages (0.0 to 100.0).
    """
    max_goals = matrix.shape[0]
    btts_yes = 0.0
    for i in range(1, max_goals):
        for j in range(1, max_goals):
            btts_yes += float(matrix[i, j])
    btts_no = max(0.0, 1.0 - btts_yes)
    return {
        "yes": round(btts_yes * 100.0, 2),
        "no": round(btts_no * 100.0, 2),
    }


def evaluate_market_ev(
    model_prob_pct: float,
    market_odds: float | None,
    push_prob_pct: float = 0.0,
    min_ev: float = 0.02,
    max_ev: float = 0.35,
    min_prob: float = 0.15,
    min_odds: float = 1.25,
    max_odds: float = 12.0,
) -> float | None:
    """
    Calculate Expected Value (EV%) for a market outcome with sanity guardrails:
      EV% = (model_prob * market_odds + push_prob * 1.0 - 1.0) * 100.0
    When push_prob is 0.0, this is the standard EV% = (model_prob * market_odds - 1.0) * 100.0.
    """
    if market_odds is None:
        return None
    try:
        odds = float(market_odds)
    except (ValueError, TypeError):
        return None

    if not (min_odds <= odds <= max_odds):
        return None

    prob = float(model_prob_pct) / 100.0
    push = float(push_prob_pct) / 100.0

    if prob < min_prob:
        return None

    ev = (prob * odds + push * 1.0) - 1.0
    if min_ev <= ev <= max_ev:
        return round(ev * 100.0, 2)
    return None


def evaluate_multi_market_ev(
    matrix: np.ndarray,
    market_odds: dict[str, Any] | None,
    min_ev: float = 0.02,
    max_ev: float = 0.35,
    min_prob: float = 0.15,
    min_odds: float = 1.25,
    max_odds: float = 12.0,
) -> list[dict[str, Any]]:
    """
    Evaluate +EV opportunities across 1X2 (H2H), Totals, and Spreads.
    Returns a sorted list of discovered value opportunities (descending by EV%).
    """
    if not market_odds or not isinstance(market_odds, dict):
        return []

    opportunities: list[dict[str, Any]] = []

    # 1. H2H (1X2)
    h2h = market_odds.get("h2h", {})
    max_goals = matrix.shape[0]
    total = float(np.sum(matrix))
    p_h = float(np.sum(np.tril(matrix, -1))) / total if total > 0 else 0.0
    p_d = float(np.sum(np.diag(matrix))) / total if total > 0 else 0.0
    p_a = float(np.sum(np.triu(matrix, 1))) / total if total > 0 else 0.0

    h2h_checks = [
        ("HOME", p_h * 100.0, h2h.get("best_home") or h2h.get("home")),
        ("DRAW", p_d * 100.0, h2h.get("best_draw") or h2h.get("draw")),
        ("AWAY", p_a * 100.0, h2h.get("best_away") or h2h.get("away")),
    ]
    for selection, prob_pct, odds in h2h_checks:
        ev_val = evaluate_market_ev(
            prob_pct, odds,
            min_ev=min_ev, max_ev=max_ev, min_prob=min_prob, min_odds=min_odds, max_odds=max_odds
        )
        if ev_val is not None:
            opportunities.append({
                "market": "h2h",
                "selection": selection,
                "line": None,
                "model_prob": round(prob_pct, 2),
                "odds": round(float(odds), 2),
                "ev_percentage": ev_val,
            })

    # 2. Totals (Over / Under)
    totals_odds = market_odds.get("totals", {})
    if totals_odds:
        totals_probs = compute_totals_probabilities(matrix, lines=(1.5, 2.5, 3.5))
        for line_str, t_odds in totals_odds.items():
            if line_str in totals_probs:
                p_over = totals_probs[line_str]["over"]
                p_under = totals_probs[line_str]["under"]
                odds_over = t_odds.get("over")
                odds_under = t_odds.get("under")

                ev_over = evaluate_market_ev(
                    p_over, odds_over,
                    min_ev=min_ev, max_ev=max_ev, min_prob=min_prob, min_odds=min_odds, max_odds=max_odds
                )
                if ev_over is not None:
                    opportunities.append({
                        "market": "totals",
                        "selection": f"Over {line_str}",
                        "line": float(line_str),
                        "model_prob": p_over,
                        "odds": round(float(odds_over), 2),
                        "ev_percentage": ev_over,
                    })

                ev_under = evaluate_market_ev(
                    p_under, odds_under,
                    min_ev=min_ev, max_ev=max_ev, min_prob=min_prob, min_odds=min_odds, max_odds=max_odds
                )
                if ev_under is not None:
                    opportunities.append({
                        "market": "totals",
                        "selection": f"Under {line_str}",
                        "line": float(line_str),
                        "model_prob": p_under,
                        "odds": round(float(odds_under), 2),
                        "ev_percentage": ev_under,
                    })

    # 3. Spreads (Asian Handicap)
    spreads_odds = market_odds.get("spreads", {})
    if spreads_odds:
        spread_probs = compute_asian_handicap_probabilities(
            matrix, lines=(-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5)
        )
        for line_str, s_odds in spreads_odds.items():
            if line_str in spread_probs:
                p_home = spread_probs[line_str]["home"]
                p_away = spread_probs[line_str]["away"]
                p_push = spread_probs[line_str]["push"]
                odds_h = s_odds.get("home")
                odds_a = s_odds.get("away")

                ev_home = evaluate_market_ev(
                    p_home, odds_h, push_prob_pct=p_push,
                    min_ev=min_ev, max_ev=max_ev, min_prob=min_prob, min_odds=min_odds, max_odds=max_odds
                )
                if ev_home is not None:
                    opportunities.append({
                        "market": "spreads",
                        "selection": f"Home {line_str}",
                        "line": s_odds.get("line"),
                        "model_prob": p_home,
                        "odds": round(float(odds_h), 2),
                        "ev_percentage": ev_home,
                    })

                ev_away = evaluate_market_ev(
                    p_away, odds_a, push_prob_pct=p_push,
                    min_ev=min_ev, max_ev=max_ev, min_prob=min_prob, min_odds=min_odds, max_odds=max_odds
                )
                if ev_away is not None:
                    opportunities.append({
                        "market": "spreads",
                        "selection": f"Away {line_str}",
                        "line": s_odds.get("line"),
                        "model_prob": p_away,
                        "odds": round(float(odds_a), 2),
                        "ev_percentage": ev_away,
                    })

    # Sort descending by EV%
    opportunities.sort(key=lambda x: x.get("ev_percentage", 0.0), reverse=True)
    return opportunities


def compute_multi_market_analytics(
    lambda_home: float,
    lambda_away: float,
    market_odds: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Generate the 6x6 score probability matrix and compute full multi-market
    analytics: 1X2 win probabilities, predicted score, Totals, Spreads, BTTS,
    and all detected +EV opportunities.
    """
    matrix = score_matrix(lambda_home, lambda_away)
    max_goals = matrix.shape[0]
    total = float(np.sum(matrix))

    p_h = float(np.sum(np.tril(matrix, -1))) / total if total > 0 else 0.0
    p_d = float(np.sum(np.diag(matrix))) / total if total > 0 else 0.0
    p_a = float(np.sum(np.triu(matrix, 1))) / total if total > 0 else 0.0

    # Most likely scoreline
    flat_idx = int(np.argmax(matrix))
    most_likely_h, most_likely_a = divmod(flat_idx, max_goals)
    predicted_score = f"{most_likely_h}-{most_likely_a}"

    totals_probs = compute_totals_probabilities(matrix, lines=(1.5, 2.5, 3.5))
    spread_probs = compute_asian_handicap_probabilities(
        matrix, lines=(-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5)
    )
    btts_probs = compute_btts_probabilities(matrix)

    # Multi-market EV detection
    ev_opportunities = evaluate_multi_market_ev(matrix, market_odds)

    # Best 1X2 pick for backward compatibility
    h2h_odds = market_odds.get("h2h", {}) if market_odds else {}
    value_pick, ev_pct = find_best_pick(
        p_h, p_d, p_a,
        h2h_odds.get("home"), h2h_odds.get("draw"), h2h_odds.get("away")
    )

    return {
        "lambda_home": round(lambda_home, 2),
        "lambda_away": round(lambda_away, 2),
        "prob_home": round(p_h * 100.0, 2),
        "prob_draw": round(p_d * 100.0, 2),
        "prob_away": round(p_a * 100.0, 2),
        "predicted_score": predicted_score,
        "prob_over_25": totals_probs["2.5"]["over"],
        "prob_btts": btts_probs["yes"],
        "totals_probabilities": totals_probs,
        "spread_probabilities": spread_probs,
        "btts_probabilities": btts_probs,
        "value_pick": value_pick,
        "ev_percentage": ev_pct,
        "ev_opportunities": ev_opportunities,
    }
