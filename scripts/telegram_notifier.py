# ============================================================
# scripts/telegram_notifier.py
# Automated Daily SITREP Dispatcher via Telegram Bot API.
#
# Generates quantitative daily briefings:
# - Analysis status and fixture volumes
# - API remaining quota alerts
# - Model calibration (Brier score, win rate, ROI)
# - Top +EV picks with odds & probability breakdown
# - Tap-to-copy Top 3 accumulator / parlay code block
# - Direct inline links to dashboard and GitHub Actions
# ============================================================

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import requests

from config import (
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    APP_BASE_URL,
    GITHUB_REPOSITORY,
)


def send_daily_sitrep(
    sync_stats: dict,
    settlement_stats: dict,
    top_ev_picks: list[dict],
    quota_remaining: int | None = None,
) -> bool:
    """
    Dispatch formatted HTML Daily SITREP to Telegram.
    """
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("    [INFO] Telegram credentials not configured. Skipping SITREP.")
        return False

    try:
        now_utc = datetime.now(timezone.utc)
        current_date_utc = now_utc.strftime("%Y-%m-%d %H:%M")
        current_hour_utc = now_utc.hour

        # Silent window guard: 18:00 to 22:00 UTC corresponds to 01:00 - 05:00 WIB (UTC+7)
        disable_notification = (18 <= current_hour_utc <= 22)

        # Quota alert banner
        quota_banner = ""
        if quota_remaining is not None and quota_remaining < 30:
            quota_banner = f"⚠️ <b>API QUOTA WARNING:</b> Only {quota_remaining} requests remaining this month.\n\n"

        quota_display = f"{quota_remaining} left" if quota_remaining is not None else "Active"

        total_fixtures = sync_stats.get("total_fixtures", 0)
        ev_count = len(top_ev_picks)

        # Settlement metrics
        settled_count = settlement_stats.get("settled_count", 0)
        wins = settlement_stats.get("wins", 0)
        losses = settlement_stats.get("losses", 0)
        win_rate = settlement_stats.get("win_rate", 0.0)
        roi_pct = settlement_stats.get("roi_pct", 0.0)
        brier_score = settlement_stats.get("brier_score", 0.0)

        # Format Top 3-5 Value Edges
        top_picks_text = ""
        if top_ev_picks:
            lines = []
            for p in top_ev_picks[:5]:
                home = p.get("home_team", "Home")
                away = p.get("away_team", "Away")
                league = p.get("league_code", "LGE")
                pick = p.get("value_pick", "PICK")
                odds = p.get("odds", 1.0)
                prob = p.get("model_prob", 0.0)
                ev = p.get("ev_percentage", 0.0)
                lines.append(
                    f"• <b>{home} vs {away}</b> ({league})\n"
                    f"  🎯 Pick: <b>{pick}</b> @ {odds:.2f} (Model: {prob:.1f}% | <b>+{ev:.1f}% EV</b>)"
                )
            top_picks_text = "\n".join(lines)
        else:
            top_picks_text = "• No mispricings meeting strict EV guardrails (2% to 35%) today."

        # Format Top 3 Parlay accumulator code block (Tap to copy)
        parlay_block = ""
        if len(top_ev_picks) >= 2:
            parlay_legs = top_ev_picks[:3]
            comb_odds = 1.0
            comb_prob = 1.0
            parlay_lines = []

            for idx, leg in enumerate(parlay_legs, 1):
                h = leg.get("home_team", "Home")
                a = leg.get("away_team", "Away")
                pk = leg.get("value_pick", "PICK")
                od = float(leg.get("odds") or 1.0)
                pr = float(leg.get("model_prob") or 0.0)
                ev = float(leg.get("ev_percentage") or 0.0)

                comb_odds *= od
                comb_prob *= (pr / 100.0)
                parlay_lines.append(f"{idx}. {h} vs {a}: {pk} @ {od:.2f} (+{ev:.1f}% EV)")

            comb_prob_pct = comb_prob * 100.0
            comb_ev = (comb_prob * comb_odds - 1.0) * 100.0

            # Conservative fractional Kelly
            b = max(0.1, comb_odds - 1.0)
            p = max(0.01, comb_prob)
            q = 1.0 - p
            full_k = max(0.0, (b * p - q) / b)
            rec_stake = min(2.5, max(0.5, round(full_k * 0.25 * 100, 1)))

            parlay_legs_formatted = "\n".join(parlay_lines)
            parlay_block = (
                "\n📋 <b>TOP 3 ACCUMULATOR / PARLAY SLIP:</b>\n"
                "(Tap code block below to copy instantly)\n"
                f"<code>🎯 MATCHLYTICS QUANT PARLAY\n"
                f"{parlay_legs_formatted}\n"
                f"Combined Odds: {comb_odds:.2f} | Slip EV: +{comb_ev:.1f}%\n"
                f"Rec Stake: {rec_stake}% Kelly</code>\n"
            )

        # Assemble full SITREP message
        message = (
            f"📊 <b>MATCHLYTICS DAILY SITREP</b>\n"
            f"📅 {current_date_utc} UTC\n"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"{quota_banner}"
            f"✅ <b>Status:</b> Sync Complete\n"
            f"⚽ <b>Fixtures Analyzed:</b> {total_fixtures}\n"
            f"🎯 <b>+EV Opportunities:</b> {ev_count} matches\n"
            f"📶 <b>The Odds API Quota:</b> {quota_display}\n\n"
            f"📈 <b>YESTERDAY SETTLEMENT (Model Tracking):</b>\n"
            f"• Settled: {settled_count} | Wins: {wins} | Losses: {losses}\n"
            f"• Win Rate: {win_rate}% | ROI: {roi_pct}%\n"
            f"• Brier Score: {brier_score}\n\n"
            f"🔥 <b>TOP VALUE EDGES TODAY:</b>\n"
            f"{top_picks_text}\n"
            f"{parlay_block}"
            f"━━━━━━━━━━━━━━━━━━━━━\n"
            f"<i>Powered by Matchlytics Quant Engine.</i>"
        )

        # Inline Keyboard Buttons
        inline_buttons = [
            [
                {"text": "🌐 Open Matchlytics Dashboard", "url": APP_BASE_URL}
            ]
        ]

        if GITHUB_REPOSITORY:
            inline_buttons.append([
                {"text": "📋 View GitHub Run", "url": f"https://github.com/{GITHUB_REPOSITORY}/actions"}
            ])

        reply_markup = {"inline_keyboard": inline_buttons}

        payload = {
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": "HTML",
            "disable_notification": disable_notification,
            "reply_markup": json.dumps(reply_markup),
        }

        api_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        resp = requests.post(api_url, json=payload, timeout=12)

        if resp.status_code == 200:
            print("    [Telegram] Daily SITREP dispatched successfully.")
            return True
        else:
            print(f"    [Telegram Error] Status {resp.status_code}: {resp.text}")
            return False

    except Exception as exc:
        print(f"    [WARN] Exception while sending Telegram SITREP: {exc}")
        return False
