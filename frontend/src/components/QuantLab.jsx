// ---- QuantLab.jsx ----
// Institutional Quant Lab: Single-Match Quantitative Deep-Dive
// - Interactive Bivariate Poisson 6x6 Scoreline Heatmap with dynamic lambda overrides
// - 10,000-iteration client-side Monte Carlo variance distribution engine
// - Reverse Odds & True Fair-Value simulator with Quarter-Kelly sizing
// - One-click position logging into the Bankroll Portfolio Journal

import { useState, useMemo, useEffect } from 'react'
import { computePoissonMatrix, calculateZeroVigOdds, calculateEdgeAndEV, getKellyFraction } from '../utils/analytics'
import FormGuide from './FormGuide'

// Fast client-side Poisson random number generator (Knuth algorithm)
function samplePoisson(lambda) {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1.0
  do {
    k += 1
    p *= Math.random()
  } while (p > L)
  return k - 1
}

// 10,000-iteration Monte Carlo simulation
function runMonteCarloSimulation(lambdaHome, lambdaAway, iterations = 10000) {
  let homeCleanSheets = 0
  let awayCleanSheets = 0
  let bttsCount = 0

  let over15 = 0
  let over25 = 0
  let over35 = 0

  // Goal brackets: 0-1, 2-3, 4-5, 6+
  let bracket01 = 0
  let bracket23 = 0
  let bracket45 = 0
  let bracket6Plus = 0

  // Margin distribution
  let homeBy2Plus = 0
  let homeBy1 = 0
  let draws = 0
  let awayBy1 = 0
  let awayBy2Plus = 0

  let homeWins = 0
  let awayWins = 0

  for (let i = 0; i < iterations; i += 1) {
    const h = samplePoisson(lambdaHome)
    const a = samplePoisson(lambdaAway)
    const total = h + a
    const diff = h - a

    if (a === 0) homeCleanSheets += 1
    if (h === 0) awayCleanSheets += 1
    if (h > 0 && a > 0) bttsCount += 1

    if (total > 1) over15 += 1
    if (total > 2) over25 += 1
    if (total > 3) over35 += 1

    if (total <= 1) bracket01 += 1
    else if (total <= 3) bracket23 += 1
    else if (total <= 5) bracket45 += 1
    else bracket6Plus += 1

    if (diff >= 2) {
      homeBy2Plus += 1
      homeWins += 1
    } else if (diff === 1) {
      homeBy1 += 1
      homeWins += 1
    } else if (diff === 0) {
      draws += 1
    } else if (diff === -1) {
      awayBy1 += 1
      awayWins += 1
    } else {
      awayBy2Plus += 1
      awayWins += 1
    }
  }

  const toPct = (val) => Number(((val / iterations) * 100).toFixed(1))

  return {
    iterations,
    homeCleanSheetPct: toPct(homeCleanSheets),
    awayCleanSheetPct: toPct(awayCleanSheets),
    bttsPct: toPct(bttsCount),
    over15Pct: toPct(over15),
    over25Pct: toPct(over25),
    over35Pct: toPct(over35),
    brackets: {
      bracket01Pct: toPct(bracket01),
      bracket23Pct: toPct(bracket23),
      bracket45Pct: toPct(bracket45),
      bracket6PlusPct: toPct(bracket6Plus),
    },
    margins: {
      homeBy2PlusPct: toPct(homeBy2Plus),
      homeBy1Pct: toPct(homeBy1),
      drawsPct: toPct(draws),
      awayBy1Pct: toPct(awayBy1),
      awayBy2PlusPct: toPct(awayBy2Plus),
    },
    simProbHome: toPct(homeWins),
    simProbDraw: toPct(draws),
    simProbAway: toPct(awayWins),
  }
}

export default function QuantLab({
  fixture,
  selectedFixture,
  allFixtures = [],
  fixtures = [],
  onSelectFixture,
  standingsMap = {},
  onLogPosition,
  bankrollAmount = 1000000,
  userBankroll = 1000000,
  currencyCode = 'IDR',
}) {
  const effectiveBankroll = userBankroll || bankrollAmount || 1000000
  const matchPool = useMemo(() => {
    const list = (allFixtures && allFixtures.length > 0) ? allFixtures : fixtures
    return list || []
  }, [allFixtures, fixtures])

  const initialTarget = selectedFixture || fixture

  // Active fixture state (fallback to highest +EV match or first available)
  const activeMatch = useMemo(() => {
    if (initialTarget) return initialTarget
    if (matchPool.length > 0) {
      const sortedByValue = [...matchPool]
        .filter((f) => Boolean(f.value_pick))
        .sort((a, b) => (b.ev_percentage || 0) - (a.ev_percentage || 0))
      return sortedByValue[0] || matchPool[0]
    }
    return null
  }, [initialTarget, matchPool])

  // Sync back to parent if target was auto-selected
  useEffect(() => {
    if (!initialTarget && activeMatch && onSelectFixture) {
      onSelectFixture(activeMatch)
    }
  }, [initialTarget, activeMatch, onSelectFixture])

  // Custom Lambda overrides
  const [customLambdaH, setCustomLambdaH] = useState(1.45)
  const [customLambdaA, setCustomLambdaA] = useState(1.15)
  const [activeMarketOdds, setActiveMarketOdds] = useState({ home: '2.10', draw: '3.40', away: '3.50' })

  // Synchronize when active match changes
  useEffect(() => {
    if (activeMatch) {
      const hXg = activeMatch.lambda_home ? Number(activeMatch.lambda_home) : 1.45
      const aXg = activeMatch.lambda_away ? Number(activeMatch.lambda_away) : 1.15
      setCustomLambdaH(hXg)
      setCustomLambdaA(aXg)
      setActiveMarketOdds({
        home: activeMatch.odds_home ? String(activeMatch.odds_home) : '2.10',
        draw: activeMatch.odds_draw ? String(activeMatch.odds_draw) : '3.40',
        away: activeMatch.odds_away ? String(activeMatch.odds_away) : '3.50',
      })
    }
  }, [activeMatch])

  // Compute 6x6 Poisson joint matrix from current lambdas
  const matrixData = useMemo(() => {
    return computePoissonMatrix(customLambdaH, customLambdaA, 5)
  }, [customLambdaH, customLambdaA])

  // Run 10k Monte Carlo simulation on current lambdas
  const simResults = useMemo(() => {
    return runMonteCarloSimulation(customLambdaH, customLambdaA, 10000)
  }, [customLambdaH, customLambdaA])

  // Odds & Zero-Vig consensus calculations
  const zeroVig = useMemo(() => {
    return calculateZeroVigOdds(
      parseFloat(activeMarketOdds.home) || 0,
      parseFloat(activeMarketOdds.draw) || 0,
      parseFloat(activeMarketOdds.away) || 0
    )
  }, [activeMarketOdds])

  // Calculate Edge & Kelly for each 1X2 outcome
  const valueEvaluations = useMemo(() => {
    if (!matrixData) return []
    const outcomes = [
      { key: 'HOME', label: `${activeMatch?.home_team_name || 'Home'} Win`, prob: matrixData.sumHomeWin, odds: parseFloat(activeMarketOdds.home) || 0 },
      { key: 'DRAW', label: 'Draw (X)', prob: matrixData.sumDraw, odds: parseFloat(activeMarketOdds.draw) || 0 },
      { key: 'AWAY', label: `${activeMatch?.away_team_name || 'Away'} Win`, prob: matrixData.sumAwayWin, odds: parseFloat(activeMarketOdds.away) || 0 },
    ]

    return outcomes.map((item) => {
      const { netEdge, expectedValuePct } = calculateEdgeAndEV(item.odds, item.prob)
      const rawKelly = getKellyFraction(item.odds, item.prob)
      // Quarter-Kelly with 2.5% safe cap
      const quarterKelly = Math.max(0, Math.min(2.5, Number((rawKelly * 0.25).toFixed(2))))
      const stakeRec = (effectiveBankroll * (quarterKelly / 100))

      return {
        ...item,
        netEdge,
        expectedValuePct,
        quarterKelly,
        stakeRec,
        hasEdge: expectedValuePct >= 2.0 && expectedValuePct <= 35.0,
      }
    })
  }, [matrixData, activeMarketOdds, effectiveBankroll, activeMatch])

  // Standings metadata for active match
  const homeStandings = activeMatch ? (standingsMap[activeMatch.home_team_id] || standingsMap[`${activeMatch.league_id}_${activeMatch.home_team_id}`] || null) : null
  const awayStandings = activeMatch ? (standingsMap[activeMatch.away_team_id] || standingsMap[`${activeMatch.league_id}_${activeMatch.away_team_id}`] || null) : null

  // Reset to original model xG
  const handleResetModelXg = () => {
    if (activeMatch) {
      setCustomLambdaH(activeMatch.lambda_home ? Number(activeMatch.lambda_home) : 1.45)
      setCustomLambdaA(activeMatch.lambda_away ? Number(activeMatch.lambda_away) : 1.15)
    }
  }

  if (!activeMatch) {
    return (
      <div className="py-16 text-center text-slate-400 font-mono text-sm">
        No fixtures currently available for quantitative deep-dive.
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* ---- Top Match Selector & Identity Header ---- */}
      <div className="p-4 sm:p-5 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-mono font-bold text-sm">
              ⚅
            </span>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Quantitative Research Lab
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 truncate">
                {activeMatch.home_team_name} vs {activeMatch.away_team_name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:ml-4 text-xs font-mono text-slate-400">
            <span className="px-2 py-0.5 rounded bg-pitch-950 border border-pitch-800 text-amber-300">
              {activeMatch.league_name || 'League'}
            </span>
            <span>
              {activeMatch.match_date ? new Date(activeMatch.match_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD'}
            </span>
          </div>
        </div>

        {/* Match Picker Selector */}
        {matchPool.length > 0 && (
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <label htmlFor="quant-match-select" className="text-xs text-slate-400 font-mono whitespace-nowrap">
              Switch Target:
            </label>
            <select
              id="quant-match-select"
              value={activeMatch ? activeMatch.id : ''}
              onChange={(e) => {
                const targetId = e.target.value
                const found = matchPool.find((f) => String(f.id) === String(targetId))
                if (found && onSelectFixture) onSelectFixture(found)
              }}
              className="bg-pitch-950 border border-pitch-700 hover:border-amber-500/50 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans max-w-[280px] sm:max-w-[340px] truncate cursor-pointer transition-colors"
            >
              {matchPool.map((f) => {
                const isVal = Boolean(f.value_pick)
                const evTag = isVal ? ` ★ [+EV ${(f.ev_percentage || 0).toFixed(1)}%]` : ''
                return (
                  <option key={f.id} value={f.id}>
                    {f.home_team_name} vs {f.away_team_name}{evTag} ({f.league_name || 'League'})
                  </option>
                )
              })}
            </select>
          </div>
        )}
      </div>

      {/* ---- Interactive Lambda Overrides & Sensitivity Strip ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Home Expected Goals (Lambda H) */}
        <div className="p-4 rounded-xl bg-pitch-900 border border-pitch-800/90 shadow-md flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeMatch.home_team_logo && (
                <img src={activeMatch.home_team_logo} alt="" className="w-5 h-5 object-contain" />
              )}
              <span className="text-xs font-bold text-slate-200 truncate">
                {activeMatch.home_team_name} xG (λH)
              </span>
            </div>
            <span className="text-base font-mono font-bold text-sky-400 tabular-nums">
              {customLambdaH.toFixed(2)}
            </span>
          </div>

          <input
            type="range"
            min="0.4"
            max="3.8"
            step="0.05"
            value={customLambdaH}
            onChange={(e) => setCustomLambdaH(parseFloat(e.target.value))}
            className="w-full accent-sky-400 bg-pitch-950 cursor-pointer h-2 rounded-lg"
          />

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Model xG: {activeMatch.lambda_home ?? '1.45'}</span>
            {homeStandings?.home_played > 0 && (
              <span>Record: {homeStandings.home_goals_for}:{homeStandings.home_goals_against} in {homeStandings.home_played}H</span>
            )}
          </div>
        </div>

        {/* Away Expected Goals (Lambda A) */}
        <div className="p-4 rounded-xl bg-pitch-900 border border-pitch-800/90 shadow-md flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeMatch.away_team_logo && (
                <img src={activeMatch.away_team_logo} alt="" className="w-5 h-5 object-contain" />
              )}
              <span className="text-xs font-bold text-slate-200 truncate">
                {activeMatch.away_team_name} xG (λA)
              </span>
            </div>
            <span className="text-base font-mono font-bold text-rose-400 tabular-nums">
              {customLambdaA.toFixed(2)}
            </span>
          </div>

          <input
            type="range"
            min="0.4"
            max="3.8"
            step="0.05"
            value={customLambdaA}
            onChange={(e) => setCustomLambdaA(parseFloat(e.target.value))}
            className="w-full accent-rose-400 bg-pitch-950 cursor-pointer h-2 rounded-lg"
          />

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Model xG: {activeMatch.lambda_away ?? '1.15'}</span>
            {awayStandings?.away_played > 0 && (
              <span>Record: {awayStandings.away_goals_for}:{awayStandings.away_goals_against} in {awayStandings.away_played}A</span>
            )}
          </div>
        </div>

        {/* Quick Presets & Sensitivity Controls */}
        <div className="p-4 rounded-xl bg-pitch-900 border border-pitch-800/90 shadow-md flex flex-col justify-between space-y-2">
          <span className="text-xs font-bold text-slate-300">
            Scenario Modeling Presets
          </span>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <button
              type="button"
              onClick={handleResetModelXg}
              className="px-2.5 py-1.5 rounded-lg bg-pitch-950 hover:bg-pitch-800 border border-pitch-700 text-amber-300 text-left truncate transition-colors"
            >
              ↺ Reset to Model
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomLambdaH(Number((customLambdaH * 1.25).toFixed(2)))
                setCustomLambdaA(Number((customLambdaA * 0.85).toFixed(2)))
              }}
              className="px-2.5 py-1.5 rounded-lg bg-pitch-950 hover:bg-pitch-800 border border-pitch-700 text-slate-300 text-left truncate transition-colors"
            >
              ▲ High Home Bias
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomLambdaH(0.90)
                setCustomLambdaA(0.85)
              }}
              className="px-2.5 py-1.5 rounded-lg bg-pitch-950 hover:bg-pitch-800 border border-pitch-700 text-slate-300 text-left truncate transition-colors"
            >
              ▼ Low-Scoring Grid
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomLambdaH(2.30)
                setCustomLambdaA(1.80)
              }}
              className="px-2.5 py-1.5 rounded-lg bg-pitch-950 hover:bg-pitch-800 border border-pitch-700 text-slate-300 text-left truncate transition-colors"
            >
              ★ Open Goal Fest
            </button>
          </div>
        </div>
      </div>

      {/* ---- Interactive 6x6 Bivariate Poisson Heatmap & Monte Carlo Columns ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 6x6 Matrix (7 Cols) */}
        <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-pitch-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Bivariate Poisson Joint Probability Matrix
              </h3>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                Calculated from λH = {customLambdaH.toFixed(2)} and λA = {customLambdaA.toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Most Likely: {matrixData.mostProbable.home}-{matrixData.mostProbable.away} ({matrixData.maxProb.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Matrix Grid */}
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[340px]">
              <div className="text-center text-xs font-semibold text-sky-400 mb-2">
                Home Goals (0 to 5)
              </div>
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr>
                    <th className="text-[11px] font-medium text-slate-500 p-1 w-12 text-left">
                      Away ↓
                    </th>
                    {[0, 1, 2, 3, 4, 5].map((h) => (
                      <th key={h} className="text-xs font-bold text-slate-300 p-1.5 bg-pitch-950/60 rounded-t border-b border-pitch-800">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixData.matrix.map((row, awayGoals) => (
                    <tr key={awayGoals}>
                      <th className="text-xs font-bold text-rose-400 p-1.5 text-left bg-pitch-950/60 rounded-l border-r border-pitch-800">
                        {awayGoals}
                      </th>
                      {row.map((cell) => {
                        const isTop = cell.home === matrixData.mostProbable.home && cell.away === matrixData.mostProbable.away
                        const ratio = matrixData.maxProb > 0 ? cell.prob / matrixData.maxProb : 0
                        const bgAlpha = Math.max(0.06, ratio * 0.70)

                        return (
                          <td
                            key={cell.home}
                            className={`p-1 relative transition-all ${
                              isTop ? 'ring-2 ring-amber-400 rounded z-10' : 'hover:ring-1 hover:ring-slate-400/40'
                            }`}
                            style={{
                              backgroundColor: `rgba(245, 158, 11, ${bgAlpha.toFixed(3)})`,
                            }}
                          >
                            <div className="flex flex-col items-center justify-center min-h-[34px]">
                              <span className="text-xs font-mono font-bold text-slate-100">
                                {cell.prob.toFixed(1)}%
                              </span>
                              <span className="text-[9px] font-mono text-slate-400">
                                {cell.home}-{cell.away}
                              </span>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Outcome Probs Bar */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-pitch-800 text-center font-mono">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20">
              <span className="text-[10px] text-slate-400 block uppercase">Home Win</span>
              <span className="text-sm font-bold text-sky-400">{matrixData.sumHomeWin.toFixed(1)}%</span>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="text-[10px] text-slate-400 block uppercase">Draw (X)</span>
              <span className="text-sm font-bold text-amber-400">{matrixData.sumDraw.toFixed(1)}%</span>
            </div>
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <span className="text-[10px] text-slate-400 block uppercase">Away Win</span>
              <span className="text-sm font-bold text-rose-400">{matrixData.sumAwayWin.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Right: 10,000-Iteration Monte Carlo Variance (5 Cols) */}
        <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-xl flex flex-col justify-between space-y-4">
          <div className="border-b border-pitch-800 pb-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">
                10,000-Iteration Monte Carlo Engine
              </h3>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                10,000 Trials
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              Empirical variance and clean sheet distributions
            </p>
          </div>

          {/* Clean Sheets & BTTS */}
          <div className="grid grid-cols-3 gap-2 text-center font-mono">
            <div className="p-2.5 rounded-xl bg-pitch-950 border border-pitch-800">
              <span className="text-[10px] text-slate-400 block truncate">Home Clean Sheet</span>
              <span className="text-sm font-bold text-slate-200">{simResults.homeCleanSheetPct}%</span>
            </div>
            <div className="p-2.5 rounded-xl bg-pitch-950 border border-pitch-800">
              <span className="text-[10px] text-slate-400 block truncate">Away Clean Sheet</span>
              <span className="text-sm font-bold text-slate-200">{simResults.awayCleanSheetPct}%</span>
            </div>
            <div className="p-2.5 rounded-xl bg-pitch-950 border border-pitch-800">
              <span className="text-[10px] text-slate-400 block truncate">BTTS Yes</span>
              <span className="text-sm font-bold text-amber-300">{simResults.bttsPct}%</span>
            </div>
          </div>

          {/* Goal Brackets */}
          <div className="space-y-1.5 font-mono text-xs">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
              Total Goals Brackets
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between p-2 rounded-lg bg-pitch-950 border border-pitch-800">
                <span className="text-slate-400">0 to 1 Goals</span>
                <span className="font-bold text-slate-200">{simResults.brackets.bracket01Pct}%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-pitch-950 border border-pitch-800">
                <span className="text-slate-400">2 to 3 Goals</span>
                <span className="font-bold text-amber-300">{simResults.brackets.bracket23Pct}%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-pitch-950 border border-pitch-800">
                <span className="text-slate-400">4 to 5 Goals</span>
                <span className="font-bold text-slate-200">{simResults.brackets.bracket45Pct}%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-pitch-950 border border-pitch-800">
                <span className="text-slate-400">6+ Goals</span>
                <span className="font-bold text-rose-400">{simResults.brackets.bracket6PlusPct}%</span>
              </div>
            </div>
          </div>

          {/* Win-By Margins */}
          <div className="space-y-1.5 font-mono text-xs">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
              Margin of Victory Distribution
            </span>
            <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
              <div className="p-1.5 rounded-lg bg-pitch-950 border border-pitch-800">
                <span className="text-slate-500 block">H 2+</span>
                <span className="font-bold text-sky-400 text-xs">{simResults.margins.homeBy2PlusPct}%</span>
              </div>
              <div className="p-1.5 rounded-lg bg-pitch-950 border border-pitch-800">
                <span className="text-slate-500 block">H by 1</span>
                <span className="font-bold text-sky-300 text-xs">{simResults.margins.homeBy1Pct}%</span>
              </div>
              <div className="p-1.5 rounded-lg bg-pitch-950 border border-pitch-800">
                <span className="text-slate-500 block">Draw</span>
                <span className="font-bold text-amber-400 text-xs">{simResults.margins.drawsPct}%</span>
              </div>
              <div className="p-1.5 rounded-lg bg-pitch-950 border border-pitch-800">
                <span className="text-slate-500 block">A by 1</span>
                <span className="font-bold text-rose-300 text-xs">{simResults.margins.awayBy1Pct}%</span>
              </div>
              <div className="p-1.5 rounded-lg bg-pitch-950 border border-pitch-800">
                <span className="text-slate-500 block">A 2+</span>
                <span className="font-bold text-rose-400 text-xs">{simResults.margins.awayBy2PlusPct}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Reverse Odds Fair-Value Simulator & One-Click Portfolio Logging ---- */}
      <div className="p-4 sm:p-5 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-pitch-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Reverse Odds Fair-Value Simulator</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Zero-Vig Calibration
              </span>
            </h3>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              Enter consensus market price to evaluate edge, expected value, and Quarter-Kelly stake
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Active Bankroll: <strong className="text-amber-400">{currencyCode} {effectiveBankroll.toLocaleString()}</strong>
          </div>
        </div>

        {/* 1X2 Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-pitch-800 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-3">Outcome</th>
                <th className="py-2.5 px-3 text-center">Model Fair Odds</th>
                <th className="py-2.5 px-3 text-center">Market Price</th>
                <th className="py-2.5 px-3 text-center">Zero-Vig Sharp</th>
                <th className="py-2.5 px-3 text-center">Net Edge</th>
                <th className="py-2.5 px-3 text-center">Quarter-Kelly</th>
                <th className="py-2.5 px-3 text-center">Recommended Stake</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pitch-800/60">
              {valueEvaluations.map((evalItem) => {
                const fairOdds = evalItem.prob > 0 ? (100.0 / evalItem.prob).toFixed(2) : '-'
                const vigFair = evalItem.key === 'HOME' ? zeroVig.fairHome : evalItem.key === 'DRAW' ? zeroVig.fairDraw : zeroVig.fairAway

                return (
                  <tr key={evalItem.key} className="hover:bg-pitch-800/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-slate-200">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${evalItem.hasEdge ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
                        {evalItem.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-amber-300 font-bold">
                      {fairOdds}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <input
                        type="number"
                        step="0.05"
                        min="1.01"
                        value={evalItem.key === 'HOME' ? activeMarketOdds.home : evalItem.key === 'DRAW' ? activeMarketOdds.draw : activeMarketOdds.away}
                        onChange={(e) => {
                          const val = e.target.value
                          setActiveMarketOdds((prev) => ({
                            ...prev,
                            [evalItem.key.toLowerCase()]: val,
                          }))
                        }}
                        className="w-20 bg-pitch-950 border border-pitch-700 rounded px-2 py-1 text-center text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-xs"
                      />
                    </td>
                    <td className="py-3 px-3 text-center text-slate-400">
                      {vigFair ?? '-'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        evalItem.hasEdge
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-pitch-950 text-slate-500 border border-pitch-800'
                      }`}>
                        {evalItem.expectedValuePct > 0 ? `+${evalItem.expectedValuePct.toFixed(1)}%` : `${evalItem.expectedValuePct.toFixed(1)}%`}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-300">
                      {evalItem.quarterKelly > 0 ? `${evalItem.quarterKelly}%` : '-'}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-200">
                      {evalItem.stakeRec > 0 ? `${currencyCode} ${Math.round(evalItem.stakeRec).toLocaleString()}` : '-'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (onLogPosition) {
                            onLogPosition({
                              fixtureId: activeMatch.id,
                              fixtureName: `${activeMatch.home_team_name} vs ${activeMatch.away_team_name}`,
                              leagueName: activeMatch.league_name || 'League',
                              matchDate: activeMatch.match_date,
                              selection: evalItem.key,
                              selectionLabel: evalItem.label,
                              odds: evalItem.odds,
                              stakePercent: evalItem.quarterKelly || 1.0,
                              stake: evalItem.stakeRec > 0 ? Math.round(evalItem.stakeRec) : Math.round(effectiveBankroll * 0.01),
                              stakeAmount: evalItem.stakeRec > 0 ? Math.round(evalItem.stakeRec) : Math.round(effectiveBankroll * 0.01),
                              modelProb: evalItem.prob,
                              evPercentage: evalItem.expectedValuePct,
                            })
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 font-sans font-semibold"
                      >
                        + Log Position
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
