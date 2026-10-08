<div align="center">

# MATCHLYTICS BY IMORTIFEX

```
Institutional Sports Market Intelligence Driven by Mathematical Rigor.
```

| Indicator | State |
| --- | --- |
| Engine Calibration | Brier Verified |
| Risk Control | 2.5% Kelly Cap |
| Build | Production Ready |
| Architecture | 3-Tier SaaS |

**Live Endpoints**

| Surface | Address |
| --- | --- |
| Public Terminal Showcase | [https://imortifex.me](https://imortifex.me) |
| SaaS Application | [https://app.imortifex.me](https://app.imortifex.me) |

</div>

---

## Quick Start - /init

To bootstrap a new local development environment in one shot, run the provided setup script:

```bash
init.bat
```

This performs the following steps automatically:

1. Creates and activates a Python virtual environment, then installs all pipeline dependencies from `scripts/requirements.txt`.
2. Installs frontend dependencies via `npm install` (skips if `node_modules` already exists).
3. Copies `.env.example` to `.env` and `frontend/.env.example` to `frontend/.env` (skips if they already exist).
4. Prints the manual migration step reminder - migrations must be applied through the Supabase SQL Editor; there is no auto-apply pipeline.

After the script completes, fill in your credentials in both `.env` files, then:

```bash
# Frontend dev server
cd frontend
npm run dev        # http://localhost:5173 (public terminal view)

# Pipeline (once migrations are applied and tokens are set)
cd scripts
python sync_daily.py    # full quant loop: odds, engine, EV, settlement, Telegram
```

See **Section 4** below for the full environment variable reference and test commands.

Matchlytics is a decoupled, institutional sports market intelligence platform. It automates the
full path from Tier-1 European Fixture Telemetry and Direct Consensus Market Feeds through a
proprietary bivariate Poisson engine, expected value detection, and constrained fractional Kelly
capital allocation, and settles every flagged position against official results on a continuous
calibration loop.

The system ships **without an application backend**: scheduled cloud pipelines write into a
hardened PostgreSQL datastore, and two static surfaces (the public showcase terminal and the SaaS
application) hydrate directly through it in real time. Every quantitative claim below is backed
by a shipped, tested mechanism, not a projection.

---

## 1. System Architecture

### 1.1 Dual-Domain Segregation

| Domain | Role |
| --- | --- |
| `imortifex.me` | Public showcase terminal: institutional marketing surface, live edge monitor, verified track record, pricing architecture. |
| `app.imortifex.me` | SaaS application: the operational dashboard, tier-gated horizons, quant suite, parlay desk, and backtest ledger. |

Both are served from a single deployable SPA that resolves its view from the request hostname.
Cross-surface navigation is direct in production and handled as an in-place view switch in
development environments.

### 1.2 Automated Ingestion Pipeline

Three scheduled, idempotent pipeline stages run autonomously:

1. **Standings & Form Normalization** (daily) - league tables resolve into per-team home and away
   attack/defense strengths, normalized against league averages and written to the form store.
2. **Fixture Intake** (weekly) - the rolling forward fixture window for major European competitions
   is ingested and upserted to the match store.
3. **Consensus Market Capture & Quant Loop** (twice daily) - decimal prices stream in from Direct
   Consensus Market Feeds, are joined against normalized form state, and pass through the
   proprietary bivariate Poisson engine. Positive expected value positions are detected, finished
   matches are settled at official results, and a structured situation report is emitted each cycle.

All stages publish through a single write path, so every number displayed anywhere in the product
carries one provenance.

### 1.3 Real-Time Client Hydration

Frontend clients read the datastore exclusively through the read-only anonymous channel and
subscribe to realtime change notifications, so dashboard state tracks pipeline settlements without
polling. The application ships as a PWA with service worker precaching and offline capability.

### 1.4 Data Layer: Hardened Cloud Datastore

- Encrypted PostgreSQL as the single source of truth.
- **Row-level security**: anonymous and authenticated client roles are restricted to SELECT on
  every pipeline-managed table; all writes execute under the service role, which bypasses RLS.
- **Trigger-hardened entitlement protection**: subscription entitlements live on the per-user
  profile row, provisioned by a security-definer trigger on account creation and maintained by a
  timestamp trigger. Client-side self-updates are permitted only for display fields; the
  hardened RLS policy ("Users can update own profile, entitlement columns frozen", migration
  `20261002_rls_hardening.sql`) freezes every entitlement column in the `WITH CHECK` clause, so
  tier, status, and period end cannot be escalated from any client surface.
- Housekeeping RPCs (stale-fixture pruning) are revocable from client roles and service-role only.

Migration history lives in `supabase/migrations/` and applies sequentially through the Supabase
SQL editor.

---

## 2. Quantitative Engine & Methodology

### 2.1 Bivariate Poisson Distribution

Attack and defense strengths derive from normalized home and away form splits. Expected goal rates
combine the pair with Bayesian shrinkage toward the league baseline, so early-season samples
cannot distort the output:

```text
λ_home = f(home_attack, away_defense, league averages)
λ_away = f(away_attack, home_defense, league averages)
shrinkage:  (raw_strength × games_played + baseline × 3) / (games_played + 3)
clamp:      λ strictly within [0.6, 3.2], finite-input guarded
```

The engine builds the joint 6×6 bivariate score matrix `P(i, j) = P(home = i) × P(away = j)` for
goal counts 0 to 5, renormalized to unit mass. From this single surface it derives 1X2
probabilities, Over 2.5 goals, Both Teams To Score, and the modal scoreline in one pass. The
same kernel runs in the Python pipeline and the in-browser JS utility so the
public terminal and the SaaS application can never diverge.

### 2.2 Market De-Vigging

Consensus decimal prices carry bookmaker overround. The engine strips it proportionally to recover
synthetic true probabilities:

```text
p_outcome = (1 / o_outcome) / Σ (1 / o_j) over all outcomes
EV        = p_model × o_market − 1
```

A position is flagged only when the model probability beats the de-vigged market price through a
margin-of-safety screen. Guardrails bound every flag: decimal odds within `[1.25, 12.0]`, model
probability at least 15%, and expected value confined to the `[2%, 35%]` credibility band.
Calibration is scored on the record: the engine computes the multi-class Brier score over
settled 1X2 probabilities and aggregates win rate and ROI across rolling settlement windows.

### 2.3 Fractional Kelly Capital Allocation

Position sizing follows constrained Quarter-Kelly:

```text
f*  = (b·p − q) / b                b = decimal odds − 1, p = model probability, q = 1 − p
stake = min( ¼ · f*, 2.5% )       hard cap on every call site
negative EV ⇒ stake = 0%          absolute truncation
```

The 2.5% bankroll cap is enforced identically in the pipeline, the Kelly calculator, and the parlay
engine. Negative-expectation inputs always resolve to a zero stake.

### 2.4 Scoreline Variance & Bankroll Simulation

Two mechanisms make risk legible rather than asserted:

- **Joint scoreline variance**: the same 6×6 surface that produces probabilities assigns explicit
  mass to each of the 36 possible outcomes, which the in-app heatmap renders for inspection.
- **Bankroll simulation on settled history**: the replay engine sorts every settled value pick
  chronologically and reconstructs the equity curve under two regimes, flat 1-unit staking and
  quarter-Kelly sizing. The resulting win rate, ROI, and Brier figures are deterministic replays
  of official results, not projections or simulated histories.

---

## 3. Subscription Tier Ladder

Access is derived server-side from a single protected profile row; no client state can upgrade a
tier. Pricing displays are driven by environment configuration shared between the pricing
architecture page and the in-app subscription desk, with production defaults built in.

| Tier | Default Rate | Horizon | Quant Suite |
| --- | --- | --- | --- |
| **Starter** | Rp 0 | Daily horizon (today) | Core 1X2 probabilities, standard analytics, community telemetry. |
| **Pro Pass** | Rp 149.000 / bln | 7-day horizon (weekly) | Full +EV scanner, 6×6 scoreline heatmaps, fractional Kelly calculator, smart parlay engine. |
| **Season Pass** | Rp 999.000 / thn | 30-day full horizon | Complete historical backtest archives, model ledger, direct priority support desk. |

Activation routes through configured payment gateway links (with the signed-in email attached as
the customer identifier) or a manual confirmation flow, and completes exclusively under the
service role.

---

## 4. Local Development & Quality Verification

### 4.1 Environment Configuration

Pipeline configuration mirrors `.env.example` at the repository root:

| Key | Purpose |
| --- | --- |
| `FOOTBALL_DATA_TOKEN` | Fixture telemetry credential |
| `ODDS_API_KEY` | Consensus market feed credential |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Datastore address and privileged write credential |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Situation report delivery (optional; omit to disable) |

Frontend configuration mirrors `frontend/.env.example`: `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` are required; subscription pricing, gateway links, and the confirmation
channel are optional and documented inline in that file.

### 4.2 Test Gates

```bash
pip install -r scripts/requirements.txt

# Full suite: 33 tests (engine integrity + settlement/calibration evaluators)
python -m pytest scripts/tests/ -v

# Single file, or single test
python -m pytest scripts/tests/test_engine.py -v
python -m pytest scripts/tests/test_evaluator.py::test_name -v
```

The engine suite locks the invariant surface: bounded finite lambdas, unit-normalized joint
matrices, guarded divisions, EV guardrail boundaries, and the 2.5% Kelly cap at every entry point.

```bash
# Frontend
cd frontend
npm install
npm run dev     # http://localhost:5173 (showcase view in development)
npm run build   # production build gate, service worker + PWA manifest generated
```

Pipeline entry points for local runs from `scripts/`: `sync_standings.py`,
`sync_monthly_fixtures.py`, and `sync_daily.py` (complete quant loop: market capture, engine,
value detection, settlement, situation report). The market capture step enforces its own call-rate
throttle for the upstream free tier; preserve it when running locally.

---

## 5. Regulatory & Responsible Analytics Notice

Strictly 18+. Matchlytics provides quantitative mathematical estimates for informational and
risk-management purposes only, not financial guarantees. Model outputs are statistical risk
estimations derived from historical results and consensus market structure; they are not
predictions, investment advice, or promises of any outcome. Exercise disciplined bankroll
management: the sizing framework published in Section 2 caps exposure precisely because variance
is the dominant risk in outcome markets. Matchlytics is an independent project and is not
affiliated with any league, broadcaster, operator, or market maker.

---

<div align="center">

© 2026 Matchlytics by imortifex. All rights reserved.

[Public Terminal Showcase](https://imortifex.me) · [SaaS Application](https://app.imortifex.me) ·
[License (MIT)](LICENSE)

</div>
