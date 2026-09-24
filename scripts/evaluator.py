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


def fetch_and_settle_completed_matches(base_url: str, headers: dict, supabase: Any) -> int:
    """
    import requests
    Query football-data.org for fixtures finished in the last 48 hours,
    and update their final scores and status in Supabase.
    """
    try:
        today = date.today()
        from_str = (today - timedelta(days=2)).strftime("%Y-%m-%d")
        to_str = today.strftime("%Y-%m-%d")

        url = f"{base_url}/matches"
        params = {
            "dateFrom": from_str,
            "dateTo": to_str,
            "status": "FINISHED",
        }

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
                # Update fixture record in Supabase
                supabase.table("fixtures").update({
                    "status": "FT",
                    "home_score": int(h_score),
                    "away_score": int(a_score),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", mid).execute()
                settled_count += 1

        print(f"    Settled {settled_count} recent finished match(es).")
        return settled_count

    except Exception as exc:
        print(f"    [WARN] Exception while settling recent completed matches: {exc}")
        return 0


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
        res = (
            supabase.table("fixtures")
            .select("*")
            .in_("status", ["FT", "FINISHED", "AET", "PEN"])
            .not_.is_("home_score", "null")
            .not_.is_("away_score", "null")
            .gte("match_date", two_days_ago)
            .execute()
        )

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
            h_score = int(r["home_score"])
            a_score = int(r["away_score"])

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
                pick_odds = (
                    r.get("odds_home") if val_pick == "HOME"
                    else r.get("odds_draw") if val_pick == "DRAW"
                    else r.get("odds_away")
                )
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
