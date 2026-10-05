// ---- QuantLab.jsx ----
// Institutional Quant Lab: Single-Match Quantitative Deep-Dive
// - Interactive Bivariate Poisson 6x6 Scoreline Heatmap with dynamic lambda overrides
// - 10,000-iteration client-side Monte Carlo variance distribution engine
// - Reverse Odds & True Fair-Value simulator with Quarter-Kelly sizing
// - Local React Error Boundary and safe mathematical property guards
// - Zero em dash characters (R-02 compliance)

import React, { Component, useState, useMemo, useEffect } from 'react'
import { computePoissonMatrix, calculateZeroVigOdds, calculateEdgeAndEV, getKellyFraction, runMonteCarloSimulation } from '../utils/analytics'
import FormGuide from './FormGuide'

// Parse decimal odds supporting both dot and comma notation
function parseOddsInput(val) {
  if (val == null) return 0
  const parsedOdd = parseFloat(String(val).replace(',', '.'))
  return Number.isFinite(parsedOdd) && parsedOdd > 1 ? parsedOdd : 0
}

function getResolvedFixtureOdds(fix) {
  if (!fix) return { home: '2.10', draw: '3.40', away: '3.50' }
  const h2h = fix.market_odds?.h2h || {}
  const rawH = typeof h2h.home === 'number' ? h2h.home : (h2h.home?.price || h2h.consensus?.home)
  const rawD = typeof h2h.draw === 'number' ? h2h.draw : (h2h.draw?.price || h2h.consensus?.draw)
  const rawA = typeof h2h.away === 'number' ? h2h.away : (h2h.away?.price || h2h.consensus?.away)
  return {
    home: String(rawH || fix.odds_home || fix.fair_odds_home || '2.10'),
    draw: String(rawD || fix.odds_draw || fix.fair_odds_draw || '3.40'),
    away: String(rawA || fix.odds_away || fix.fair_odds_away || '3.50'),
  }
}

// Safe clamp for expected goals lambda parameter
function safeClampLambda(val, fallback = 1.35) {
  const num = Number(val)
  if (!Number.isFinite(num) || num <= 0) return fallback
  return Math.max(0.6, Math.min(3.2, Number(num.toFixed(2))))
}


// Local React Error Boundary for Quant Lab workspace
class QuantLabErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('QuantLab Runtime Error caught by Boundary:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 my-6 text-center rounded-2xl bg-pitch-950 border border-rose-500/30 shadow-2xl max-w-xl mx-auto space-y-4 animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">
              Quantitative Calculation Interrupted
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              An unexpected value occurred during the simulation.
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-pitch-950 font-bold text-xs transition-colors shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Reset Target
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Inner workspace view guarded by non-null fixture
function QuantLabWorkspace({
  fixture,
  matchPool = [],
  onSelectFixture,
  standingsMap = {},
  onLogPosition,
  effectiveBankroll = 1000000,
  currencyCode = 'IDR',
  onBackToScanner,
}) {
  const initialHomeXg = Number(fixture?.home_xg) || Number(fixture?.lambda_home) || Number(fixture?.lambdaHome) || 1.35
  const initialAwayXg = Number(fixture?.away_xg) || Number(fixture?.lambda_away) || Number(fixture?.lambdaAway) || 1.10

  const initialH = safeClampLambda(initialHomeXg, 1.35)
  const initialA = safeClampLambda(initialAwayXg, 1.10)

  const [customLambdaH, setCustomLambdaH] = useState(initialH)
  const [customLambdaA, setCustomLambdaA] = useState(initialA)
  const [activeMarketOdds, setActiveMarketOdds] = useState(getResolvedFixtureOdds(fixture))

  // Synchronize when fixture changes
  useEffect(() => {
    if (fixture) {
      const hXg = safeClampLambda(Number(fixture?.home_xg) || Number(fixture?.lambda_home) || Number(fixture?.lambdaHome) || 1.35, 1.35)
      const aXg = safeClampLambda(Number(fixture?.away_xg) || Number(fixture?.lambda_away) || Number(fixture?.lambdaAway) || 1.10, 1.10)
      setCustomLambdaH(hXg)
      setCustomLambdaA(aXg)
      setActiveMarketOdds(getResolvedFixtureOdds(fixture))
    }
  }, [fixture])

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
      parseOddsInput(activeMarketOdds.home),
      parseOddsInput(activeMarketOdds.draw),
      parseOddsInput(activeMarketOdds.away)
    )
  }, [activeMarketOdds])

  // Safe team names and crests
  const homeName = fixture?.home_team?.name || fixture?.home_team_name || fixture?.homeTeam || 'Home Team'
  const awayName = fixture?.away_team?.name || fixture?.away_team_name || fixture?.awayTeam || 'Away Team'
  const homeLogo = fixture?.home_team?.crest_url || fixture?.home_team_logo || fixture?.homeLogo
  const awayLogo = fixture?.away_team?.crest_url || fixture?.away_team_logo || fixture?.awayLogo
  const leagueName = fixture?.league_name || fixture?.league || 'League'
  const matchDate = fixture?.match_date || fixture?.date || fixture?.kickoff_time

  // Calculate Edge & Kelly for each 1X2 outcome (with comma decimal support)
  const valueEvaluations = useMemo(() => {
    if (!matrixData) return []
    const parsedH = parseOddsInput(activeMarketOdds.home)
    const parsedD = parseOddsInput(activeMarketOdds.draw)
    const parsedA = parseOddsInput(activeMarketOdds.away)

    const outcomes = [
      { key: 'HOME', label: `${homeName} Win`, prob: matrixData.sumHomeWin || 0, odds: parsedH, rawInput: activeMarketOdds.home },
      { key: 'DRAW', label: 'Draw (X)', prob: matrixData.sumDraw || 0, odds: parsedD, rawInput: activeMarketOdds.draw },
      { key: 'AWAY', label: `${awayName} Win`, prob: matrixData.sumAwayWin || 0, odds: parsedA, rawInput: activeMarketOdds.away },
    ]

    return outcomes.map((item) => {
      const { netEdge, evPercent } = calculateEdgeAndEV(item.odds, item.prob)
      const rawKelly = getKellyFraction(item.odds, item.prob)
      // Quarter-Kelly with 2.5% safe cap
      const quarterKelly = Math.max(0, Math.min(2.5, Number((rawKelly * 0.25).toFixed(2))))
      const stakeRec = (effectiveBankroll * (quarterKelly / 100))

      return {
        ...item,
        netEdge,
        expectedValuePct: evPercent,
        quarterKelly,
        stakeRec,
        hasEdge: evPercent >= 2.0,
      }
    })
  }, [matrixData, activeMarketOdds, effectiveBankroll, homeName, awayName])

  // Standings metadata for active match
  const homeStandings = fixture ? (standingsMap[fixture?.home_team_id] || standingsMap[`${fixture?.league_id}_${fixture?.home_team_id}`] || null) : null
  const awayStandings = fixture ? (standingsMap[fixture?.away_team_id] || standingsMap[`${fixture?.league_id}_${fixture?.away_team_id}`] || null) : null

  // Team strength split metrics
  const homeAttack = fixture?.home_team?.home_attack ?? homeStandings?.home_attack ?? 1.0
  const homeDefense = fixture?.home_team?.home_defense ?? homeStandings?.home_defense ?? 1.0
  const awayAttack = fixture?.away_team?.away_attack ?? awayStandings?.away_attack ?? 1.0
  const awayDefense = fixture?.away_team?.away_defense ?? awayStandings?.away_defense ?? 1.0

  // Head-to-Head intelligence data
  const h2hData = fixture?.h2h_data || {}
  const recentMatches = Array.isArray(h2hData?.recentMatches) ? h2hData.recentMatches : []
  const totalH2hMatches = (h2hData?.homeWins ?? 0) + (h2hData?.draws ?? 0) + (h2hData?.awayWins ?? 0) || h2hData?.numberOfMatches || recentMatches.length

  // Reset to original model xG
  const handleResetModelXg = () => {
    if (fixture) {
      const hXg = safeClampLambda(Number(fixture?.home_xg) || Number(fixture?.lambda_home) || Number(fixture?.lambdaHome) || 1.35, 1.35)
      const aXg = safeClampLambda(Number(fixture?.away_xg) || Number(fixture?.lambda_away) || Number(fixture?.lambdaAway) || 1.10, 1.10)
      setCustomLambdaH(hXg)
      setCustomLambdaA(aXg)
    }
  }

  if (!fixture) {
    return (
      <div className="flex items-center justify-center p-8 text-neutral-400 font-mono text-sm bg-pitch-950/40 rounded-2xl border border-pitch-800 max-w-xl mx-auto my-12">
        No fixture selected or data unavailable.
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-28 sm:pb-12">
      {/* Top Match Selector & Identity Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
          {onBackToScanner && (
            <button
              type="button"
              onClick={onBackToScanner}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-pitch-950 hover:bg-pitch-800 text-slate-300 hover:text-amber-400 border border-pitch-700 text-xs font-mono font-semibold transition-all flex items-center gap-1.5 active:scale-95 touch-manipulation flex-shrink-0"
              title="Return to Terminal Scanner Table"
            >
              <span>&larr;</span>
              <span>Scanner</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-mono font-bold text-sm">
              ⚅
            </span>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Quantitative Research Lab
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 truncate">
                {homeName} vs {awayName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:ml-4 text-xs font-mono text-slate-400">
            <span className="px-2 py-0.5 rounded bg-pitch-950 border border-pitch-800 text-amber-300">
              {leagueName}
            </span>
            <span>
              {matchDate ? new Date(matchDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD'}
            </span>
          </div>
        </div>

        {/* Target Match Selector - Finger-friendly 44px min height */}
        {matchPool.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
            <label htmlFor="quant-match-select" className="text-xs text-slate-400 font-mono whitespace-nowrap">
              Target Match:
            </label>
            <select
              id="quant-match-select"
              value={fixture ? fixture.id : ''}
              onChange={(e) => {
                const targetId = e.target.value
                const found = matchPool.find((f) => String(f.id) === String(targetId))
                if (found && onSelectFixture) onSelectFixture(found)
              }}
              className="bg-pitch-950 border border-pitch-700 hover:border-amber-500/50 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans w-full lg:max-w-[340px] min-h-[44px] truncate cursor-pointer transition-colors touch-manipulation"
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

      {/* Interactive Lambda Overrides & Sensitivity Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Home Expected Goals (Lambda H) */}
        <div className="p-4 rounded-xl bg-pitch-900 border border-pitch-800/90 shadow-md flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {homeLogo && (
                <img src={homeLogo} alt="" className="w-5 h-5 object-contain" />
              )}
              <span className="text-xs font-bold text-slate-200 truncate">
                {homeName} xG (λH)
              </span>
            </div>
            <span className="text-base font-mono font-bold text-sky-400 tabular-nums">
              {customLambdaH.toFixed(2)}
            </span>
          </div>

          {/* Finger-friendly [-] and [+] Stepper Buttons for Mobile Precision */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCustomLambdaH(prev => Math.max(0.6, Number((prev - 0.05).toFixed(2))))}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-pitch-950 border border-pitch-700 hover:border-sky-500/50 active:bg-sky-500/20 text-sky-400 text-lg font-bold flex items-center justify-center transition-all select-none touch-manipulation active:scale-95"
              aria-label="Decrease Home expected goals by 0.05"
            >
              &minus;
            </button>
            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min="0.6"
                max="3.2"
                step="0.05"
                value={customLambdaH}
                onChange={(e) => setCustomLambdaH(parseFloat(e.target.value))}
                className="w-full accent-sky-400 bg-pitch-950 cursor-pointer h-3 rounded-lg touch-pan-x"
                aria-label="Home Expected Goals lambda slider"
              />
            </div>
            <button
              type="button"
              onClick={() => setCustomLambdaH(prev => Math.min(3.2, Number((prev + 0.05).toFixed(2))))}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-pitch-950 border border-pitch-700 hover:border-sky-500/50 active:bg-sky-500/20 text-sky-400 text-lg font-bold flex items-center justify-center transition-all select-none touch-manipulation active:scale-95"
              aria-label="Increase Home expected goals by 0.05"
            >
              +
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Model baseline: {fixture.home_xg != null ? Number(fixture.home_xg).toFixed(2) : (fixture.lambda_home ?? '1.35')}</span>
            {homeStandings?.home_played > 0 && (
              <span>Record: {homeStandings.home_goals_for}:{homeStandings.home_goals_against} in {homeStandings.home_played}H</span>
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-pitch-800/60">
            <span className="text-slate-400">Home Attack: <strong className="text-sky-400">{Number(homeAttack).toFixed(2)}x</strong></span>
            <span className="text-slate-400">Home Defense: <strong className="text-sky-300">{Number(homeDefense).toFixed(2)}x</strong></span>
          </div>
        </div>

        {/* Away Expected Goals (Lambda A) */}
        <div className="p-4 rounded-xl bg-pitch-900 border border-pitch-800/90 shadow-md flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {awayLogo && (
                <img src={awayLogo} alt="" className="w-5 h-5 object-contain" />
              )}
              <span className="text-xs font-bold text-slate-200 truncate">
                {awayName} xG (λA)
              </span>
            </div>
            <span className="text-base font-mono font-bold text-rose-400 tabular-nums">
              {customLambdaA.toFixed(2)}
            </span>
          </div>

          {/* Finger-friendly [-] and [+] Stepper Buttons for Mobile Precision */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCustomLambdaA(prev => Math.max(0.6, Number((prev - 0.05).toFixed(2))))}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-pitch-950 border border-pitch-700 hover:border-rose-500/50 active:bg-rose-500/20 text-rose-400 text-lg font-bold flex items-center justify-center transition-all select-none touch-manipulation active:scale-95"
              aria-label="Decrease Away expected goals by 0.05"
            >
              &minus;
            </button>
            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min="0.6"
                max="3.2"
                step="0.05"
                value={customLambdaA}
                onChange={(e) => setCustomLambdaA(parseFloat(e.target.value))}
                className="w-full accent-rose-400 bg-pitch-950 cursor-pointer h-3 rounded-lg touch-pan-x"
                aria-label="Away Expected Goals lambda slider"
              />
            </div>
            <button
              type="button"
              onClick={() => setCustomLambdaA(prev => Math.min(3.2, Number((prev + 0.05).toFixed(2))))}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-pitch-950 border border-pitch-700 hover:border-rose-500/50 active:bg-rose-500/20 text-rose-400 text-lg font-bold flex items-center justify-center transition-all select-none touch-manipulation active:scale-95"
              aria-label="Increase Away expected goals by 0.05"
            >
              +
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Model baseline: {fixture.away_xg != null ? Number(fixture.away_xg).toFixed(2) : (fixture.lambda_away ?? '1.10')}</span>
            {awayStandings?.away_played > 0 && (
              <span>Record: {awayStandings.away_goals_for}:{awayStandings.away_goals_against} in {awayStandings.away_played}A</span>
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-pitch-800/60">
            <span className="text-slate-400">Away Attack: <strong className="text-rose-400">{Number(awayAttack).toFixed(2)}x</strong></span>
            <span className="text-slate-400">Away Defense: <strong className="text-rose-300">{Number(awayDefense).toFixed(2)}x</strong></span>
          </div>
        </div>

        {/* Quick Sensitivity Reset & Consensus Total */}
        <div className="p-4 rounded-xl bg-pitch-900 border border-pitch-800/90 shadow-md flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase font-mono tracking-wider block mb-1">
              Joint Total Expected Goals
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold text-amber-300">
                {(customLambdaH + customLambdaA).toFixed(2)}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Goals Projected
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-pitch-800/80 mt-2">
            <button
              type="button"
              onClick={handleResetModelXg}
              className="px-3 py-1.5 rounded-lg bg-pitch-950 hover:bg-pitch-800 text-xs font-mono text-slate-300 border border-pitch-700 transition-colors"
            >
              Reset Baseline
            </button>
            <span className="text-[11px] text-slate-500 font-mono">
              Bivariate Poisson Core
            </span>
          </div>
        </div>
      </div>

      {/* Grid: 6x6 Bivariate Heatmap + 10k Monte Carlo Variance Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 6x6 Bivariate Poisson Heatmap */}
        <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-pitch-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Interactive 6x6 Poisson Score Matrix</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-pitch-950 text-slate-400 border border-pitch-800">
                  λ: {customLambdaH.toFixed(2)} v {customLambdaA.toFixed(2)}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Exact probability for each scoreline (0-5 goals).
              </p>
            </div>
            {matrixData?.mostProbable && (() => {
              const h = matrixData.mostProbable.home
              const a = matrixData.mostProbable.away
              const cell = matrixData.matrix?.[a]?.[h] || matrixData.mostProbable
              return (
                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Model Mode</span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {h}-{a} ({cell.prob.toFixed(1)}%)
                  </span>
                </div>
              )
            })()}
          </div>

          {/* Matrix Heatmap Grid */}
          <div className="overflow-x-auto touch-pan-x">
            <table className="w-full text-center border-collapse text-xs font-mono select-none">
              <thead>
                <tr>
                  <th className="p-1.5 text-slate-500 text-[10px]" title="Away (row) \ Home (col)">A \ H</th>
                  {[0, 1, 2, 3, 4, 5].map((h) => (
                    <th key={h} className="p-1.5 font-bold text-sky-400 text-xs">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(matrixData?.matrix || []).map((row, awayGoals) => (
                  <tr key={awayGoals}>
                    <th className="p-1.5 font-bold text-rose-400 text-xs">
                      {awayGoals}
                    </th>
                    {row.map((cell) => {
                      const h = cell.home
                      const a = cell.away
                      const isMostProb = h === matrixData?.mostProbable?.home && a === matrixData?.mostProbable?.away
                      const alpha = Math.min(1, Math.max(0.08, (cell.prob / (matrixData?.maxProb || 1)) * 0.95))
                      const isHomeFav = h > a
                      const isAwayFav = a > h
                      const isDraw = h === a

                      let bgStyle = `rgba(51, 65, 85, ${alpha})`
                      if (isHomeFav) bgStyle = `rgba(14, 165, 233, ${alpha})`
                      else if (isAwayFav) bgStyle = `rgba(244, 63, 94, ${alpha})`
                      else if (isDraw) bgStyle = `rgba(245, 158, 11, ${alpha})`

                      return (
                        <td
                          key={h}
                          className="p-0.5 sm:p-1.5 transition-transform hover:scale-105"
                          title={`${h}-${a}: ${cell.prob.toFixed(2)}%`}
                        >
                          <div
                            style={{ backgroundColor: bgStyle }}
                            className={`aspect-square sm:aspect-auto py-1 sm:py-2 px-0.5 sm:px-1 rounded-lg flex flex-col items-center justify-center min-w-[32px] sm:min-w-[42px] ${
                              isMostProb ? 'ring-2 ring-amber-400 font-bold shadow-lg shadow-amber-500/20' : ''
                            }`}
                          >
                            <span className="text-[9px] sm:text-[11px] font-bold text-slate-100 leading-none">
                              {cell.prob.toFixed(1)}%
                            </span>
                            <span className="text-[8px] sm:text-[9px] text-slate-400 font-semibold mt-0.5 sm:mt-1 leading-none">
                              {h}-{a}
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

          {/* Matrix Aggregates */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-pitch-800 text-center font-mono">
            <div className="p-2 rounded-xl bg-pitch-950/70 border border-sky-500/20">
              <span className="text-[10px] text-slate-400 block">{homeName} Win</span>
              <span className="text-sm font-bold text-sky-400">{matrixData?.sumHomeWin.toFixed(1)}%</span>
            </div>
            <div className="p-2 rounded-xl bg-pitch-950/70 border border-amber-500/20">
              <span className="text-[10px] text-slate-400 block">Draw</span>
              <span className="text-sm font-bold text-amber-400">{matrixData?.sumDraw.toFixed(1)}%</span>
            </div>
            <div className="p-2 rounded-xl bg-pitch-950/70 border border-rose-500/20">
              <span className="text-[10px] text-slate-400 block">{awayName} Win</span>
              <span className="text-sm font-bold text-rose-400">{matrixData?.sumAwayWin.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Right Column: 10,000 Monte Carlo Simulation Deck */}
        <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-pitch-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>10,000 Monte Carlo Variance</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Live Engine
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  10k simulated matches under current xG lambdas.
                </p>
              </div>
            </div>

            {/* Clean Sheets & BTTS */}
            <div className="mt-4 space-y-3">
              <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400 block">
                Defensive & Goal Market Tendencies
              </span>
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2.5 rounded-xl bg-pitch-950 border border-pitch-800">
                  <span className="text-[10px] text-slate-500 block truncate">{homeName} CS</span>
                  <span className="text-base font-bold text-sky-400">{simResults?.homeCleanSheetPct ?? 0}%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-pitch-950 border border-pitch-800">
                  <span className="text-[10px] text-slate-500 block truncate">BTTS Yes</span>
                  <span className="text-base font-bold text-emerald-400">{simResults?.bttsPct ?? 0}%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-pitch-950 border border-pitch-800">
                  <span className="text-[10px] text-slate-500 block truncate">{awayName} CS</span>
                  <span className="text-base font-bold text-rose-400">{simResults?.awayCleanSheetPct ?? 0}%</span>
                </div>
              </div>
            </div>

            {/* Total Goals Bracket Distribution */}
            <div className="mt-4 space-y-2">
              <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400 block">
                Total Goal Brackets
              </span>
              <div className="space-y-1.5 font-mono text-xs">
                {[
                  { label: '0 to 1 Goals', pct: simResults?.brackets?.bracket01Pct ?? 0, color: 'bg-slate-500' },
                  { label: '2 to 3 Goals', pct: simResults?.brackets?.bracket23Pct ?? 0, color: 'bg-emerald-500' },
                  { label: '4 to 5 Goals', pct: simResults?.brackets?.bracket45Pct ?? 0, color: 'bg-amber-500' },
                  { label: '6+ Goals', pct: simResults?.brackets?.bracket6PlusPct ?? 0, color: 'bg-rose-500' },
                ].map((b) => (
                  <div key={b.label} className="flex items-center justify-between gap-3 p-1.5 rounded-lg bg-pitch-950/60">
                    <span className="text-slate-300 w-24 flex-shrink-0">{b.label}</span>
                    <div className="flex-1 bg-pitch-900 rounded-full h-2 overflow-hidden">
                      <div className={`h-full ${b.color} rounded-full`} style={{ width: `${b.pct}%` }} />
                    </div>
                    <span className="w-12 text-right text-slate-200 font-bold">{b.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Margin of Victory Distribution */}
            <div className="mt-4 space-y-2">
              <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400 block">
                Victory Margins
              </span>
              <div className="grid grid-cols-5 gap-1.5 text-center font-mono text-xs">
                <div className="p-2 rounded-lg bg-pitch-950 border border-sky-500/20">
                  <span className="text-[9px] text-slate-400 block truncate">H By 2+</span>
                  <span className="font-bold text-sky-400">{simResults?.margins?.homeBy2PlusPct ?? 0}%</span>
                </div>
                <div className="p-2 rounded-lg bg-pitch-950 border border-sky-500/10">
                  <span className="text-[9px] text-slate-400 block truncate">H By 1</span>
                  <span className="font-bold text-sky-300">{simResults?.margins?.homeBy1Pct ?? 0}%</span>
                </div>
                <div className="p-2 rounded-lg bg-pitch-950 border border-amber-500/20">
                  <span className="text-[9px] text-slate-400 block truncate">Draw</span>
                  <span className="font-bold text-amber-400">{simResults?.margins?.drawsPct ?? 0}%</span>
                </div>
                <div className="p-2 rounded-lg bg-pitch-950 border border-rose-500/10">
                  <span className="text-[9px] text-slate-400 block truncate">A By 1</span>
                  <span className="font-bold text-rose-300">{simResults?.margins?.awayBy1Pct ?? 0}%</span>
                </div>
                <div className="p-2 rounded-lg bg-pitch-950 border border-rose-500/20">
                  <span className="text-[9px] text-slate-400 block truncate">A By 2+</span>
                  <span className="font-bold text-rose-400">{simResults?.margins?.awayBy2PlusPct ?? 0}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-pitch-800 text-[10px] text-slate-500 font-mono text-right">
            Monte Carlo pseudorandom Knuth transform. 10,000 runs.
          </div>
        </div>
      </div>

      {/* Head-to-Head (H2H) Intelligence Section */}
      <div className="p-4 sm:p-5 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pitch-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold font-mono text-sm">
              ⚔
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Head-to-Head Intelligence</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-pitch-950 text-slate-400 border border-pitch-800">
                  {h2hData?.numberOfMatches ? `${h2hData.numberOfMatches} Encounters` : 'Recent History'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Historical encounter track record and goal breakdown between {homeName} and {awayName}.
              </p>
            </div>
          </div>
          {(fixture?.venue || fixture?.referee?.name) && (
            <div className="text-xs font-mono text-slate-400 flex flex-wrap items-center gap-2">
              {fixture.venue && (
                <span className="px-2 py-0.5 rounded bg-pitch-950 border border-pitch-800 text-slate-300">
                  Stadion: {fixture.venue}
                </span>
              )}
              {fixture.referee?.name && (
                <span className="px-2 py-0.5 rounded bg-pitch-950 border border-pitch-800 text-slate-300">
                  Wasit: {fixture.referee.name} ({fixture.referee.nationality || 'FIFA'})
                </span>
              )}
            </div>
          )}
        </div>

        {/* H2H Win Ratio & Aggregates Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-pitch-950 border border-pitch-800">
            <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
              {homeName} Wins
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-sky-400">
                {h2hData?.homeWins ?? 0}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {totalH2hMatches > 0 ? `${Math.round(((h2hData?.homeWins ?? 0) / totalH2hMatches) * 100)}%` : '0%'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-pitch-950 border border-pitch-800">
            <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
              Draws
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-amber-400">
                {h2hData?.draws ?? 0}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {totalH2hMatches > 0 ? `${Math.round(((h2hData?.draws ?? 0) / totalH2hMatches) * 100)}%` : '0%'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-pitch-950 border border-pitch-800">
            <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
              {awayName} Wins
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-rose-400">
                {h2hData?.awayWins ?? 0}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {totalH2hMatches > 0 ? `${Math.round(((h2hData?.awayWins ?? 0) / totalH2hMatches) * 100)}%` : '0%'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-pitch-950 border border-pitch-800">
            <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">
              Total Goals
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-emerald-400">
                {h2hData?.totalGoals ?? 0}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {totalH2hMatches > 0 ? `${((h2hData?.totalGoals ?? 0) / totalH2hMatches).toFixed(1)} / game` : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* 5 Recent Encounters Table / Cards */}
        <div className="space-y-2">
          <span className="text-xs font-mono uppercase text-slate-400 tracking-wider block">
            Last 5 Encounters
          </span>
          {recentMatches.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              {recentMatches.map((m, idx) => {
                const isHomeWin = (m.homeScore != null && m.awayScore != null && m.homeScore > m.awayScore)
                const isAwayWin = (m.homeScore != null && m.awayScore != null && m.awayScore > m.homeScore)
                const isDraw = (m.homeScore != null && m.awayScore != null && m.homeScore === m.awayScore)

                return (
                  <div
                    key={m.id || idx}
                    className="p-3 rounded-xl bg-pitch-950 border border-pitch-800/80 flex flex-col justify-between space-y-2 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-pitch-850 pb-1">
                      <span>{m.date || (m.utcDate ? m.utcDate.slice(0, 10) : 'Past Match')}</span>
                      <span className="text-slate-400 uppercase font-semibold">{m.competition || 'LEAG'}</span>
                    </div>

                    <div className="space-y-1 my-1">
                      <div className="flex items-center justify-between">
                        <span className={`truncate text-[11px] ${isHomeWin ? 'text-slate-100 font-bold' : 'text-slate-400'}`}>
                          {m.homeTeam || homeName}
                        </span>
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${isHomeWin ? 'bg-sky-500/20 text-sky-400' : 'text-slate-300'}`}>
                          {m.homeScore != null ? m.homeScore : '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`truncate text-[11px] ${isAwayWin ? 'text-slate-100 font-bold' : 'text-slate-400'}`}>
                          {m.awayTeam || awayName}
                        </span>
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${isAwayWin ? 'bg-rose-500/20 text-rose-400' : 'text-slate-300'}`}>
                          {m.awayScore != null ? m.awayScore : '-'}
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] text-center pt-1 border-t border-pitch-850">
                      {isHomeWin && <span className="text-sky-400 font-semibold">{m.homeTeam || homeName} Win</span>}
                      {isAwayWin && <span className="text-rose-400 font-semibold">{m.awayTeam || awayName} Win</span>}
                      {isDraw && <span className="text-amber-400 font-semibold">Draw</span>}
                      {!isHomeWin && !isAwayWin && !isDraw && <span className="text-slate-500">Completed</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-pitch-950 border border-pitch-800 text-center text-xs font-mono text-slate-500">
              No historical head-to-head fixtures recorded for this matchup.
            </div>
          )}
        </div>
      </div>

      {/* Reverse Odds Fair-Value Simulator & One-Click Portfolio Logging */}
      <div className="p-4 sm:p-5 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pitch-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Reverse Odds Fair-Value Simulator & Kelly Allocation</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                Quarter-Kelly 2.5% Cap
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Enter custom bookmaker decimal odds to calculate true fair odds, net EV, and safe position sizing.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Active Bankroll: <strong className="text-amber-400">{currencyCode} {effectiveBankroll.toLocaleString()}</strong>
          </div>
        </div>

        {/* 1X2 Reverse Odds Input Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { key: 'home', label: `${homeName} (1)`, prob: matrixData?.sumHomeWin || 0, odds: activeMarketOdds.home },
            { key: 'draw', label: 'Draw (X)', prob: matrixData?.sumDraw || 0, odds: activeMarketOdds.draw },
            { key: 'away', label: `${awayName} (2)`, prob: matrixData?.sumAwayWin || 0, odds: activeMarketOdds.away },
          ].map((item) => {
            const evalItem = valueEvaluations.find((v) => v.key === item.key.toUpperCase()) || {}
            const fairOdds = evalItem.prob > 0 ? (100 / evalItem.prob).toFixed(2) : '-'

            return (
              <div
                key={item.key}
                className={`p-4 rounded-xl bg-pitch-950 border transition-all ${
                  evalItem.hasEdge
                    ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                    : 'border-pitch-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-200 truncate">{item.label}</span>
                  {evalItem.hasEdge && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      +EV Edge
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 uppercase font-mono block mb-1">
                      Market Odds
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 2.10 or 15,5"
                      value={activeMarketOdds[item.key]}
                      onChange={(e) => {
                        const val = e.target.value
                        if (/^[0-9.,]*$/.test(val)) {
                          setActiveMarketOdds((prev) => ({ ...prev, [item.key]: val }))
                        }
                      }}
                      className="w-full min-h-[44px] bg-pitch-900 border border-pitch-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block mb-1">
                      True Fair Odds
                    </span>
                    <span className="text-sm font-mono font-bold text-amber-300">
                      {fairOdds}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-pitch-800/80 font-mono text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Model Probability:</span>
                    <span className="text-slate-200 font-bold">{evalItem.prob ? evalItem.prob.toFixed(1) : '-'}%</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-xs">Expected Value (EV):</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-colors ${
                      evalItem.expectedValuePct > 0
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-pitch-900 text-slate-500 border border-pitch-800'
                    }`}>
                      {evalItem.expectedValuePct > 0 ? `+${evalItem.expectedValuePct.toFixed(1)}%` : `${(evalItem.expectedValuePct || 0).toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Quarter-Kelly Stake:</span>
                    <span className="text-amber-300 font-bold">
                      {evalItem.quarterKelly || 0}% ({currencyCode} {Math.round(evalItem.stakeRec || 0).toLocaleString()})
                    </span>
                  </div>
                </div>

                {/* Log Position Action */}
                <div className="pt-3 mt-3 border-t border-pitch-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (onLogPosition) {
                        onLogPosition({
                          id: `pos_${Date.now()}_${item.key}`,
                          fixture: `${homeName} vs ${awayName}`,
                          fixtureName: `${homeName} vs ${awayName}`,
                          fixtureMatch: `${homeName} vs ${awayName}`,
                          leagueName: leagueName,
                          selection: evalItem.label,
                          selectionLabel: evalItem.label,
                          selectionName: evalItem.label,
                          odds: evalItem.odds,
                          stake: evalItem.stakeRec > 0 ? Math.round(evalItem.stakeRec) : Math.round(effectiveBankroll * 0.01),
                          stakeAmount: evalItem.stakeRec > 0 ? Math.round(evalItem.stakeRec) : Math.round(effectiveBankroll * 0.01),
                          modelProb: evalItem.prob,
                          ev: evalItem.expectedValuePct,
                          evPercent: evalItem.expectedValuePct,
                          status: 'PENDING',
                          loggedAt: new Date().toISOString(),
                          notes: `Logged from Quant Lab (xG: ${customLambdaH.toFixed(2)} v ${customLambdaA.toFixed(2)})`
                        })
                      }
                    }}
                    className={`w-full min-h-[44px] py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 touch-manipulation active:scale-98 ${
                      evalItem.hasEdge
                        ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                        : 'bg-pitch-900 hover:bg-pitch-800 text-slate-400 border border-pitch-800'
                    }`}
                  >
                    <span>⊞ Log to Portfolio</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Main QuantLab export with null guard and error boundary
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
  onBackToScanner,
}) {
  const matchPool = ((allFixtures && allFixtures.length > 0) ? allFixtures : (fixtures || [])).filter(Boolean)
  const targetFixture = fixture || selectedFixture || (matchPool.length > 0 ? (
    [...matchPool].filter(f => Boolean(f?.value_pick)).sort((a,b) => (b?.ev_percentage || 0) - (a?.ev_percentage || 0))[0] || matchPool[0]
  ) : null)

  // Safe Null Guard at top of QuantLab
  if (!targetFixture) {
    return (
      <div className="flex items-center justify-center p-8 text-neutral-400 font-mono text-sm bg-pitch-950/40 rounded-2xl border border-pitch-800 max-w-xl mx-auto my-12">
        No fixture selected or data unavailable.
      </div>
    )
  }

  return (
    <QuantLabErrorBoundary
      onReset={() => {
        if (matchPool.length > 0 && onSelectFixture) {
          onSelectFixture(matchPool[0])
        }
      }}
    >
      <QuantLabWorkspace
        fixture={targetFixture}
        matchPool={matchPool}
        onSelectFixture={onSelectFixture}
        standingsMap={standingsMap}
        onLogPosition={onLogPosition}
        effectiveBankroll={userBankroll || bankrollAmount || 1000000}
        currencyCode={currencyCode}
        onBackToScanner={onBackToScanner}
      />
    </QuantLabErrorBoundary>
  )
}
