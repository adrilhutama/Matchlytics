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
// same Supabase feeds as the dashboard. Every number on this page is
// either live from those feeds or explicitly labelled as an example.
// There are no fabricated statistics, fake logos, or dead links.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  computePoissonMatrix,
  calculateZeroVigOdds,
  calculateEdgeAndEV,
  getMarginOfSafety,
  calculateParlayAggregates,
  isRealMarketOdds,
  simulateBankroll,
  getBrierTier,
} from '../utils/analytics'

const APP_LIVE_URL = 'https://app.imortifex.me/'
const GITHUB_REPO_URL = 'https://github.com/adrilhutama/Matchlytics'
const GITHUB_ACTIONS_URL = `${GITHUB_REPO_URL}/actions`

// Illustrative expected-goals pair used only for the scored heatmap demo.
const DEMO_LAMBDA_HOME = 1.55
const DEMO_LAMBDA_AWAY = 1.05

// ------------------------------------------------------------------
// Small presentational helpers (defined at module scope so chips and
// panels do not remount on every parent render)
// ------------------------------------------------------------------

function DiamondMark({ size = 32 }) {
  return (
    <span
      className="inline-block bg-amber-500 flex-shrink-0"
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

  // Animate the edge bar from zero on pick change (MOTION 1: one transition).
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
      <div className="rounded-2xl bg-pitch-800 border border-pitch-700 p-5 space-y-4 animate-fade-in">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 rounded-lg shimmer" />
        ))}
        <p className="text-xs text-slate-500 font-mono">Reading today&apos;s fixtures from Supabase...</p>
      </div>
    )
  }

  if (dataError) {
    return (
      <div className="rounded-2xl bg-pitch-800 border border-pitch-700 p-5">
        <p className="text-sm text-slate-300 font-medium">Live feed is temporarily unreachable.</p>
        <p className="mt-2 text-xs text-slate-500 leading-relaxed">{dataError}</p>
      </div>
    )
  }

  if (!fixture || !fields) {
    return (
      <div className="rounded-2xl bg-pitch-800 border border-pitch-700 p-5">
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
    <div className="rounded-2xl bg-pitch-800 border border-pitch-700 overflow-hidden animate-fade-in">
      {/* Monitor header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-pitch-700 bg-pitch-850">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" aria-hidden="true" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 truncate">Live Edge Monitor</span>
        </div>
        <span className="text-[10px] font-mono text-slate-500 flex-shrink-0 ml-3">
          {hasMarketOdds ? 'MARKET ODDS' : 'MODEL ODDS'}
        </span>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Match line */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base sm:text-lg font-bold text-slate-100 tracking-tight min-w-0 truncate">
            {fixture.home_team_name ?? '?'}
            <span className="text-slate-500 font-mono font-normal text-sm mx-1.5">vs</span>
            {fixture.away_team_name ?? '?'}
          </p>
          <span className="text-[11px] text-slate-500 font-mono">{fixture.league_name ?? ''}</span>
        </div>

        {/* Pick switcher */}
        {evPicks.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Positive-EV picks">
            {evPicks.slice(0, 4).map((p, i) => (
              <button
                key={p.id ?? i}
                type="button"
                role="tab"
                aria-selected={i === safeIdx}
                onClick={() => setActiveIdx(i)}
                className={`min-h-[32px] px-3 rounded-lg text-[11px] font-mono border transition-colors ${
                  i === safeIdx
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                    : 'border-pitch-600 bg-pitch-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {pickFields(p)?.label ?? 'Edge'}
                <span className="ml-1.5 opacity-70">+{p.ev_percentage}%</span>
              </button>
            ))}
          </div>
        )}

        {/* Poisson lambdas */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">Expected Goals (Poisson Lambdas)</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 font-mono mb-1">λ HOME</p>
              <p className="text-xl font-mono text-sky-400 tabular-nums">{fixture.lambda_home ?? 'n/a'}</p>
            </div>
            <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 font-mono mb-1">λ AWAY</p>
              <p className="text-xl font-mono text-sky-400 tabular-nums">{fixture.lambda_away ?? 'n/a'}</p>
            </div>
          </div>
        </div>

        {/* 1X2 table: model % vs market odds vs zero-vig fair */}
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
            Model Probability vs Market Price
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {probRow.map(({ key, label, prob, odds, fair }) => (
              <div
                key={key}
                className={`rounded-xl border p-2.5 ${
                  key === highlightedKey ? 'border-amber-500/40 bg-amber-500/[0.04]' : 'border-pitch-700 bg-pitch-900'
                }`}
              >
                <p className="text-[10px] text-slate-500 mb-1">{key === 'H' ? 'Home' : key === 'D' ? 'Draw' : 'Away'}</p>
                <p className="text-sm font-mono font-medium text-slate-200 tabular-nums">
                  {prob != null ? `${Math.round(Number(prob))}%` : 'n/a'}
                </p>
                <p className="text-[11px] font-mono text-slate-400 tabular-nums mt-1">
                  {odds != null ? Number(odds).toFixed(2) : 'n/a'}
                </p>
                {zeroVig && fair != null && (
                  <p className="text-[10px] font-mono text-slate-500 tabular-nums">
                    fair {Number(fair).toFixed(2)}
                  </p>
                )}
              </div>
            ))}
          </div>
          {zeroVig && (
            <p className="mt-2 text-[10px] font-mono text-slate-500">
              Market overround {Math.round(zeroVig.overround * 100 - 100).toFixed(1)}% · vig stripped
              {hasMarketOdds ? ' from Bet365 / Pinnacle prices' : ' from model fallback prices'}
            </p>
          )}
        </div>

        {/* Net edge indicator: the single amber signal on the page */}
        {edge && edge.evPercent > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-3.5 value-glow">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-lg font-mono font-medium text-amber-400 tabular-nums">
                  +{edge.evPercent.toFixed(1)}% EV
                </p>
                <p className="text-[11px] text-slate-400">
                  {mos.tier} · net edge {edge.netEdge.toFixed(1)} pts
                </p>
              </div>
              <span className="text-right">
                <p className="text-sm font-mono text-slate-200 tabular-nums">{fields.label}</p>
                <p className="text-[11px] font-mono text-slate-400 tabular-nums">@ {Number(fields.odds).toFixed(2)}</p>
              </span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-pitch-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 motion-safe:transition-[width] motion-safe:duration-700"
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-slate-500 leading-snug">{mos.description}</p>
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
    <div className="rounded-2xl bg-pitch-800 border border-pitch-700 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-100">6×6 Score Matrix</h3>
          <p className="text-xs text-slate-500 mt-1">
            Joint goal-score probabilities. Shading encodes mass, amber marks the likeliest scoreline.
          </p>
        </div>
        <span className="flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-mono bg-pitch-900 border border-pitch-600 text-slate-400">
          EXAMPLE · λ {DEMO_LAMBDA_HOME} / {DEMO_LAMBDA_AWAY}
        </span>
      </div>

      {/* Header row: corner cell + home-goal column labels */}
      <div
        className="grid gap-1 mb-1"
        style={{ gridTemplateColumns: `24px repeat(6, minmax(0, 1fr))` }}
      >
        <span aria-hidden="true" />
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <span key={`ch${k}`} className="text-center text-[9px] font-mono text-slate-500">
            H{k}
          </span>
        ))}
      </div>

      {/* Body rows: away-goal label + 6 cells */}
      {demo.matrix.map((row, aRow) => (
        <div
          key={`row-${aRow}`}
          className="grid gap-1 mb-1"
          style={{ gridTemplateColumns: `24px repeat(6, minmax(0, 1fr))` }}
        >
          <span className="self-center text-[9px] font-mono text-slate-500">A{aRow}</span>
          {row.map((c, hCol) => {
            const isMax = c.prob === demo.maxProb
            const dim = c.prob / demo.maxProb
            const isHover = hoverCell && hoverCell.home === hCol && hoverCell.away === aRow
            return (
              <button
                key={`cell-${hCol}-${aRow}`}
                type="button"
                onMouseEnter={() => setHoverCell(c)}
                onFocus={() => setHoverCell(c)}
                onBlur={() => setHoverCell(null)}
                onClick={() => setHoverCell(c)}
                aria-label={`Score ${hCol} to ${aRow}, probability ${c.prob.toFixed(1)} percent`}
                className={`relative aspect-square rounded-[4px] border text-[9px] font-mono flex items-center justify-center transition-colors ${
                  isHover ? 'border-amber-400 z-10' : isMax ? 'border-amber-500/60' : 'border-pitch-700'
                }`}
                style={{ backgroundColor: `rgba(251, 191, 36, ${0.04 + dim * 0.55})` }}
              >
                <span className={dim > 0.5 ? 'text-pitch-950 font-medium' : 'text-slate-500'}>
                  {c.prob >= 1 ? Math.round(c.prob) : ''}
                </span>
              </button>
            )
          })}
        </div>
      ))}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono">
        <span className="text-slate-400">
          {shown.home}-{shown.away} · <span className="text-slate-200">{shown.prob.toFixed(1)}%</span> · {outcomeOf(shown.home, shown.away)}
        </span>
        <span className="text-slate-500">
          Home {demo.sumHomeWin}% · Draw {demo.sumDraw}% · Away {demo.sumAwayWin}% · O2.5 {demo.sumOver25}% · BTTS {demo.sumBtts}%
        </span>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Parlay slip panel: real two-leg example when the feed supplies it,
// clearly-labelled illustration otherwise.
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
        { label: 'Example Leg 1', match: 'Team A vs Team B', odds: 2.1, modelProb: 52 },
        { label: 'Example Leg 2', match: 'Team C vs Team D', odds: 3.4, modelProb: 31 },
      ]

  const agg = useMemo(() => calculateParlayAggregates(legs), [JSON.stringify(legs)])

  return (
    <div className="rounded-2xl bg-pitch-800 border border-pitch-700 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-100">Smart Parlay Slip</h3>
          <p className="text-xs text-slate-500 mt-1">
            Legs multiply odds, joint probability multiplies too. Kelly sizing follows the combined edge.
          </p>
        </div>
        {!hasReal && (
          <span className="flex-shrink-0 px-2 py-1 rounded-md text-[10px] font-mono bg-pitch-900 border border-pitch-600 text-slate-400">
            EXAMPLE SLIP
          </span>
        )}
      </div>

      <ul className="mt-4 space-y-2">
        {legs.map((leg, i) => (
          <li key={i} className="flex items-center justify-between gap-3 bg-pitch-900 border border-pitch-700 rounded-xl px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{leg.label}</p>
              <p className="text-[11px] font-mono text-slate-500 truncate">{leg.match} · p={Math.round(leg.modelProb)}%</p>
            </div>
            <span className="font-mono text-slate-300 tabular-nums flex-shrink-0">@ {Number(leg.odds).toFixed(2)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-2.5">
          <dt className="text-[10px] text-slate-500 font-mono">COMBINED</dt>
          <dd className="text-base font-mono text-slate-100 tabular-nums">{agg.totalOdds.toFixed(2)}</dd>
        </div>
        <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-2.5">
          <dt className="text-[10px] text-slate-500 font-mono">JOINT PROBAB.</dt>
          <dd className="text-base font-mono text-slate-100 tabular-nums">{agg.jointProb}%</dd>
        </div>
        <div className={`bg-pitch-900 border rounded-xl p-2.5 ${agg.isPositiveEv ? 'border-amber-500/40' : 'border-pitch-700'}`}>
          <dt className="text-[10px] text-slate-500 font-mono">SLIP EV</dt>
          <dd className={`text-base font-mono tabular-nums ${agg.isPositiveEv ? 'text-emerald-400' : 'text-slate-400'}`}>
            {agg.combinedEv > 0 ? '+' : ''}{agg.combinedEv}%
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] text-slate-500">
        Recommended stake: <span className="font-mono text-slate-300">{agg.recommendedStakePct}%</span> of bankroll
        (quarter-Kelly, hard-capped at 3%).
      </p>
    </div>
  )
}

// ------------------------------------------------------------------
// Daily SITREP mock: exact shape of the Telegram payload, with slot
// values shown as placeholders so no fake figures are presented.
// ------------------------------------------------------------------

function SitrepMock() {
  return (
    <div className="rounded-2xl bg-pitch-950 border border-pitch-700 overflow-hidden font-mono">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-pitch-800 bg-pitch-900">
        <p className="text-[11px] text-slate-300">matchlytics-sitrep</p>
        <span className="text-[10px] text-slate-500">TEMPLATE PREVIEW</span>
      </div>
      <div className="p-4 text-[11px] sm:text-xs leading-relaxed whitespace-pre-wrap text-slate-400">
        <p><span className="text-emerald-400">✅</span> Status: Sync Complete</p>
        <p><span className="text-sky-400">⚽</span> Fixtures analyzed: [n] · +EV found: [n]</p>
        <p><span className="text-amber-400">🔥</span> Top value edge: [TEAM] @ [ODDS] (+[EV]%)</p>
        <p><span className="text-rose-400">📶</span> Odds API quota: [n] req left this month</p>
        <p className="text-slate-500 mt-2">
          {'>'} Brier window: [score] · Win rate: [n]% · ROI: [n]%
        </p>
        <p className="text-slate-500 mt-2">
          {'> [🌐 Open Analytics App]  [📋 View GitHub Run]'}
        </p>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Verified track record strip, computed from settled value picks.
// ------------------------------------------------------------------

function EquitySpark({ equity }) {
  if (!equity || equity.length < 2) return null
  const W = 320
  const H = 80
  const pad = 6
  const values = [100, ...equity.map((p) => p.equity)]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(1, max - min)
  const x = (i) => pad + (i / (values.length - 1)) * (W - pad * 2)
  const y = (v) => H - pad - ((v - min) / span) * (H - pad * 2)
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const baseY = y(100)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label={`Cumulative flat-stake equity curve across ${equity.length} settled bets, ending at ${equity[equity.length - 1].equity} units from a 100-unit start`}
    >
      <line x1={pad} x2={W - pad} y1={baseY} y2={baseY} stroke="#344055" strokeWidth="1" strokeDasharray="3 3" />
      <polyline points={points} fill="none" stroke="#38bdf8" strokeWidth="1.75" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="2.5" fill="#38bdf8" />
    </svg>
  )
}

function TrackRecordPanel({ settledFixtures, onOpenBacktest }) {
  const sim = useMemo(() => simulateBankroll(settledFixtures), [settledFixtures])
  const stats = sim.stats

  return (
    <div className="rounded-2xl bg-pitch-800 border border-pitch-700 p-5 sm:p-6">
      {stats ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-3">
              <p className="text-[10px] font-mono text-slate-500 uppercase">SETTLED BETS</p>
              <p className="text-xl font-mono text-slate-100 tabular-nums mt-1">{stats.totalBets}</p>
            </div>
            <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-3">
              <p className="text-[10px] font-mono text-slate-500 uppercase">WIN RATE</p>
              <p className={`text-xl font-mono tabular-nums mt-1 ${stats.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.winRate}%
              </p>
            </div>
            <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-3">
              <p className="text-[10px] font-mono text-slate-500 uppercase">FLAT STAKE ROI</p>
              <p className={`text-xl font-mono tabular-nums mt-1 ${stats.roiPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.roiPct >= 0 ? '+' : ''}{stats.roiPct}%
              </p>
            </div>
            <div className="bg-pitch-900 border border-pitch-700 rounded-xl p-3">
              <p className="text-[10px] font-mono text-slate-500 uppercase">BRIER SCORE</p>
              <p className="text-xl font-mono text-slate-100 tabular-nums mt-1">{stats.brierScore ?? 'n/a'}</p>
              {stats.brierScore != null && <BrierBadge brier={stats.brierScore} />}
            </div>
          </div>

          <div className="mt-5">
            <EquitySpark equity={sim.flatEquity} />
            <p className="mt-1.5 text-[11px] text-slate-500 font-mono">
              Flat 1-unit staking · start 100 units · end {stats.finalFlatEquity} units
            </p>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-300 font-medium">The verified ledger is building.</p>
      )}

      <p className="mt-4 text-xs text-slate-500 leading-relaxed max-w-2xl">
        Every row below the fold is a value pick that finished with an official result. Payouts are
        settled at market odds, staked flat at 1 unit or quarter-Kelly, and recalculated on every
        settlement cycle. No projections, no simulated history.
      </p>

      <button
        type="button"
        onClick={onOpenBacktest}
        className="mt-5 min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 text-sm font-semibold hover:bg-amber-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        📈 Open Full Ledger &amp; Equity Curves
      </button>
    </div>
  )
}

function BrierBadge({ brier }) {
  const tier = getBrierTier(brier)
  if (!tier) return null
  return <span className={`inline-block mt-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono border ${tier.cls}`}>{tier.label}</span>
}

// ------------------------------------------------------------------
// Main landing page
// ------------------------------------------------------------------

export default function LandingPage({
  onEnterApp,
  onOpenBacktest,
  fixtures,
  settledFixtures,
  fixturesLoading,
  dataError,
  lastUpdated,
}) {
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  const isPreviewHost = host === 'localhost' || host.startsWith('127.') || host.includes('vercel.app')

  // Launch behaviour: cross-domain navigation in production, in-place
  // view switch in local dev and Vercel previews (no reload there).
  const handleLaunchApp = () => {
    if (isPreviewHost) onEnterApp()
    else window.location.assign(APP_LIVE_URL)
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
      formula: 'Σ(1/oᵢ) → 1 · vig = Σ(1/oᵢ) − 1',
      body: 'Bookmaker prices carry an overround built in. Matchlytics strips it proportionally across all three outcomes, recovering the fair market distribution to compare against model output.',
    },
    {
      index: '02',
      title: 'Bivariate Poisson with Bayesian Shrinkage',
      formula: 'P(h,a) = P(λₕ,h) · P(λₐ,a) · λ ∈ [0.6, 3.2]',
      body: 'Team attack and defence strengths are shrunk toward the league baseline with a three-game prior, so early-season samples cannot blow up a lambda. The result is a 6×6 joint score matrix per fixture.',
    },
    {
      index: '03',
      title: 'Automated +EV Scanner, Six Leagues',
      formula: 'EV = p·o − 1 · flag when MOS ≥ 4 pts',
      body: 'Every odds cycle across Premier League, La Liga, Serie A, Bundesliga, Ligue 1 and the Champions League runs through the guardrails. Only picks with a real margin of safety reach the feed.',
    },
    {
      index: '04',
      title: 'Quarter-Kelly Risk Allocation',
      formula: 'f* = ¼ · (b·p − q)/b · cap 2.5%',
      body: 'Full Kelly assumes perfect calibration, which no model has. Matchlytics stakes a quarter of the theoretical maximum and hard-caps it, keeping the bankroll curve forgiving on variance.',
    },
  ]

  const navLinks = [
    { label: 'Methodology', href: '#methodology' },
    { label: 'Core Architecture', href: '#architecture' },
    { label: 'Track Record', href: '#track-record' },
    { label: 'Daily SITREP', href: '#sitrep' },
  ]

  return (
    <div className="min-h-screen bg-pitch-950 text-slate-300 overflow-x-hidden">
      {/* ─── Sticky top navigation ─────────────────────────── */}
      <header className="sticky top-0 z-40 bg-pitch-950/95 backdrop-blur-sm border-b border-pitch-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 h-16">
            <a href="#top" className="flex items-center gap-2.5 min-w-0" aria-label="Matchlytics by imortifex, back to top">
              <DiamondMark size={30} />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-100 tracking-tight leading-none">Matchlytics</span>
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
                Engine Active · {syncLabel}
              </span>
              <button
                type="button"
                onClick={handleLaunchApp}
                className="min-h-[44px] inline-flex items-center px-4 sm:px-5 rounded-xl bg-amber-500 text-pitch-950 text-sm font-bold hover:bg-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {isPreviewHost ? '⚡ Launch Dashboard' : '⚡ Open App'}
              </button>
            </div>
          </div>

          {/* Mobile section links: tappable row, not a squeezed desktop nav */}
          <nav className="md:hidden -mx-1" aria-label="Landing sections">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-2 px-1">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="min-h-[36px] flex items-center px-3.5 rounded-lg bg-pitch-900 border border-pitch-700 text-xs text-slate-300 whitespace-nowrap"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* ─── Hero: pitch of claims + living monitor ──────── */}
        <section className="relative bg-pitch-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 lg:pt-24 pb-12 sm:pb-16">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
              <div className="animate-fade-in">
                <p className="font-mono text-[11px] sm:text-xs text-slate-500 tracking-[0.14em] uppercase">
                  Institutional Quantitative Sports Analytics Engine · By Imortifex
                </p>
                <h1 className="mt-4 text-4xl sm:text-5xl xl:text-6xl font-bold text-slate-100 tracking-tight text-balance leading-[1.05]">
                  Eliminate the bookmaker&apos;s edge with pure mathematical precision.
                </h1>
                <p className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl">
                  Matchlytics reads six leagues of standings and live Bet365 and Pinnacle pricing,
                  rebuilds each fixture with a bivariate Poisson goal model, strips the margin from
                  the market, and flags the picks where your expected value is genuinely positive.
                  Twice a day. Settled and audited after every match.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleLaunchApp}
                    className="min-h-[48px] px-6 rounded-xl bg-amber-500 text-pitch-950 text-sm font-bold hover:bg-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    {isPreviewHost ? '⚡ Launch Dashboard' : '⚡ Open App'}
                  </button>
                  <button
                    type="button"
                    onClick={onOpenBacktest}
                    className="min-h-[48px] px-6 rounded-xl border border-pitch-600 bg-pitch-800 text-slate-200 text-sm font-semibold hover:border-pitch-500 hover:bg-pitch-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    📈 View Verified Backtest
                  </button>
                </div>
                <p className="mt-5 text-[11px] font-mono text-slate-600">
                  No account, no paywall. Read-only public feeds, refreshed in real time.
                </p>
              </div>

              <div className="animate-slide-up motion-safe:delay-150">
                <HeroMonitor evPicks={evPicks} fixturesLoading={Boolean(fixturesLoading)} dataError={dataError} />
              </div>
            </div>
          </div>
        </section>

        {/* ─── 01 Methodology: four quant pillars ──────────── */}
        <section id="methodology" className="scroll-mt-24 bg-pitch-900/40 border-y border-pitch-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
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

            <div className="mt-8 grid sm:grid-cols-2 gap-3.5">
              {pillars.map((p) => (
                <article key={p.index} className="rounded-2xl bg-pitch-800 border border-pitch-700 p-5">
                  <p className="font-mono text-[11px] text-amber-400">{p.index}</p>
                  <h3 className="mt-1.5 text-[15px] font-bold text-slate-100">{p.title}</h3>
                  <p className="mt-2 text-[13px] text-slate-400 leading-relaxed">{p.body}</p>
                  <p className="mt-3 text-[11px] font-mono text-slate-500 bg-pitch-950 border border-pitch-800 rounded-lg px-3 py-2 overflow-x-auto no-scrollbar whitespace-nowrap">
                    {p.formula}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 02 Core Architecture: pipeline + capability ─── */}
        <section id="architecture" className="scroll-mt-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <div className="max-w-2xl">
              <SectionKicker index="02" title="Core Architecture" />
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                One source of truth, zero backend servers.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">
                GitHub Actions run the entire pipeline and publish to a public Postgres database.
                The dashboard, this site, and the Telegram dispatcher all read the same settlement
                store, so every number you see anywhere has one provenance.
              </p>
            </div>

            {/* Pipeline steps */}
            <ol className="mt-8 grid grid-cols-2 lg:grid-cols-5 gap-2.5">
              {[
                { n: 'a', t: 'Standings sync', d: 'Home/away attack & defence strengths, daily' },
                { n: 'b', t: 'Fixture intake', d: 'Seven-day fixture window, weekly' },
                { n: 'c', t: 'Odds capture', d: 'Bet365 / Pinnacle decimal prices, twice daily' },
                { n: 'd', t: 'Poisson engine', d: 'Lambdas, 6×6 matrix, EV, settlement' },
                { n: 'e', t: 'Publish', d: 'Postgres write + Telegram SITREP' },
              ].map((s, i) => (
                <li key={s.t} className="relative rounded-xl bg-pitch-800 border border-pitch-700 p-3.5">
                  <span className="font-mono text-[10px] text-slate-500">STEP {i + 1}</span>
                  <p className="mt-1 text-[13px] font-semibold text-slate-200">{s.t}</p>
                  <p className="mt-1 text-[11px] text-slate-500 leading-snug">{s.d}</p>
                </li>
              ))}
            </ol>

            {/* Capability showcase */}
            <div className="mt-8 grid lg:grid-cols-2 gap-4">
              <ScoreHeatPanel />
              <div className="flex flex-col gap-4">
                <ParlayPanel evPicks={evPicks} />
              </div>
            </div>
          </div>
        </section>

        {/* ─── 03 Track Record: verified settlements only ──── */}
        <section id="track-record" className="scroll-mt-24 bg-pitch-900/40 border-y border-pitch-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <div className="max-w-2xl">
              <SectionKicker index="03" title="Track Record" />
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

        {/* ─── 04 Daily SITREP ──────────────────────────────── */}
        <section id="sitrep" className="scroll-mt-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <div className="grid lg:grid-cols-2 gap-8 items-start">
              <div>
                <SectionKicker index="04" title="Daily SITREP" />
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
                  A machine-generated situation report, twice a day, on the record.
                </h2>
                <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">
                  At 06:00 and 14:00 UTC the pipeline writes a structured briefing to Telegram:
                  sync volumes, remaining odds-API quota, yesterday&apos;s settlements, today&apos;s
                  value edges, and a copy-ready accumulator block with a quarter-Kelly stake. It
                  ends with deep links back into the dashboard and the pipeline run itself.
                </p>
                <p className="mt-4 text-[13px] text-slate-500 leading-relaxed">
                  The report also doubles as the audit trail: if a sync goes quiet, the missing
                  briefing is itself the alert.
                </p>
                <a
                  href={GITHUB_ACTIONS_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-5 inline-flex min-h-[44px] items-center gap-2 px-4 py-2 rounded-xl border border-pitch-600 bg-pitch-800 text-sm font-medium text-slate-300 hover:text-slate-100 hover:border-pitch-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  Inspect Pipeline Runs on GitHub
                </a>
              </div>
              <SitrepMock />
            </div>
          </div>
        </section>
      </main>

      {/* ─── Trust, compliance & ecosystem footer ──────────── */}
      <footer className="border-t border-pitch-800 bg-pitch-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8">
            <div className="max-w-md">
              <div className="flex items-center gap-2.5">
                <DiamondMark size={24} />
                <div>
                  <p className="text-sm font-bold text-slate-100">Matchlytics</p>
                  <p className="text-[10px] font-mono text-slate-500">by imortifex</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-500 leading-relaxed">
                Matchlytics is provided for educational and research purposes. Model outputs are
                statistical estimates of probabilities; they are not predictions, financial advice,
                or guarantees of any result. Independent project, not affiliated with any league,
                broadcaster, bookmaker, or operator.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-1.5 text-[13px] sm:max-w-xs sm:w-full">
              <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer noopener" className="text-slate-400 hover:text-slate-100 transition-colors py-2">
                Source on GitHub
              </a>
              <a href={APP_LIVE_URL} target="_blank" rel="noreferrer noopener" className="text-slate-400 hover:text-slate-100 transition-colors py-2">
                Analytics Dashboard
              </a>
              <a href="#methodology" className="text-slate-500 hover:text-slate-300 transition-colors py-2">
                Methodology
              </a>
              <a href="#track-record" className="text-slate-500 hover:text-slate-300 transition-colors py-2">
                Track Record
              </a>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-pitch-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] font-mono text-slate-600">
            <p>© 2026 Matchlytics by imortifex. All rights reserved.</p>
            <p>Data: football-data.org · The Odds API · PostgreSQL</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
