# AGENTS.md

This file provides guidance to AI coding agents (e.g. Codex) when working with code in this repository.

## 1. Project Mission & High-Level Architecture

**Matchlytics by imortifex** is an institutional sports market intelligence platform driven by mathematical rigor. It automates the end-to-end quantitative workflow:

1. Ingesting football fixture telemetry and real market consensus odds.
2. Generating expected goal intensities (`λ`) via Bayesian-adjusted team strength models.
3. Calculating bivariate Poisson joint probabilities across multiple markets (1X2, Over/Under totals, Asian Handicap, Both Teams To Score).
4. Scanning for actionable Expected Value (+EV) with risk-constrained fractional Kelly sizing (quarter-Kelly capped at 2.5% of bankroll).
5. Settling completed fixtures against official results to compute Brier scores, Win Rate, and verified equity curves.

### Backendless Architecture

There is **no standalone backend application server** (no Express/FastAPI/Django process).
- **Compute & Pipeline:** Autonomous Python cron jobs running on **GitHub Actions**.
- **Data & Auth Layer:** **Supabase (PostgreSQL)** with Row Level Security (RLS) and Realtime pub/sub.
- **Frontend & Client:** Single deployable **React 18 SPA (Vite + Tailwind CSS + PWA)** deployed on **Vercel**, reading directly from Supabase via the public `anon` key.

```
+-----------------------------------------------------------------------+
|                     DATA SOURCES (External APIs)                      |
|  - api.football-data.org (Standings, Fixtures, Scores)                |
|  - api.the-odds-api.com (Consensus Market Odds, Key Pool)             |
+--------------------------+--------------------------------------------+
                           |
                           v
+--------------------------v--------------------------------------------+
|                GITHUB ACTIONS (Python 3.11)                          |
|  - sync_standings.py  (Daily 03:00 UTC)                              |
|  - sync_fixtures.yml  (Mondays 02:00 UTC)                            |
|  - sync_daily.yml     (Twice daily 06:00 & 14:00 UTC)                |
|    └─ Poisson Engine + EV Detector + Settlement + Telegram           |
+--------------------------+--------------------------------------------+
                           | Writes via SUPABASE_SERVICE_ROLE_KEY
                           v
+--------------------------v--------------------------------------------+
|                     SUPABASE (PostgreSQL)                             |
|  - Tables: fixtures, team_standings, profiles, notifications,         |
|            portfolio_positions                                        |
|  - Hardened RLS: Public SELECT only, secure triggers                  |
+--------------------------+--------------------------------------------+
                           | Realtime + SELECT (anon key)
                           v
+--------------------------v--------------------------------------------+
|               FRONTEND SPA (Vite + React 18 + PWA)                   |
|  - imortifex.me     -> Institutional Showcase / Landing               |
|  - app.imortifex.me -> SaaS Terminal (4 Quant Workspaces)             |
+-----------------------------------------------------------------------+
```

---

## 2. Directory Structure & File Map

```
Matchlytics/
├── .github/workflows/          # Automated GitHub Actions cron pipelines
│   ├── sync_daily.yml          # Odds sync, engine run, settlement, Telegram SITREP
│   ├── sync_fixtures.yml       # 30-day rolling fixture ingestion
│   └── sync_standings.yml      # Standings & team attack/defense splits
├── frontend/                   # Client application (Vite + React 18 + Tailwind)
│   ├── public/                 # Static assets, PWA manifest, service worker
│   ├── src/
│   │   ├── components/         # UI components & terminal workspaces
│   │   │   ├── LandingPage.jsx           # Institutional showcase terminal (imortifex.me)
│   │   │   ├── TerminalScanner.jsx       # Workspace 1: Market scanner & radar
│   │   │   ├── QuantLab.jsx              # Workspace 2: Deep dive Poisson matrix & simulation
│   │   │   ├── PortfolioTracker.jsx      # Workspace 3: Bankroll journal & Kelly sizing
│   │   │   ├── ModelLedger.jsx           # Workspace 4: Settled track record & calibration
│   │   │   ├── AdminDashboard.jsx        # Operator-only subscription & audit management
│   │   │   ├── ScoreMatrixModal.jsx      # 6x6 Poisson probability visualizer
│   │   │   ├── KellyCalculatorModal.jsx  # Fractional Kelly capital allocator
│   │   │   ├── SubscriptionModal.jsx     # 3-tier paywall modal & checkout flow
│   │   │   ├── NotificationBell.jsx      # In-app alert bell (unread count)
│   │   │   ├── NotificationPanel.jsx     # Alert queue viewer
│   │   │   ├── ParlaySlipDrawer.jsx      # Multi-leg parlay builder & calculator
│   │   │   ├── CommandPalette.jsx        # Keyboard-shortcut command palette
│   │   │   ├── WorkspaceNav.jsx          # Workspace switcher (top nav on desktop)
│   │   │   └── ...
│   │   ├── context/
│   │   │   └── AuthContext.jsx           # Supabase auth session & profile subscription state
│   │   ├── lib/
│   │   │   └── supabase.js               # Client Supabase instance (uses anon key)
│   │   ├── utils/
│   │   │   └── analytics.js              # Quantitative math in JS (matches Python engine)
│   │   ├── App.jsx                       # Core application orchestrator & workspace router
│   │   ├── index.css                     # Pitch-dark design system tokens & styles
│   │   └── main.jsx                      # Application entrypoint
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vercel.json                       # Vercel deployment configuration
│   └── vite.config.js                    # Vite configuration + PWA plugins
├── scripts/                    # Python pipeline & quantitative engine
│   ├── config.py               # Env configuration, league mappings, Supabase client
│   ├── engine.py               # Bivariate Poisson math, lambdas, Bayesian shrinkage, EV
│   ├── evaluator.py            # Settlement, multi-class Brier score, backtesting ledger
│   ├── football_data_pool.py   # Multi-token pool rotation, telemetry, 429 failover
│   ├── odds_client.py          # Key pool rotation, quota tracking, failover
│   ├── sync_daily.py           # Primary analytics cycle (odds, engine, settlement, alerts)
│   ├── sync_monthly_fixtures.py# Fixture schedule synchronization
│   ├── sync_standings.py       # Standings and home/away form splits synchronization
│   ├── telegram_notifier.py    # Telegram SITREP message generator & bot client
│   ├── requirements.txt        # Python package dependencies
│   └── tests/                  # Pytest test suite (87 unit & integration tests)
│       ├── test_engine.py          # Poisson matrix, EV calculation, strength models
│       ├── test_evaluator.py       # Brier score, settlement, backtesting
│       ├── test_football_data_pool.py # Header-aware telemetry, 429 reset handling, rotation
│       ├── test_odds_pool.py       # Key rotation, HTTP 429 failover, rate pacing
│       └── test_sync_monthly.py    # Fixture parsing, schema adaptation
├── supabase/
│   ├── functions/
│   │   └── admin-activate-subscription/   # Edge function for operator tier changes
│   │       └── index.ts
│   └── migrations/             # SQL schema migrations (sequential; apply in order)
│       ├── 001_init.sql
│       ├── 002_performance_and_realtime.sql
│       ├── 003_optimized_standings_form.sql
│       ├── 20260930_create_profiles.sql
│       ├── 20261001_widen_profiles_tier_to_annual.sql
│       ├── 20261002_rls_hardening.sql
│       ├── 20261003_multi_market_odds.sql
│       ├── 20261004_normalized_schema.sql
│       ├── 20261004_deep_match_enrichment.sql
│       ├── 20261005_user_notifications.sql
│       └── 20261006_admin_audit_log.sql
├── CLAUDE.md                   # Guidance for Claude Code
├── AGENTS.md                   # This instruction file
└── README.md                   # Repository public documentation
```

---

## 3. Core Mathematical Models & Quantitative Invariants

### 3.1 Bivariate Poisson Matrix (`scripts/engine.py` & `frontend/src/utils/analytics.js`)
- **Lambdas:** `λ_home` and `λ_away` represent expected goals.
  - Calculated from relative home attack strength vs. away defense strength with Bayesian shrinkage against league baseline.
  - Home advantage coefficient: default `1.10`.
  - Goal expectations are clamped to the interval `[0.60, 3.20]` to prevent degenerate probability distributions in extreme mismatches.
- **Score Matrix:** 6x6 joint probability grid (scores 0-5 for both home and away):
  ```
  P(X=x, Y=y) = e^(-λ_h) * λ_h^x / x!  ×  e^(-λ_a) * λ_a^y / y!
  ```
- **Normalization:** Matrix cells are strictly normalized to sum to `1.0` (or `100%` on frontend).

### 3.2 Value Bet Detection & Guardrails
A market outcome is only flagged as a Value Bet if:
1. **Model Probability:** `P_model >= 15.0%`.
2. **Market Odds:** `1.25 <= Decimal Odds <= 12.00`.
3. **Expected Value:** `EV = (P_model × Odds) - 1`. EV must fall strictly within the `[+2.0%, +35.0%]` band. Outliers `>35%` are treated as market data errors/line shifts and discarded.

### 3.3 Fractional Kelly Criterion
- Formula: `f* = (b × p - q) / b` where `b = odds - 1`, `p = model probability`, `q = 1 - p`.
- Staking policy: Quarter-Kelly (`0.25 × f*`).
- **Strict Hard Cap:** Never allocate more than **2.5% of bankroll** to a single position, both in Python scripts and frontend calculators.

### 3.4 Calibration & Verification (`scripts/evaluator.py`)
- Multi-class **Brier Score** evaluates 1X2 probabilistic accuracy against binary one-hot vector outcomes. Perfect forecast = `0.0`; baseline uninformed ≈ `0.667`.
- Backtesting ledger computes both Flat and Quarter-Kelly staking equity curves.

### 3.5 Client-Side Monte Carlo Simulation
- `frontend/src/utils/analytics.js` exports `runMonteCarloSimulation(lambdaHome, lambdaAway, iterations = 10000)` for the Quant Lab workspace.
- Uses the same Poisson draw logic as the engine; results are purely illustrative and do not alter settled ledger data.

---

## 4. Database Schema & Security Principles

Migrations live in `supabase/migrations/` and must be applied sequentially. **Do not skip migration numbers.** New migrations must be numbered after `20261006`.

### 4.1 Tables
- `teams`: Normalized club metadata (`id`, `name`, `short_name`, `tla`, `crest_url`, `competition_code`).
- `fixtures`: Primary telemetry record per match. Includes match times, status, raw odds, calculated fair odds, Poisson probabilities, `value_pick`, `ev_percentage`, multi-market odds (`market_odds` JSONB), and settled scores.
- `team_standings`: Precomputed attack/defense power ratings per league.
- `profiles`: User account record keyed to `auth.users(id)`. Manages `subscription_tier` (`free`, `pro`, `annual`, `institutional`), validity dates, and features.
- `notifications`: Per-user in-app alert queue, surfaced by `NotificationBell` / `NotificationPanel`.
- `portfolio_positions`: User bet tracking journal with status tracking (`PENDING`, `WON`, `LOST`, `PUSH`).

### 4.2 Row Level Security (RLS) Rules
- **Public & Authenticated Client:** `SELECT` only on fixtures, standings, teams, and notifications.
- **Client Profile Protection:** Users can read and update their own display settings, but subscription columns (`subscription_tier`, `subscription_status`, `current_period_end`) are frozen via `WITH CHECK` clauses to prevent client-side privilege escalation.
- **Data Ingestion Writes:** All inserts and updates from GitHub Actions pipelines MUST use the `SUPABASE_SERVICE_ROLE_KEY` (which bypasses RLS).

### 4.3 Admin Operator Flow
- `AdminDashboard.jsx` gates access to users whose email is listed in `VITE_ADMIN_EMAILS` (comma-separated env var).
- Tier/status changes are executed via the `admin-activate-subscription` Supabase Edge Function, which writes an audit log entry to the `notifications` table under the `admin_audit` channel.
- Activation confirmation routes through `VITE_ADMIN_WHATSAPP` (if set) or falls back to manual QRIS/bank-transfer instructions.

---

## 5. House Rules & Coding Standards

When editing or generating code in this repository, you must observe these strict standards:

### Rule 1: Zero Em Dashes (R-02 Compliance)
- **Do NOT use em dashes (—)** anywhere in user-facing UI text, landing copy, notifications, or terminal logs.
- Use periods (`.`), colons (`:`), or simple spaced hyphens (` - `).

### Rule 2: Strict Vendor Anonymity in UI (R-03 Compliance)
- Never display raw data provider names (`football-data.org`, `The Odds API`, `Bet365`, `Pinnacle`) to end users in UI copy.
- Use institutional nomenclature instead:
  - *Football-Data.org* → "Tier-1 European Fixture Telemetry" or "Official Competition Feed"
  - *The Odds API / Bookmakers* → "Consensus Sharp Aggregation" or "Institutional Market Feed"
- Internal pipeline code and documentation may use real vendor names.

### Rule 3: Mathematical Parity
- Whenever editing mathematical calculations in `scripts/engine.py` or `scripts/evaluator.py`, you **must** verify and update the corresponding JavaScript logic in `frontend/src/utils/analytics.js` (and vice-versa).
- Both sides must preserve the 2.5% quarter-Kelly cap, Poisson matrix normalization, and probability bounds.
- Run `npm run build` in `frontend/` after any engine change to catch compile-level drift.

### Rule 4: Odds API Key Pool & Rate Pacing
- The upstream APIs impose free-tier request limits.
- Never remove the `REQUEST_DELAY = 6.5` second sleep in `scripts/sync_daily.py`.
- Always utilize the multi-key pool (`ODDS_API_KEYS`) via `scripts/odds_client.py` for key rotation and automatic failover on HTTP 429.
- The `football_data_pool.py` module handles its own micro-pacing (100ms) and quota-aware failover; do not bypass it.

---

## 6. Development & Verification Workflows

### 6.1 Python Testing & Verification
All scripts and quantitative formulas must pass the pytest test suite before committing changes.

```bash
# Run all tests (87 tests across engine, evaluator, football-data pool, odds pool, monthly sync)
python -m pytest scripts/tests/ -v

# Run individual test modules
python -m pytest scripts/tests/test_engine.py -v
python -m pytest scripts/tests/test_evaluator.py -v
python -m pytest scripts/tests/test_football_data_pool.py -v
python -m pytest scripts/tests/test_odds_pool.py -v
python -m pytest scripts/tests/test_sync_monthly.py -v
```

### 6.2 Running Pipelines Locally
Ensure `.env` exists in the repository root (see `.env.example`):
```bash
cd scripts
python sync_standings.py         # Pull league standings & compute home/away stats
python sync_monthly_fixtures.py  # Pull upcoming 30-day fixtures
python sync_daily.py             # Full run: odds + Poisson + +EV detection + settlement
```

### 6.3 Frontend Development
```bash
cd frontend
npm install
npm run dev                      # Start Vite dev server on http://localhost:5173
npm run build                    # Validate production build & PWA manifest
```

### 6.4 Dual-Domain Testing Locally
The frontend renders different views based on hostname or query params:
- `http://localhost:5173/?view=landing` or `#/` → Institutional Landing Showcase
- `http://localhost:5173/?view=app` or `#/app` → Full Operational Terminal Dashboard
