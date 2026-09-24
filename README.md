<div align="center">

# Matchlytics

**Production-ready football match pre-analysis platform**

Calculate Poisson probabilities, expected goals (xG), Over/Under 2.5, BTTS, and detect +EV value bets against Bet365 odds  -  entirely on a free-tier stack.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)
[![GitHub Actions](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white)](https://github.com/features/actions)

</div>

---

## Overview

Matchlytics is a zero-cost statistical football analytics platform that automates the full pipeline from raw league data to actionable pre-match insights. It pulls standings from the API-Football free tier, computes Poisson-distribution score matrices to derive win/draw/loss probabilities, fetches Bet365 decimal odds, and flags bets where the model's implied probability exceeds the bookmaker's price by more than 5%  -  a positive expected value (+EV) signal.

The frontend is a responsive dark-mode dashboard that reads directly from Supabase via a public anon key (no backend server required), deploys to Vercel in one click, and displays fixtures for the next 7 days filtered by league or value-bet status.

**Everything runs within free-tier limits:** API-Football (100 req/day), Supabase (500 MB, unlimited reads), GitHub Actions (2,000 min/month), and Vercel (100 GB bandwidth/month).

---

## Key Features

### Poisson Distribution Engine
- Builds a 6×6 score matrix for scorelines 0–0 through 5–5.
- Each cell is the joint probability of `P(home=i) × P(away=j)` using independent Poisson distributions.
- Derives Home Win %, Draw %, Away Win %, Over 2.5 Goals %, and BTTS % in a single pass.

### Expected Value (+EV) Detection
- Computes `EV = (model_probability × decimal_odds) − 1` for each of the three 1X2 outcomes.
- Flags a **Value Bet** when EV > 5%, identifying odds that are mathematically mispriced in your favour.
- Surfaces the pick with the highest EV when multiple outcomes qualify.

### Dual-Pipeline GitHub Actions Automation
- **Monthly fixture sync** (`monthly_fixtures.yml`)  -  runs on the 1st of each month, pulling the next 30 days of scheduled matches. Uses ~5 API calls. Keeps fixture metadata current without burning daily quota.
- **Daily analytics sync** (`daily_sync.yml`)  -  runs at 06:00 UTC. Fetches standings (5 calls) and today's Bet365 odds (1 call per fixture, ~15 calls), then computes and upserts all analytical metrics. Total: ~20 calls/day, well within the 100/day free limit.

### Dark-Mode Analytics Dashboard
- Vite + React 18 + Tailwind CSS 3  -  no backend server, reads Supabase directly via `@supabase/supabase-js`.
- League filter pills (All, EPL, La Liga, Serie A, Bundesliga, Ligue 1) and a **+EV Value Bets Only** toggle.
- Each match card shows: team logos, predicted scoreline, probability bars (home/draw/away), Over 2.5 and BTTS badges, Bet365 odds vs model fair odds, and a glowing amber +EV badge for value picks.
- Fully responsive  -  tested at 375 px mobile through 1280 px desktop.
- Accessible: WCAG AA contrast, keyboard-navigable, ARIA roles on all interactive elements.

---

## Architecture & Data Flow

```
┌─────────────────────────┐
│     API-Football        │  (RapidAPI  -  free tier, 100 req/day)
│  /standings  /fixtures  │
│  /odds (Bet365 ID=8)    │
└────────────┬────────────┘
             │  HTTPS (Python requests)
             ▼
┌─────────────────────────────────────────────┐
│          GitHub Actions (free tier)          │
│                                             │
│  monthly_fixtures.yml  ─── 1st of month    │
│    sync_monthly_fixtures.py                 │
│    Upserts: id, teams, league, match_date   │
│                                             │
│  daily_sync.yml  ──────── 06:00 UTC daily  │
│    sync_daily.py                            │
│    1. Fetch standings → strength table      │
│    2. Compute λ_home, λ_away (Poisson)      │
│    3. Fetch Bet365 odds per fixture         │
│    4. engine.py → probs, EV, value_pick     │
│    5. Upsert to Supabase                    │
└────────────────────┬────────────────────────┘
                     │  supabase-py (service role)
                     ▼
┌─────────────────────────┐
│   Supabase PostgreSQL   │  (free tier  -  500 MB)
│   Table: fixtures       │
│   RLS: anon = SELECT    │
└────────────┬────────────┘
             │  @supabase/supabase-js (anon key)
             ▼
┌─────────────────────────┐
│  Vite + React Frontend  │
│  Deployed on Vercel     │  (free tier)
│  No backend server      │
└─────────────────────────┘
```

---

## Math & Analytics Pipeline

### 1. Attack and Defense Strength

```
Attack Strength  (team) = (goals_for  / games_played) / league_avg_goals_for_per_game
Defense Strength (team) = (goals_against / games_played) / league_avg_goals_against_per_game
```

A value > 1 means above-average attack or a worse-than-average defense.

### 2. Expected Goals (Lambda)

```
λ_home = home_attack × away_defense × league_avg_goals × 1.10 (home advantage)
λ_away = away_attack × home_defense × league_avg_goals
```

The **1.10 home advantage multiplier** is a standard empirical factor derived from long-run home/away goal ratios in top European leagues.

### 3. Score Matrix

```
P[i, j] = Poisson(i | λ_home) × Poisson(j | λ_away)   for i, j ∈ {0, 1, 2, 3, 4, 5}
```

Each cell is the joint probability that the home team scores exactly `i` goals and the away team scores exactly `j` goals.

### 4. Outcome Probabilities

```
P(Home Win) = Σ P[i,j]  where i > j
P(Draw)     = Σ P[i,i]
P(Away Win) = Σ P[i,j]  where j > i
P(Over 2.5) = Σ P[i,j]  where i + j > 2
P(BTTS)     = Σ P[i,j]  where i ≥ 1 and j ≥ 1
```

### 5. Expected Value & Value Bet Detection

```
EV = (model_probability × decimal_odds) − 1

Value Bet flagged when: EV > 0.05  (threshold: 5%)
```

A positive EV means the model believes the bookmaker has underpriced this outcome relative to its true probability.

---

## Project Structure

```
Matchlytics/
│
├── .env.example                         # Python env vars template
├── .gitignore
├── vercel.json                          # Vercel build config (root: frontend/)
│
├── supabase/
│   └── migrations/
│       └── 001_init.sql                 # fixtures table + RLS + indexes
│
├── scripts/
│   ├── requirements.txt                 # requests, supabase, scipy, numpy, python-dotenv
│   ├── config.py                        # Env vars, Supabase client, league IDs
│   ├── engine.py                        # Poisson engine + EV detector
│   ├── sync_monthly_fixtures.py         # Pull next 30 days of fixtures
│   ├── sync_daily.py                    # Daily: standings → lambdas → odds → analytics
│   └── tests/
│       └── test_engine.py              # 16 pytest unit tests
│
├── .github/
│   └── workflows/
│       ├── daily_sync.yml               # Cron: 06:00 UTC daily
│       └── monthly_fixtures.yml         # Cron: 1st of month at 05:00 UTC
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    ├── .env.example                     # Frontend Supabase env vars template
    └── src/
        ├── main.jsx
        ├── App.jsx                      # Data fetching, filter state, routing
        ├── index.css                    # Design tokens, shimmer, glass, card variants
        ├── lib/
        │   └── supabase.js             # Supabase anon client
        └── components/
            ├── Header.jsx
            ├── FilterBar.jsx           # League pills + value-bet toggle
            ├── MatchCard.jsx           # Main data display card
            ├── ProbabilityBar.jsx      # Home/Draw/Away visual bars
            ├── OddsComparison.jsx      # Bookmaker vs model fair odds
            ├── ValueBadge.jsx          # Amber +EV badge (the single glow element)
            ├── LoadingState.jsx        # Shimmer skeleton cards
            ├── EmptyState.jsx          # No results  -  named cause + action
            └── ErrorState.jsx          # Supabase error  -  named cause + Retry
```

---

## Local Setup & Installation

### Prerequisites

- Python 3.10+
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier)
- An [API-Football](https://rapidapi.com/api-sports/api/api-football) key on RapidAPI (free tier)

### 1. Database Migration

1. Open your Supabase project dashboard.
2. Navigate to **SQL Editor > New Query**.
3. Paste and run the contents of [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql).
4. Confirm the `fixtures` table appears in **Table Editor**.

### 2. Python Pipeline

```bash
# Install dependencies
pip install -r scripts/requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and fill in: RAPIDAPI_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# Step A: populate fixture metadata for the next 30 days (run once per month)
cd scripts
python sync_monthly_fixtures.py

# Step B: run the daily analytics sync (normally handled by GitHub Actions)
python sync_daily.py
```

### 3. Frontend Development

```bash
cd frontend

# Set up environment variables
cp .env.example .env
# Edit .env and fill in: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

# Install dependencies
npm install

# Start the development server
npm run dev
# → http://localhost:5173

# Production build (optional local check)
npm run build
```

### 4. Run Tests

```bash
# From the project root
python -m pytest scripts/tests/ -v
```

---

## GitHub Actions Secrets

Add these in **Repository Settings > Secrets and variables > Actions > New repository secret**:

| Secret Name | Description |
|---|---|
| `RAPIDAPI_KEY` | Your API-Football key from RapidAPI |
| `SUPABASE_URL` | `https://<your-project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS  -  backend only) |

The `daily_sync.yml` workflow fires automatically at **06:00 UTC** every day. You can also trigger it manually via **Actions > Daily Analytics Sync > Run workflow**.

The `monthly_fixtures.yml` workflow fires on the **1st of each month at 05:00 UTC**, or manually.

---

## Vercel Deployment

1. Import this repository at [vercel.com/new](https://vercel.com/new).
2. Vercel detects `vercel.json` automatically  -  the build root is set to `frontend/`.
3. Add the following **Environment Variables** in the Vercel project settings:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (safe for browser  -  RLS enforces read-only) |

4. Deploy. Every push to `main` triggers an automatic redeploy.

---

## API Quota Management

The free tier of API-Football provides **100 requests per day**. Matchlytics is designed to consume approximately 20:

| Source | Calls |
|---|---|
| Standings (5 leagues × 1) | 5 |
| Bet365 odds (up to ~15 fixtures/day) | ≤ 15 |
| **Total daily** | **~20** |

The monthly fixture sync consumes an additional ~5–10 calls and runs only once per month.

---

## Disclaimer

> Matchlytics provides **mathematical model outputs** based on historical league standing data and Poisson distribution theory. Probabilities, predicted scores, and Expected Value calculations are **statistical estimates** and do not guarantee any betting outcome. Past model accuracy does not predict future results.
>
> **Bet responsibly.** This tool is intended for educational and analytical purposes only. Always comply with your local gambling regulations.

---

## License

MIT License  -  see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with Python, React, Supabase, and GitHub Actions on a 100% free-tier stack.

</div>
