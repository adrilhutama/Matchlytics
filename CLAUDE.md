# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

```bash
# Python deps + tests (run from repo root)
pip install -r scripts/requirements.txt
python -m pytest scripts/tests/ -v          # 33 tests: test_engine.py (29) + test_evaluator.py (4)
python -m pytest scripts/tests/test_engine.py -v          # single test file
python -m pytest scripts/tests/test_evaluator.py::test_name -v   # single test

# Run the analytics pipeline locally (needs .env at repo root)
cp .env.example .env  # then fill in secrets
cd scripts
python sync_standings.py          # pull league tables & home/away splits
python sync_monthly_fixtures.py   # pull upcoming fixtures (weekly cron trigger)
python sync_daily.py              # full pipeline: odds + Poisson + EV + settlement + Telegram

# Frontend
cd frontend
npm install
npm run dev           # -> http://localhost:5173 (landing view; PWA installed via sw)
npm run build         # production build check (Vite + vite-plugin-pwa)
```

## Architecture Overview

Matchlytics is a decoupled football analytics SaaS platform with **no application backend server**: GitHub Actions pipelines write to Supabase, and two static frontends read directly via the public anon key. A landing/marketing page and the dashboard are the same React SPA, switched by hostname.

### Dual-domain routing (hostname-aware views)

- `imortifex.me` serves the institutional landing page (`frontend/src/components/LandingPage.jsx`); `app.imortifex.me` serves the dashboard (`frontend/src/App.jsx`). View selection happens in `main.jsx`/`App.jsx` based on `window.location.hostname`.
- "Launch terminal" CTAs on the landing page navigate cross-domain to `https://app.imortifex.me` in production, but switch in-place (view state) on `localhost` / `vercel.app` previews so local dev keeps working without DNS.

### Data Sources

| Source | Role | Key Module |
|---|---|---|
| `api.football-data.org/v4` | Standings, home/away splits, fixture metadata, official results (settlement) | `sync_standings.py`, `sync_monthly_fixtures.py`, `evaluator.py` |
| `api.the-odds-api.com/v4` | Real decimal odds (Bet365/Pinnacle consensus) | `sync_daily.py` (`_fetch_odds`) |
| Supabase (PostgreSQL) | Single source of truth for analytics, auth, subscriptions, and both frontends | — |

Public UI copy deliberately never names the raw data vendors ("Consensus Sharp Aggregation", "Tier-1 European Fixture Telemetry", etc.); internal pipeline code and this doc use the real vendor names.

### Pipeline Stages (each a separate GitHub Action)

1. **Standings Sync** (`sync_standings.yml`, daily 03:00 UTC) - computes per-team `home_*`/`away_*` attack & defense strengths from league tables, upserts into `team_standings`.
2. **Fixtures Sync** (`sync_fixtures.yml`, Mondays 02:00 UTC) - upserts upcoming matches into `fixtures` on a rolling window.
3. **Odds & Analytics** (`sync_odds_analytics.yml`, twice daily 06:00 and 14:00 UTC) - joins standings lambdas with real odds, runs the Poisson engine, detects +EV bets, settles finished matches via `evaluator.py`, posts a Telegram SITREP, writes a Step Summary.

All three are idempotent; `sync_daily.py` is the main entry point for a complete local analytics cycle.

### Core Math (`scripts/engine.py`)

- `calculate_lambdas(home_stats, away_stats, league_averages)` -> `(lambda_home, lambda_away)` using stored home/away splits, Bayesian shrinkage toward the league baseline, clamped to `[0.6, 3.2]`.
- `score_matrix(lambda_h, lambda_a)` - 6x6 joint Poisson matrix (scores 0-5), cells normalized to sum to 1.0.
- `calc_probabilities(...)` returns a `MatchAnalytics` dataclass: 1X2 %, Over 2.5 %, BTTS %, predicted scoreline, best value pick + EV %.
- `find_best_pick` applies guardrails: odds within `[1.25, 12.0]`, model probability >= 15 %, EV flagged only in `[2%, 35%]` band.

The frontend mirrors the engine in JS (`frontend/src/utils/analytics.js`): `computePoissonMatrix` normalizes cell mass to 100 %, `calculateKelly` caps quarter-Kelly at **2.5 % of bankroll**, `calculateParlayAggregates` applies the same cap. Keep the two sides aligned when touching either.

### Evaluator (`scripts/evaluator.py`)

Post-match accuracy tracking: multi-class Brier score for 1X2 probabilities, Win Rate / ROI over settlement windows, full-history backtest equity curves (flat and quarter-Kelly staking) consumed by the dashboard Track Record panel. Handles team-name normalization (diacritics, prefix/suffix stripping) to match football-data.org names against The Odds API fixture keys.

### Database Schema (`supabase/migrations/`, run manually in Supabase SQL editor - not auto-applied)

- `fixtures` - one row per match: lambdas, 1X2/O2.5/BTTS percentages, real odds, `value_pick`, `ev_percentage`, `settled_at`.
- `team_standings` - per-league home/away attack & defense strengths per team.
- `profiles` - created on signup (trigger-driven, security definer); holds `subscription_tier` ('free' | 'pro' | 'annual' | 'institutional'), `subscription_status`, `current_period_end`. The SPA derives every paywall gate from this single row.
- RLS hardened by `20261002_rls_hardening.sql`: anonymous/authenticated clients get SELECT-only on pipeline tables; UPDATE on own profile is allowed but all entitlement columns are frozen in the WITH CHECK clause (self-escalation closed); all writes go through the service role, which bypasses RLS. Migrations are sequential - new ones must be numbered after `20261002`.

### Subscription Tiers (3-tier paywall, derived client-side from the profile row)

| Tier | Horizon access | Quant features |
|---|---|---|
| free | today only | none; locked pills fire the upgrade modal |
| pro | today + 7 days | +EV scanner, heatmaps, Kelly, parlay |
| annual / institutional | today + 7 days + full 30 days | everything + historical backtests, model ledger |

Pricing is a single source of truth driven by env vars shared between `SubscriptionModal.jsx` and `LandingPage.jsx`: `VITE_PRICE_PRO` (fallback `Rp 149.000 / bln`) and `VITE_PRICE_ANNUAL`/`VITE_PRICE_SEASON` (fallback `Rp 999.000 / thn`). Payments: optional gateway link env vars (`VITE_CHECKOUT_URL_PRO` / `_SEASON`, Midtrans/Sanberpay or Stripe with `customer_email` appended) falling back to a manual QRIS/bank-transfer card; activation confirmation is env-driven (`VITE_ADMIN_WHATSAPP`) - do not hardcode phone numbers or admin URLs.

### Frontend (`frontend/`)

Vite + React 18 + Tailwind CSS 3, PWA (service worker precache, install prompt component), deployed on Vercel (`vercel.json`, root `frontend/`). Reads Supabase with the anon key; realtime channels keep the dashboard live. No router library: single app with view state, filters, and tier gating in `App.jsx`; components in `src/components/`. Design system: pitch-dark palette tokens in `src/index.css`, DM Sans + DM Mono, single amber accent. Two strict house rules enforced across all UI copy: **zero em dashes (`—`) anywhere** (use periods/colons), and no fabricated vendor names, stats, or dead links (all public-facing claims are either live data, explicitly labelled EXAMPLE, or tied to a real destination).

## Secrets Required (GitHub or `.env`)

| Secret | Where used |
|---|---|
| `FOOTBALL_DATA_TOKEN` | All pipeline scripts (api.football-data.org) |
| `ODDS_API_KEY` | `sync_daily.py` (The Odds API) |
| `SUPABASE_URL` | All scripts + frontend env |
| `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_KEY`) | All pipeline write operations |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | `telegram_notifier.py` (optional - skip to disable pings) |

Frontend env (in `frontend/.env` or Vercel project settings): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, plus the optional paywall vars listed above.

Note: `sync_daily.py` enforces its own `REQUEST_DELAY = 6.5s` between odds-API calls to stay inside the free tier (about 10 req/min). Do not remove this throttle when running locally.
