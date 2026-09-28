# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

```bash
# Python deps + tests (run from repo root)
pip install -r scripts/requirements.txt
python -m pytest scripts/tests/ -v
python -m pytest scripts/tests/test_engine.py -v          # single test file
python -m pytest scripts/tests/test_evaluator.py -v       # single test file

# Run the analytics pipeline locally (needs .env)
cp .env.example .env  # then fill in secrets
cd scripts
python sync_monthly_fixtures.py   # pull next 7 days of fixtures (weekly cron trigger)
python sync_standings.py          # pull league tables & home/away splits (daily)
python sync_daily.py              # full pipeline: odds + Poisson + EV + settlement + Telegram

# Frontend
cd frontend
npm install
npm run dev           # → http://localhost:5173
npm run build         # production build check
```

## Architecture Overview

Matchlytics is a decoupled, multi-pipeline football analytics platform. It has **no backend server** — GitHub Actions do all the work and push to Supabase; the frontend reads directly via the public anon key.

### Data Sources
| Source | Role | Key Module |
|---|---|---|
| `api.football-data.org/v4` | Standings, home/away splits, fixture metadata | `sync_standings.py`, `sync_monthly_fixtures.py` |
| `api.the-odds-api.com/v4` | Real Bet365/Pinnacle decimal odds | `sync_daily.py` (inside `_fetch_odds`) |
| Supabase (PostgreSQL) | Single source of truth for both analytics and frontend | — |

### Pipeline Stages (each a separate GitHub Action)

1. **Standings Sync** (`sync_standings.yml`, 03:00 UTC daily) — pulls each league's table, computes per-team `home_*` / `away_*` attack & defense strengths, upserts into `team_standings`.
2. **Fixtures Sync** (`sync_fixtures.yml`, weekly Mondays at 02:00 UTC) — upserts upcoming matches into `fixtures` for the next 7 days.
3. **Odds & Analytics** (`sync_odds_analytics.yml`, twice daily at 06:00 and 14:00 UTC) — joins standings lambdas with real odds, runs the Poisson engine, detects +EV bets, settles finished matches, posts a Telegram SITREP, and writes a GitHub Step Summary.

All three are idempotent; `sync_daily.py` is the main entry point for a complete analytics cycle.

### Core Math (`scripts/engine.py`)

- `calculate_lambdas(home_atk, away_def, home_def, away_atk)` — uses stored home/away splits from `team_standings` to compute `λ_home` and `λ_away`, clamped to `[0.6, 3.2]`.
- `score_matrix(λ_h, λ_a)` — 6×6 joint Poisson matrix (scores 0–5).
- `calc_probabilities(λ_h, λ_a, odds_home, odds_draw, odds_away)` — returns a `MatchAnalytics` dataclass with win/draw/away %, Over 2.5 %, BTTS %, predicted scoreline, and best value pick with EV %.

### Evaluator (`scripts/evaluator.py`)

Tracks model accuracy post-match. Computes the **multi-class Brier score** for 1X2 probabilities, aggregates Win Rate and ROI over recent settlement windows, and calls Supabase RPC `set_match_result`. Also handles team-name normalisation (diacritic stripping, prefix/suffix removal) for matching football-data.org names against The Odds API fixture keys.

### Database Schema

Two migrated tables live in `supabase/migrations/`:
- `fixtures` — the main analytics store, one row per match. Columns include `id`, league info, `lambda_home`/`lambda_away`, probability percentages, odds, `value_pick`, `ev_percentage`, and `settled_at`.
- `team_standings` — per-team home/away attack & defense strengths per league.

RLS policy: anon role = SELECT only (read-only dashboard); service role bypasses RLS for writes.

### Frontend (`frontend/`)

Vite + React 18 + Tailwind CSS 3, deployed on Vercel (`vercel.json` sets root to `frontend/`). Reads Supabase via `@supabase/supabase-js` using the public anon key. Components are in `src/components/`; no routing library — the app is a single page with filter state in `App.jsx`. The only external dependency beyond React is Supabase client.

## Secrets Required (GitHub or `.env`)

| Secret | Where used |
|---|---|
| `FOOTBALL_DATA_TOKEN` | All pipeline scripts (api.football-data.org) |
| `ODDS_API_KEY` | `sync_daily.py` (The Odds API) |
| `SUPABASE_URL` | All scripts + frontend env |
| `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_KEY`) | All pipeline write operations |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | `telegram_notifier.py` (optional — skip to disable pings) |

Note: `sync_daily.py` sets its own `REQUEST_DELAY = 6.5s` between API calls to stay within the free-tier limit of The Odds API (≈10 req/min). Do not remove this throttle when running locally.
