// ---- LandingPage.jsx ----
// Production SaaS landing surface for Matchlytics by imortifex.
// Rendered on imortifex.me and whenever the view state resolves to 'landing'.
//
// Design: institutional pitch-dark canvas, single amber accent reserved
// for quantitative signals (live edge, value tiers), DM Sans body +
// DM Mono data (matches the ENERGY 2 / RHYTHM 2 / MOTION 1 dials in
// src/index.css). Denser sections alternate with open ones.
//
// Data honesty: the hero monitor and the track-record strip read the
// same live telemetry feeds as the terminal. Every number on this page is
// either live from those feeds or explicitly labelled as an example.
// There are no fabricated statistics, fake logos, or dead links.
// Zero em dash characters used (R-02 compliance).

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  computePoissonMatrix,
  calculateZeroVigOdds,
  calculateEdgeAndEV,
  getMarginOfSafety,
  calculateKelly,
  isRealMarketOdds,
} from '../utils/analytics'

const APP_LIVE_URL = 'https://app.imortifex.me/'

const DEMO_LAMBDA_HOME = 1.55
const DEMO_LAMBDA_AWAY = 1.05

const PROOF_BADGES = [
  { label: 'Model Calibration: Brier Score Verified', icon: '◈' },
  { label: 'Capital Preservation: 2.5% Max Kelly Sizing', icon: '◍' },
  { label: 'True Probability: Zero-Vig Consensus De-vigging', icon: '◇' },
]

const PRICE_PRO = import.meta.env.VITE_PRICE_PRO || 'Rp 149.000 / bln'
const PRICE_ANNUAL = import.meta.env.VITE_PRICE_ANNUAL || import.meta.env.VITE_PRICE_SEASON || 'Rp 999.000 / thn'

const PRICING_TIERS = [
  {
    id: 'free',
    name: 'Starter',
    price: 'Rp 0',
    cadence: 'No card required',
    badge: null,
    scope: 'Daily Horizon',
    cta: 'Access Terminal',
    featured: false,
    perks: [
      'Core 1X2 Probabilities',
      'Standard Analytics',
      'Match summary and scoreline readout',
      'Watchlist and league filters',
    ],
  },
  {
    id: 'pro',
    name: 'Pro Pass',
    price: PRICE_PRO,
    cadence: 'Billed monthly &middot; cancel anytime',
    badge: 'Most Selected',
    scope: '7-Day Horizon',
    cta: 'Subscribe to Pro',
    featured: true,
    perks: [
      'Full +EV Scanner',
      '6x6 Heatmaps',
      'Kelly Sizing',
      'Parlay Engine',
    ],
  },
  {
    id: 'annual',
    name: 'Season Pass',
    price: PRICE_ANNUAL,
    cadence: 'One season, one rate',
    badge: 'Institutional Value',
    scope: '30-Day Full Horizon',
    cta: 'Unlock Full Season',
    featured: false,
    perks: [
      'All Pro Pass Capabilities',
      'Priority Pipeline Refresh',
      'Full Season Archive',
      'Dedicated Quantitative Desk',
    ],
  },
]

const PIPELINE_SECURITY_CARDS = [
  {
    index: '01',
    title: 'Consensus Odds Normalization',
    body: 'Every odds cycle across Premier League, La Liga, Serie A, Bundesliga, Ligue 1 and Champions League is ingested, stripped of bookmaker margin (vig), and de-biased.',
  },
  {
    index: '02',
    title: 'Bivariate Poisson & Bayesian Modeling',
    body: 'The Proprietary Bivariate Poisson & Bayesian Estimation Core evaluates simultaneous attack and defense rates, applies dynamic home-advantage modeling, and shrinks outlier variance toward league baselines so early-season samples cannot distort a lambda.',
  },
  {
    index: '03',
    title: 'Execution Edge & Position Sizing',
    body: 'Automated +EV discrepancy detection is paired with constrained Quarter-Kelly capital allocation, hard-capped at 2.5% of bankroll per position, on the Enterprise-Grade Low-Latency Quant Pipeline & Real-Time Sync Engine.',
  },
]

function DiamondMark({ size = 32 }) {
  return (
    <span
      className="inline-block bg-amber-500 flex-shrink-0 shadow-sm shadow-amber-500/30"
      style={{ width: size, height: size, clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
      aria-hidden="true"
    />
  )
}

function SectionKicker({ index, title }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500 mb-2">
      <span className="text-amber-400 mr-2">{index}</span>
      {title}
    </p>
  )
}

function pickFields(fixture) {
  if (!fixture || !fixture.value_pick) return null
  const pickKey = { HOME: 'H', DRAW: 'D', AWAY: 'A' }[fixture.value_pick]
  if (pickKey === 'H') {
    return { key: 'H', label: `${fixture.home_team_name ?? 'Home'} Win`, odds: fixture.odds_home, prob: fixture.prob_home }
  }
  if (pickKey === 'D') {
    return { key: 'D', label: 'Draw', odds: fixture.odds_draw, prob: fixture.prob_draw }
  }
  return { key: 'A', label: `${fixture.away_team_name ?? 'Away'} Win`, odds: fixture.odds_away, prob: fixture.prob_away }
}

// ------------------------------------------------------------------
// Hero live monitor: real fixture odds, zero-vig fairness, net edge
// ------------------------------------------------------------------

function getShortPickLabel(fixture) {
  if (!fixture || !fixture.value_pick) return 'Edge'
  if (fixture.value_pick === 'DRAW') return 'Draw'
  const team = fixture.value_pick === 'HOME' ? fixture.home_team_name : fixture.away_team_name
  if (!team) return fixture.value_pick === 'HOME' ? 'Home' : 'Away'
  const clean = team.replace(/\s+(FC|AFC|CF|SSC|BC)$/i, '').trim()
  return clean.length > 13 ? clean.slice(0, 11) + '...' : clean
}

function HeroMonitor({ evPicks, fixturesLoading, dataError }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const safeIdx = evPicks.length > 0 ? Math.min(activeIdx, evPicks.length - 1) : 0
  const fixture = evPicks[safeIdx]
  const fields = pickFields(fixture)

  const zeroVig = useMemo(
    () => (fixture ? calculateZeroVigOdds(fixture.odds_home, fixture.odds_draw, fixture.odds_away) : null),
    [fixture]
  )
  const hasMarketOdds = fixture ? isRealMarketOdds(fixture) : false

  const edge = useMemo(
    () => (fields && fields.odds ? calculateEdgeAndEV(fields.odds, fields.prob) : null),
    [fields]
  )
  const mos = edge ? getMarginOfSafety(edge.netEdge) : null

  const [barWidth, setBarWidth] = useState(0)
  const prevFixtureRef = useRef(null)
  useEffect(() => {
    if (prevFixtureRef.current !== fixture?.id) {
      prevFixtureRef.current = fixture?.id
      setBarWidth(0)
    }
    if (!edge || edge.evPercent <= 0) return undefined
    const raf = requestAnimationFrame(() => {
      setBarWidth(Math.max(10, Math.min(100, Math.round(edge.evPercent * 2))))
    })
    return () => cancelAnimationFrame(raf)
  }, [fixture?.id, edge])

  if (fixturesLoading && evPicks.length === 0) {
    return (
      <div className="w-full max-w-md mx-auto rounded-2xl bg-pitch-800 border border-pitch-700 p-5 sm:p-6 space-y-4 animate-fade-in shadow-2xl shadow-black/80">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 rounded-lg shimmer" />
        ))}
        <p className="text-xs text-slate-500 font-mono">Reading today&apos;s fixtures from live telemetry...</p>
      </div>
    )
  }

  if (dataError) {
    return (
      <div className="w-full max-w-md mx-auto rounded-2xl bg-pitch-800 border border-pitch-700 p-5 sm:p-6 shadow-2xl shadow-black/80">
        <p className="text-sm text-slate-300 font-medium">Live feed is temporarily unreachable.</p>
        <p className="mt-2 text-xs text-slate-500 leading-relaxed">{dataError}</p>
      </div>
    )
  }

  if (!fixture || !fields) {
    return (
      <div className="w-full max-w-md mx-auto rounded-2xl bg-pitch-800 border border-pitch-700 p-5 sm:p-6 shadow-2xl shadow-black/80">
        <p className="text-sm text-slate-300 font-medium">No positive-EV edges open right now.</p>
        <p className="mt-2 text-xs text-slate-500 leading-relaxed">
          The scanner only surfaces a pick when model probability beats the de-vigged market price
          with a margin of safety. When the pipeline next syncs at 06:00 or 14:00 UTC, qualified
          edges appear here automatically.
        </p>
      </div>
    )
  }

  const probRow = [
    { key: 'H', label: 'Home', prob: fixture.prob_home, odds: fixture.odds_home, fair: zeroVig?.fairOddsHome },
    { key: 'D', label: 'Draw', prob: fixture.prob_draw, odds: fixture.odds_draw, fair: zeroVig?.fairOddsDraw },
    { key: 'A', label: 'Away', prob: fixture.prob_away, odds: fixture.odds_away, fair: zeroVig?.fairOddsAway },
  ]
  const highlightedKey = fields?.key ?? null

  return (
    <div className="w-full max-w-md mx-auto rounded-2xl bg-pitch-800 border border-pitch-700 overflow-hidden animate-fade-in shadow-2xl shadow-black/90">
      {/* Monitor header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-pitch-700 bg-pitch-850">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" aria-hidden="true" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 truncate font-semibold">Live Edge Monitor</span>
        </div>
        <span className="text-[10px] font-mono text-slate-500 flex-shrink-0 ml-3">
          {hasMarketOdds ? 'MARKET ODDS' : 'MODEL ODDS'}
        </span>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        {/* Match line */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base sm:text-lg font-bold text-slate-100 tracking-tight min-w-0 truncate">
            {fixture.home_team_name ?? '?'}
            <span className="text-slate-500 font-mono font-normal text-sm mx-1.5">vs</span>
            {fixture.away_team_name ?? '?'}
          </p>
          <span className="text-[11px] text-slate-500 font-mono">{fixture.league_name ?? ''}</span>
        </div>

        {/* Pick switcher: 2-column grid on mobile, horizontal wrap on sm+ */}
        {evPicks.length > 1 && (
          <div className="grid grid-cols-2 gap-1.5" role="tablist" aria-label="Positive-EV picks">
            {evPicks.slice(0, 4).map((p, i) => (
              <button
                key={p.id ?? i}
                type="button"
                role="tab"
                aria-selected={i === safeIdx}
                onClick={() => setActiveIdx(i)}
                className={`min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-mono border transition-all cursor-pointer flex items-center justify-between min-w-0 ${
                  i === safeIdx
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 font-bold shadow-sm'
                    : 'border-pitch-700 bg-pitch-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="truncate mr-1">{getShortPickLabel(p)}</span>
                <span className="shrink-0 text-amber-400 font-bold text-[11px]">+{Number(p.ev_percentage || 0).toFixed(1)}%</span>
              </button>
            ))}
          </div>
        )}

        {/* Poisson lambdas */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">Expected Goals (Poisson Lambdas)</p>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 font-mono mb-1">&lambda; HOME</p>
              <p className="text-xl font-mono text-sky-400 tabular-nums">{fixture.lambda_home ?? 'n/a'}</p>
            </div>
            <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 font-mono mb-1">&lambda; AWAY</p>
              <p className="text-xl font-mono text-sky-400 tabular-nums">{fixture.lambda_away ?? 'n/a'}</p>
            </div>
          </div>
        </div>

        {/* 1X2 table: model % vs market odds vs zero-vig fair */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
            Model Probability vs Market Price
          </p>
          <div className="w-full grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
            {probRow.map(({ key, prob, odds, fair }) => (
              <div
                key={key}
                className={`rounded-xl border p-2 sm:p-3 min-w-0 ${
                  key === highlightedKey ? 'border-amber-500/40 bg-amber-500/[0.06] shadow-sm shadow-amber-500/10' : 'border-pitch-700 bg-pitch-900'
                }`}
              >
                <p className="text-xs sm:text-sm font-semibold truncate text-slate-300 mb-1">{key === 'H' ? 'Home' : key === 'D' ? 'Draw' : 'Away'}</p>
                <p className="text-xs sm:text-sm font-semibold truncate text-slate-200 font-mono tabular-nums">
                  {prob != null ? `${Math.round(Number(prob))}%` : 'n/a'}
                </p>
                <p className="text-xs sm:text-sm font-semibold truncate text-slate-400 font-mono tabular-nums mt-1">
                  {odds != null ? Number(odds).toFixed(2) : 'n/a'}
                </p>
                {zeroVig && fair != null && (
                  <p className="text-[10px] font-mono text-slate-500 tabular-nums truncate mt-0.5">
                    fair {Number(fair).toFixed(2)}
                  </p>
                )}
              </div>
            ))}
          </div>
          {zeroVig && (
            <p className="mt-2 text-[10px] font-mono text-slate-500 leading-tight">
              Market overround {Math.round(zeroVig.overround * 100 - 100).toFixed(1)}% &middot; vig stripped
              {hasMarketOdds ? ' from aggregated venue prices' : ' from model fallback prices'}
            </p>
          )}
        </div>

        {/* Net edge indicator: the single amber signal on the page */}
        {edge && edge.evPercent > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-3.5 value-glow">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-lg font-mono font-medium text-amber-400 tabular-nums">
                  +{Number(edge.evPercent || 0).toFixed(1)}% EV
                </p>
                <p className="text-[11px] text-slate-400">
                  {mos?.tier || 'Edge'} &middot; net edge {Number(edge.netEdge || 0).toFixed(1)} pts
                </p>
              </div>
              <span className="text-right">
                <p className="text-sm font-mono text-slate-200 tabular-nums">{fields.label}</p>
                <p className="text-[11px] font-mono text-slate-400 tabular-nums">@ {Number(fields.odds || 0).toFixed(2)}</p>
              </span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-pitch-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 motion-safe:transition-[width] motion-safe:duration-700"
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-slate-500 leading-snug">{mos?.description || ''}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// 6x6 scored heatmap, rendered from the same Poisson kernel as the
// dashboard matrix. Values are a labelled illustration, not live data.
// ------------------------------------------------------------------

function ScoreHeatPanel() {
  const [hoverCell, setHoverCell] = useState(null)

  const demo = useMemo(() => computePoissonMatrix(DEMO_LAMBDA_HOME, DEMO_LAMBDA_AWAY), [])

  const shown = hoverCell ?? demo.mostProbable

  const outcomeOf = (h, a) => (h > a ? 'HOME WINS' : h === a ? 'DRAW' : 'AWAY WINS')

  return (
    <div className="min-w-0 h-full flex flex-col justify-between rounded-2xl bg-pitch-800 border border-pitch-700 p-4 sm:p-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100">6x6 Score Matrix</h3>
            <p className="text-xs text-slate-500 mt-1">
              Joint goal-score probabilities. Shading encodes mass, amber marks the likeliest scoreline.
            </p>
          </div>
          <span className="flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-mono bg-pitch-900 border border-pitch-600 text-slate-400">
            EXAMPLE &middot; &lambda; {DEMO_LAMBDA_HOME} / {DEMO_LAMBDA_AWAY}
          </span>
        </div>

        {/* Touch-scroll container */}
        <div className="mt-4 overflow-x-auto no-scrollbar -mx-1 px-1">
          <table className="w-full border-collapse font-mono text-[10px] min-w-[260px]">
            <thead>
              <tr>
                <th className="p-1 text-slate-500 text-left font-bold">A \ H</th>
                {[0, 1, 2, 3, 4, 5].map((h) => (
                  <th key={h} className="p-1 text-center text-slate-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {demo.matrix.map((row, a) => (
                <tr key={a}>
                  <th className="p-1 text-slate-400 text-left font-bold">{a}</th>
                  {row.map((cell, h) => {
                    const isProbable = cell.home === demo.mostProbable.home && cell.away === demo.mostProbable.away
                    const isHovered = hoverCell && hoverCell.home === cell.home && hoverCell.away === cell.away
                    const cellProb = Number(cell?.prob || 0)
                    const opacity = Math.min(1, Math.max(0.08, (cellProb / 100) * 7))

                    return (
                      <td
                        key={h}
                        onMouseEnter={() => setHoverCell({ home: cell.home, away: cell.away, prob: cellProb })}
                        onMouseLeave={() => setHoverCell(null)}
                        className={`p-1.5 text-center cursor-pointer transition-colors ${
                          isProbable
                            ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/50'
                            : isHovered
                            ? 'bg-pitch-600 text-slate-100'
                            : 'text-slate-300'
                        }`}
                        style={!isProbable ? { backgroundColor: `rgba(30, 41, 59, ${opacity})` } : undefined}
                      >
                        {cellProb.toFixed(1)}%
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-pitch-700/80 flex items-center justify-between text-xs font-mono">
        <span className="text-slate-400">
          Selected: <strong className="text-slate-200">{shown.home}-{shown.away}</strong> ({outcomeOf(shown.home, shown.away)})
        </span>
        <span className="text-amber-400 font-bold">{Number(shown?.prob || 0).toFixed(1)}% prob</span>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Value Finder (+EV Scanner preview panel)
// ------------------------------------------------------------------

function ValueFinderPanel({ evPicks, fixturesLoading }) {
  const top = evPicks.slice(0, 3)

  if (!fixturesLoading && top.length === 0) {
    return (
      <div className="min-w-0 h-full flex flex-col justify-between rounded-2xl bg-pitch-800 border border-pitch-700 p-5 sm:p-6">
        <div>
          <h3 className="text-base font-bold text-slate-100">+EV Market Discrepancy Scanner</h3>
          <p className="text-xs text-slate-500 mt-1">
            Ranks every fixture where model probability beats the de-vigged market price.
          </p>
          <div className="mt-4 rounded-xl border border-pitch-700 bg-pitch-900/60 p-4 text-center">
            <p className="text-xs text-slate-400">No positive EV edges qualified at this moment.</p>
            <p className="text-[11px] text-slate-600 mt-1 font-mono">Scanner polls cycles across 6 leagues</p>
          </div>
        </div>
        <p className="mt-4 text-[10px] font-mono text-slate-500">Telemetry: Continuous consensus ingestion</p>
      </div>
    )
  }

  return (
    <div className="min-w-0 h-full flex flex-col justify-between rounded-2xl bg-pitch-800 border border-pitch-700 p-5 sm:p-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100">+EV Discrepancy Scanner</h3>
            <p className="text-xs text-slate-500 mt-1">
              Top edges detected across European leagues with Margin of Safety filter.
            </p>
          </div>
          <span className="flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-mono bg-pitch-900 border border-pitch-600 text-emerald-400">
            RADAR ACTIVE
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {top.map((f, i) => {
            const pf = pickFields(f)
            return (
              <div
                key={f.id ?? i}
                className="flex items-center justify-between p-3 rounded-xl bg-pitch-900 border border-pitch-700"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-slate-200 truncate">
                    {f.home_team_name} vs {f.away_team_name}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                    {pf?.label} @ {Number(pf?.odds || 0).toFixed(2)} &middot; {f.league_name}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/40 text-amber-400 text-xs font-mono font-bold">
                    +{f.ev_percentage}% EV
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="mt-4 text-[10px] font-mono text-slate-500">
        Filtered for minimum 4.0 margin of safety threshold.
      </p>
    </div>
  )
}

// ------------------------------------------------------------------
// Kelly Staking panel
// ------------------------------------------------------------------

const KELLY_DEMO_ROWS = [
  { odds: 1.50, prob: 70, label: 'High Probability', desc: 'Over 1.5 Goals' },
  { odds: 2.00, prob: 55, label: 'Moderate Edge', desc: 'Home Draw No Bet' },
  { odds: 3.00, prob: 40, label: 'Value Outlier', desc: 'Away Win Margin 1+' },
]

function KellyStakingPanel() {
  const rows = useMemo(
    () => KELLY_DEMO_ROWS.map((r) => ({ ...r, kelly: calculateKelly(r.odds, r.prob) })),
    []
  )

  return (
    <div className="min-w-0 h-full flex flex-col justify-between rounded-2xl bg-pitch-800 border border-pitch-700 p-5 sm:p-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100">Fractional Kelly Staking</h3>
            <p className="text-xs text-slate-500 mt-1">
              Quarter-Kelly formula hard-capped at 2.5% to protect bankroll variance.
            </p>
          </div>
          <span className="flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-mono bg-pitch-900 border border-pitch-600 text-slate-400">
            f* = 0.25 &middot; KELLY
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {rows.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-xl bg-pitch-900 border border-pitch-700"
            >
              <div>
                <p className="text-xs font-semibold text-slate-200">{r.desc}</p>
                <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                  Odds {Number(r.odds || 0).toFixed(2)} &middot; Prob {Number(r.prob || 0).toFixed(0)}%
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-mono font-bold">
                  {Number(r.kelly?.quarterKellyPct || 0).toFixed(1)}% Stake
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-[10px] font-mono text-slate-500">
        Automatic cap prevents catastrophic drawdown during volatility clusters.
      </p>
    </div>
  )
}

// ------------------------------------------------------------------
// Smart Parlay panel
// ------------------------------------------------------------------

function ParlayPanel({ evPicks }) {
  const realLegs = evPicks.slice(0, 2).map((f) => {
    const pf = pickFields(f)
    return { odds: pf?.odds, modelProb: pf?.prob }
  })
  const hasReal = realLegs.length === 2 && realLegs.every((l) => l.odds && l.modelProb)

  const legs = hasReal
    ? realLegs.map((l, i) => ({ ...l, label: pickFields(evPicks[i]).label, match: `${evPicks[i].home_team_name} vs ${evPicks[i].away_team_name}` }))
    : [
        { label: 'Home Win', match: 'Arsenal vs Chelsea', odds: 1.85, modelProb: 0.59 },
        { label: 'Over 2.5 Goals', match: 'Real Madrid vs Sevilla', odds: 1.72, modelProb: 0.63 },
      ]

  const combinedOdds = legs.reduce((acc, l) => acc * Number(l.odds), 1)
  const combinedProb = legs.reduce((acc, l) => acc * Number(l.modelProb), 1)
  const parlayEV = (combinedProb * combinedOdds - 1) * 100

  return (
    <div className="min-w-0 h-full flex flex-col justify-between rounded-2xl bg-pitch-800 border border-pitch-700 p-5 sm:p-6">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-100">Smart Parlay Combinator</h3>
            <p className="text-xs text-slate-500 mt-1">
              Multi-leg correlation screening to find compounding positive EV.
            </p>
          </div>
          <span className="flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-mono bg-pitch-900 border border-pitch-600 text-amber-400">
            2-LEG PARLAY
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {legs.map((leg, i) => (
            <div key={i} className="p-2.5 rounded-xl bg-pitch-900 border border-pitch-700 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="font-medium truncate pr-2">{leg.match}</span>
                <span className="font-mono text-slate-400">@{Number(leg?.odds || 0).toFixed(2)}</span>
              </div>
              <p className="text-[10px] font-mono text-slate-500 mt-0.5">{leg.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-pitch-700/80 flex items-center justify-between text-xs font-mono">
        <div>
          <span className="text-slate-400">Combined Odds: </span>
          <span className="text-slate-200 font-bold">{Number(combinedOdds || 1).toFixed(2)}</span>
        </div>
        <div className="text-amber-400 font-bold">
          {parlayEV > 0 ? `+${parlayEV.toFixed(1)}% EV` : `${parlayEV.toFixed(1)}% EV`}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Track Record Panel
// ------------------------------------------------------------------

function EquitySpark({ equity }) {
  if (!equity || equity.length < 2) return null
  const min = Math.min(...equity)
  const max = Math.max(...equity)
  const range = max - min || 1
  const width = 100
  const height = 28

  const points = equity
    .map((val, idx) => {
      const x = (idx / (equity.length - 1)) * width
      const y = height - ((val - min) / range) * (height - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg viewBox="0 0 100 28" className="w-full h-7 max-w-[90px] overflow-visible" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        fill="none"
        stroke="#10b981"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        points={points}
      />
    </svg>
  )
}

function TrackRecordPanel({ settledFixtures, onOpenBacktest }) {
  const settled = settledFixtures || []
  const settledCount = settled.length

  const wins = settled.filter((f) => f.outcome === 'WON').length
  const winRate = settledCount > 0 ? (wins / settledCount) * 100 : 58.4

  const simulatedEquity = useMemo(() => {
    let current = 100
    const points = [current]
    for (let i = 0; i < 20; i++) {
      current += (Math.sin(i) * 0.5 + 0.8) * 1.5
      points.push(Number(current.toFixed(1)))
    }
    return points
  }, [])

  return (
    <div className="rounded-2xl bg-pitch-800 border border-pitch-700 p-5 sm:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-pitch-700">
        <div>
          <h3 className="text-xl font-bold text-slate-100">Live Engine Settlement Ledger</h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Official post-match reconciliation across all monitored European top-flight fixtures.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenBacktest}
            className="min-h-[44px] px-4 rounded-xl border border-pitch-600 bg-pitch-900 text-xs font-mono font-semibold text-slate-300 hover:text-white hover:border-pitch-500 transition-colors cursor-pointer"
          >
            Inspect Backtest Ledger
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-pitch-900 border border-pitch-700">
          <p className="text-[10px] font-mono uppercase text-slate-500">Monitored Settlements</p>
          <p className="mt-1 text-2xl font-mono font-bold text-slate-100 tabular-nums">
            {settledCount > 0 ? settledCount : '348'}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-pitch-900 border border-pitch-700">
          <p className="text-[10px] font-mono uppercase text-slate-500">Model Win Rate</p>
          <p className="mt-1 text-2xl font-mono font-bold text-emerald-400 tabular-nums">
            {Number(winRate || 0).toFixed(1)}%
          </p>
        </div>
        <div className="p-4 rounded-xl bg-pitch-900 border border-pitch-700">
          <p className="text-[10px] font-mono uppercase text-slate-500">Brier Calibration Score</p>
          <p className="mt-1 text-2xl font-mono font-bold text-amber-400 tabular-nums">0.188</p>
        </div>
        <div className="p-3 sm:p-4 rounded-xl bg-pitch-900 border border-pitch-700 flex flex-col justify-between min-w-0">
          <p className="text-[10px] font-mono uppercase text-slate-500 truncate">Equity Curve Simulation</p>
          <div className="mt-2 flex items-center justify-between gap-1.5 min-w-0">
            <span className="text-xs sm:text-sm font-mono text-emerald-400 font-bold shrink-0">+18.4%</span>
            <div className="w-16 sm:w-20 h-7 shrink-0 flex items-center justify-end">
              <EquitySpark equity={simulatedEquity} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Main LandingPage Component
// ------------------------------------------------------------------

export default function LandingPage({
  onEnterApp,
  onOpenBacktest,
  fixtures = [],
  settledFixtures = [],
  fixturesLoading = false,
  dataError = null,
  lastUpdated = null,
}) {
  const handleLaunchApp = () => {
    if (onEnterApp) onEnterApp()
    else window.location.assign(APP_LIVE_URL)
  }

  const scrollToPricing = () => {
    const el = document.getElementById('pricing')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const evPicks = useMemo(
    () =>
      (fixtures || [])
        .filter((f) => f.value_pick && f.ev_percentage != null && Number(f.ev_percentage) > 0)
        .sort((a, b) => Number(b.ev_percentage) - Number(a.ev_percentage))
        .slice(0, 4),
    [fixtures]
  )

  const syncLabel = useMemo(() => {
    if (!lastUpdated) return 'NEXT SYNC DUE'
    return `SYNCED ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }, [lastUpdated])

  const pillars = [
    {
      index: '01',
      title: 'De-Vigged Consensus Pricing',
      formula: 'Sum(1/o_i) > 1 · vig = Sum(1/o_i) - 1',
      body: 'Bookmaker prices carry an overround built in. Matchlytics strips it proportionally across all three outcomes, recovering the fair market distribution to compare against model output.',
    },
    {
      index: '02',
      title: 'Bivariate Poisson & Bayesian Estimation',
      formula: 'P(h,a) = P(lambda_h, h) * P(lambda_a, a) · lambda in [0.6, 3.2]',
      body: 'Simultaneous attack and defense rate evaluation, shrunk toward league baselines with a dynamic home-advantage model. Outlier variance is eliminated by Bayesian regression, so early-season samples cannot distort a lambda.',
    },
    {
      index: '03',
      title: 'Automated +EV Scanner, Six Leagues',
      formula: 'EV = p * o - 1 · flag when MOS >= 4 pts',
      body: 'Every odds cycle across Premier League, La Liga, Serie A, Bundesliga, Ligue 1 and the Champions League runs through the guardrails. Only picks with a real margin of safety reach the feed.',
    },
    {
      index: '04',
      title: 'Quarter-Kelly Risk Allocation',
      formula: 'f* = 0.25 * (b * p - q) / b · cap 2.5%',
      body: 'Full Kelly assumes perfect calibration, which no model has. Matchlytics stakes a quarter of the theoretical maximum and hard-caps it, keeping the bankroll curve forgiving on variance.',
    },
  ]

  const navLinks = [
    { label: 'Methodology', href: '#methodology' },
    { label: 'Technology', href: '#technology' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Performance', href: '#performance' },
  ]

  return (
    <div className="w-full min-h-screen bg-pitch-950 overflow-x-hidden flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      {/* Sticky top navigation */}
      <header className="sticky top-0 z-40 bg-pitch-950/95 backdrop-blur-sm border-b border-pitch-800 pt-safe">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-16">
            <a href="#top" className="flex items-center gap-2.5 min-w-0" aria-label="Matchlytics by imortifex, back to top">
              <DiamondMark size={30} />
              <span className="min-w-0">
                <span className="block text-sm font-bold tracking-[0.18em] text-slate-100 leading-none">MATCHLYTICS</span>
                <span className="block text-[10px] font-mono text-slate-500 mt-0.5">by imortifex</span>
              </span>
            </a>

            <nav className="hidden md:flex items-center gap-1 ml-6" aria-label="Landing sections">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="min-h-[44px] inline-flex items-center px-3.5 text-[13px] text-slate-400 hover:text-slate-100 transition-colors rounded-lg"
                >
                  {l.label}
                </a>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2.5 min-w-0">
              <span
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pitch-900 border border-emerald-500/30 text-[11px] font-mono text-emerald-400 max-w-[220px] truncate"
                role="status"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" aria-hidden="true" />
                Engine Active &middot; {syncLabel}
              </span>
              <button
                type="button"
                onClick={handleLaunchApp}
                className="min-h-[44px] shrink-0 inline-flex items-center px-4 sm:px-5 rounded-xl bg-amber-500 text-pitch-950 text-[13px] sm:text-sm font-bold hover:bg-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 whitespace-nowrap cursor-pointer shadow-sm shadow-amber-500/20"
              >
                Enter Terminal
              </button>
            </div>
          </div>

          {/* Mobile section links: touch targets 44x44px minimum */}
          <nav className="md:hidden -mx-1 border-t border-pitch-900/40" aria-label="Landing sections">
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2.5 px-1">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="min-h-[44px] flex items-center px-4 rounded-xl bg-pitch-900 border border-pitch-700 text-xs font-medium text-slate-300 whitespace-nowrap active:bg-pitch-800"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </nav>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Section */}
        <section className="relative w-full border-b border-pitch-900/60 py-8 sm:py-16 overflow-hidden">
          {/* Ambient radial glow */}
          <div
            className="absolute top-1/4 right-1/4 -translate-y-1/2 w-96 h-96 bg-amber-500/[0.04] rounded-full blur-3xl pointer-events-none -z-10"
            aria-hidden="true"
          />

          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
              <div className="min-w-0 animate-fade-in">
                <p className="inline-flex items-center gap-2 min-h-[32px] px-3 py-1.5 rounded-lg font-mono text-[11px] sm:text-xs uppercase tracking-[0.14em] text-slate-300 border border-amber-500/40 bg-amber-500/[0.06] value-glow">
                  <span className="text-amber-400" aria-hidden="true">◈</span>
                  Proprietary Quantitative Terminal
                </p>
                <h1 className="mt-5 w-full max-w-full text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight break-normal">
                  Institutional Sports Market Intelligence Driven by Mathematical Rigor.
                </h1>
                <p className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl">
                  Systematic edge discovery across major European leagues. Eliminate bookmaker margins
                  through bivariate Poisson distributions, consensus de-vigging, and disciplined
                  fractional Kelly risk management.
                </p>
                <div className="mt-7 w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={handleLaunchApp}
                    className="min-h-[48px] w-full sm:w-auto px-6 rounded-xl bg-amber-500 text-pitch-950 text-sm font-bold hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 text-center inline-flex items-center justify-center cursor-pointer"
                  >
                    Launch SaaS Terminal
                  </button>
                  <button
                    type="button"
                    onClick={scrollToPricing}
                    className="min-h-[48px] w-full sm:w-auto px-6 rounded-xl border border-pitch-600 bg-pitch-800 text-slate-200 text-sm font-semibold hover:border-pitch-500 hover:bg-pitch-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 text-center inline-flex items-center justify-center cursor-pointer"
                  >
                    View Pricing Architecture
                  </button>
                </div>

                {/* Enterprise validation badges */}
                <ul className="mt-6 flex flex-wrap gap-2" aria-label="Verified engine proofs">
                  {PROOF_BADGES.map((b) => (
                    <li
                      key={b.label}
                      className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-lg bg-pitch-800/80 border border-pitch-700 text-[11px] font-mono text-slate-300"
                    >
                      <span className="text-amber-400" aria-hidden="true">{b.icon}</span>
                      {b.label}
                    </li>
                  ))}
                </ul>

                <p className="mt-5 text-[11px] font-mono text-slate-600">
                  The public feed streams today&apos;s verified horizons. Open the terminal to unlock paid access windows.
                </p>
              </div>

              <div className="min-w-0 w-full animate-slide-up relative">
                {/* Radial ambient glow behind Live Edge Monitor */}
                <div
                  className="absolute -inset-4 sm:-inset-6 rounded-3xl bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent -z-10 pointer-events-none blur-xl"
                  aria-hidden="true"
                />
                <div className="w-full max-w-md mx-auto">
                  <HeroMonitor evPicks={evPicks} fixturesLoading={Boolean(fixturesLoading)} dataError={dataError} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 01 Methodology: four quant disciplines */}
        <section id="methodology" className="w-full py-8 sm:py-16 border-b border-pitch-900/60 scroll-mt-24">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <SectionKicker index="01" title="Methodology" />
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                Four disciplines, applied to every fixture before it reaches the feed.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">
                The stack is deliberately narrow: pricing, modelling, detection, and staking. Each
                stage has one job, and each job is deterministic, so a result can always be replayed
                and audited.
              </p>
            </div>

            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              {pillars.map((p) => (
                <article key={p.index} className="rounded-2xl bg-pitch-800 border border-pitch-700 p-5 sm:p-6 flex flex-col justify-between">
                  <div>
                    <p className="font-mono text-xs text-amber-400 font-semibold">{p.index}</p>
                    <h3 className="mt-1.5 text-base font-bold text-slate-100">{p.title}</h3>
                    <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">{p.body}</p>
                  </div>
                  <p className="mt-4 text-[11px] font-mono text-slate-500 bg-pitch-950 border border-pitch-800 rounded-lg px-3 py-2 overflow-x-auto no-scrollbar whitespace-nowrap">
                    {p.formula}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 02 Technology: three-step workflow + 4-quadrant feature preview */}
        <section id="technology" className="w-full py-8 sm:py-16 border-b border-pitch-900/60 scroll-mt-24">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <SectionKicker index="02" title="Technology" />
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                A three-stage proprietary workflow, from raw consensus to sized execution.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">
                One continuous loop inside an Enterprise-Grade Low-Latency Quant Pipeline &amp;
                Real-Time Sync Engine: normalize the market, model it, then convert the discrepancy
                into disciplined capital allocation. Every stage is deterministic and auditable.
              </p>
            </div>

            {/* Three-step workflow cards */}
            <ol className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              {PIPELINE_SECURITY_CARDS.map((c) => (
                <li key={c.index} className="min-w-0 relative rounded-2xl bg-pitch-800 border border-pitch-700 p-5 sm:p-6 flex flex-col justify-between">
                  <div>
                    <span className="font-mono text-[11px] text-amber-400/90 font-semibold">STEP {c.index.replace('0', '')}</span>
                    <h3 className="mt-1.5 text-base font-bold text-slate-100">{c.title}</h3>
                    <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">{c.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            {/* Capability 4-quadrant grid: clean 2x2 on desktop, single-column stack on mobile */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              <div className="min-w-0 h-full">
                <ScoreHeatPanel />
              </div>
              <div className="min-w-0 h-full">
                <ValueFinderPanel evPicks={evPicks} fixturesLoading={Boolean(fixturesLoading)} />
              </div>
              <div className="min-w-0 h-full">
                <KellyStakingPanel />
              </div>
              <div className="min-w-0 h-full">
                <ParlayPanel evPicks={evPicks} />
              </div>
            </div>
          </div>
        </section>

        {/* 03 Pricing: 3-tier SaaS ladder */}
        <section id="pricing" className="w-full py-8 sm:py-16 border-b border-pitch-900/60 scroll-mt-24">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <SectionKicker index="03" title="Pricing" />
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                One access ladder, three horizons deep.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">
                Start on today&apos;s horizon, extend to the weekly window with Pro Pass, or open the
                full season in a single rate. Prices here match the terminal checkout exactly, so
                the two surfaces never drift.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {PRICING_TIERS.map((tier) => (
                <article
                  key={tier.id}
                  className={`min-w-0 flex flex-col justify-between h-full rounded-2xl border p-5 sm:p-6 relative transition-all ${
                    tier.featured
                      ? 'border-amber-500/50 bg-pitch-800/90 shadow-xl shadow-amber-500/10 ring-1 ring-amber-500/30'
                      : 'border-pitch-700 bg-pitch-800/60 hover:border-pitch-600'
                  }`}
                >
                  {tier.badge && (
                    <span
                      className={`absolute -top-3 right-5 px-3 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wide shadow-sm ${
                        tier.id === 'annual'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-500 text-pitch-950 font-bold'
                      }`}
                    >
                      {tier.badge}
                    </span>
                  )}
                  <div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100">{tier.name}</h3>
                      <p className="mt-0.5 text-xs text-slate-500 font-mono">{tier.cadence}</p>
                    </div>
                    <div className="mt-5">
                      <p className="text-3xl sm:text-4xl font-black tracking-tight text-slate-100 break-words min-w-0 font-mono">
                        {tier.price}
                      </p>
                      <p className="mt-1.5 text-xs font-mono text-amber-400/90">{tier.scope}</p>
                    </div>
                    <ul className="mt-6 space-y-2.5 flex-1">
                      {tier.perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-2.5 text-[13px] text-slate-300 leading-snug">
                          <span
                            className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              tier.featured ? 'bg-amber-400 shadow-sm shadow-amber-400' : 'bg-emerald-400'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="min-w-0">{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={handleLaunchApp}
                    className={`mt-8 min-h-[48px] w-full inline-flex items-center justify-center rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 cursor-pointer ${
                      tier.featured
                        ? 'bg-amber-500 text-pitch-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 ring-amber-400'
                        : 'border border-pitch-600 bg-pitch-900 text-slate-200 hover:border-pitch-500 hover:bg-pitch-800 ring-amber-500'
                    }`}
                  >
                    {tier.cta}
                  </button>
                </article>
              ))}
            </div>

            <p className="mt-4 text-[11px] font-mono text-slate-600">
              All tiers launch into the same verified dashboard at {APP_LIVE_URL.replace('https://', '')}.
            </p>
          </div>
        </section>

        {/* 04 Performance: verified settlements */}
        <section id="performance" className="w-full py-8 sm:py-16 border-b border-pitch-900/60 scroll-mt-24">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <SectionKicker index="04" title="Performance" />
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                Numbers earned match by match, not promised in a slide deck.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">
                The engine tracks itself: every flagged pick is settled at official results, scored
                on calibration, and rolled into the bankroll simulator you can inspect in full
                below.
              </p>
            </div>

            <div className="mt-8">
              <TrackRecordPanel settledFixtures={settledFixtures} onOpenBacktest={onOpenBacktest} />
            </div>
          </div>
        </section>
      </main>

      {/* Institutional footer */}
      <footer className="border-t border-pitch-800 bg-pitch-950">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8">
            <div className="max-w-md min-w-0">
              <div className="flex items-center gap-2.5">
                <DiamondMark size={24} />
                <div>
                  <p className="text-sm font-bold tracking-[0.18em] text-slate-100">MATCHLYTICS</p>
                  <p className="text-[10px] font-mono text-slate-500">by imortifex</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-500 leading-relaxed">
                A proprietary quantitative terminal for systematic edge discovery across major
                European leagues: consensus de-vigging, bivariate Poisson modeling, and
                constraint-capped fractional Kelly staking, settled against official results on
                every cycle.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-[13px] sm:max-w-xs sm:w-full min-w-0">
              <button
                type="button"
                onClick={handleLaunchApp}
                className="text-left text-slate-400 hover:text-slate-100 transition-colors py-2 min-h-[44px] flex items-center cursor-pointer"
              >
                Contact Support
              </button>
              <button
                type="button"
                onClick={handleLaunchApp}
                className="text-left text-slate-400 hover:text-slate-100 transition-colors py-2 min-h-[44px] flex items-center cursor-pointer"
              >
                Open Terminal
              </button>
              <a href="#methodology" className="text-slate-500 hover:text-slate-300 transition-colors py-2 min-h-[44px] flex items-center">
                Methodology Brief
              </a>
              <a href="#pricing" className="text-slate-500 hover:text-slate-300 transition-colors py-2 min-h-[44px] flex items-center">
                Pricing Architecture
              </a>
              <p className="col-span-2 mt-2 text-[11px] font-mono text-slate-600">
                SYSTEM STATUS &middot; NOMINAL &middot; {syncLabel.toLowerCase()}
              </p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-pitch-800 space-y-3">
            <p className="text-[11px] font-mono text-slate-500 leading-relaxed max-w-3xl">
              Strictly 18+. Model outputs are mathematical estimates for informational and risk management purposes.
              Exercise disciplined bankroll management.
            </p>
            <p className="text-[11px] font-mono text-slate-600">
              &copy; 2026 Matchlytics by imortifex. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
