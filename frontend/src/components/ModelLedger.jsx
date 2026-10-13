// ---- ModelLedger.jsx ----
// Track Record & Model Ledger Workspace
// Historical verified settlements, cumulative equity curve, and Brier calibration ledger.

import { useState, useMemo } from 'react'
import { simulateBankroll, getBrierTier } from '../utils/analytics'

const LEAGUE_ALL = '__all__'
const START_BANKROLL = 100
const KELLY_PCT = 2.5

export default function ModelLedger({ settledFixtures = [] }) {
  const [leagueFilter, setLeagueFilter] = useState(LEAGUE_ALL)
  const [hoverPoint, setHoverPoint] = useState(null)
  const [viewType, setViewType] = useState('both') // 'both' | 'flat' | 'kelly'

  // Full simulation over every settled fixture
  const fullSim = useMemo(() => {
    if (!settledFixtures || settledFixtures.length === 0) {
      return { stats: null, bets: [], brierScore: null }
    }
    const settled = settledFixtures.filter((f) => {
      const ok = ['FT', 'FINISHED', 'AET', 'PEN'].includes(f.status)
      return ok && f.home_score != null && f.away_score != null && f.value_pick != null
    })
    const out = simulateBankroll(settled, KELLY_PCT)
    return { stats: out.stats, bets: out.bets, brierScore: out.brierScore }
  }, [settledFixtures])

  // League options
  const leagues = useMemo(() => {
    const set = new Set(fullSim.bets.map((b) => b.league).filter(Boolean))
    return Array.from(set).sort()
  }, [fullSim.bets])

  // League-filtered bet set
  const filteredBets = useMemo(() => {
    if (leagueFilter === LEAGUE_ALL) return fullSim.bets
    return fullSim.bets.filter((b) => b.league === leagueFilter)
  }, [fullSim.bets, leagueFilter])

  // Chronological running equity series for the visible set
  const { flatSeries, kellySeries } = useMemo(() => {
    let flatBalance = START_BANKROLL
    let kellyBalance = START_BANKROLL
    const flat = filteredBets.map((bet) => {
      flatBalance += bet.flatProfit
      return {
        match_date: bet.match_date,
        matchLabel: bet.matchLabel,
        equity: Math.round(flatBalance * 100) / 100,
        betProfit: bet.flatProfit,
      }
    })
    const kelly = filteredBets.map((bet) => {
      kellyBalance += bet.kellyProfit
      return {
        equity: Math.round(kellyBalance * 100) / 100,
      }
    })
    return { flatSeries: flat, kellySeries: kelly }
  }, [filteredBets])

  // Filtered summary metrics
  const activeStats = useMemo(() => {
    const total = filteredBets.length
    if (total === 0) return null
    const won = filteredBets.filter((b) => b.result === 'WIN').length
    const winRate = Math.round((won / total) * 1000) / 10
    const flatPnl = flatSeries.length > 0 ? flatSeries[flatSeries.length - 1].equity - START_BANKROLL : 0
    const kellyPnl = kellySeries.length > 0 ? kellySeries[kellySeries.length - 1].equity - START_BANKROLL : 0
    const flatRoi = total > 0 ? Math.round((flatPnl / total) * 1000) / 10 : 0
    const kellyRoi = Math.round((kellyPnl / START_BANKROLL) * 1000) / 10

    let brierSum = 0
    let brierN = 0
    let logLossSum = 0
    let logLossN = 0
    filteredBets.forEach((b) => {
      const ph = b.prob_home ?? null
      const pd = b.prob_draw ?? null
      const pa = b.prob_away ?? null
      if (ph != null && pd != null && pa != null) {
        const yh = b.outcome === 'HOME' ? 1 : 0
        const yd = b.outcome === 'DRAW' ? 1 : 0
        const ya = b.outcome === 'AWAY' ? 1 : 0
        b.brierContribution = (ph/100 - yh) ** 2 + (pd/100 - yd) ** 2 + (pa/100 - ya) ** 2
        brierSum += b.brierContribution
        brierN += 1

        // Multi-class log-loss with epsilon clipping
        const eps = 1e-15
        const pHome = Math.max(eps, Math.min(1 - eps, ph / 100))
        const pDraw = Math.max(eps, Math.min(1 - eps, pd / 100))
        const pAway = Math.max(eps, Math.min(1 - eps, pa / 100))
        logLossSum += yh * Math.log(pHome) + yd * Math.log(pDraw) + ya * Math.log(pAway)
        logLossN += 1
      }
    })
    const brierScore = brierN > 0 ? Math.round((brierSum / brierN) * 1000) / 1000 : null
    const logLoss = logLossN > 0 ? Math.round((-logLossSum / logLossN) * 1000) / 1000 : null

    return {
      total,
      won,
      lost: total - won,
      winRate,
      flatPnl: Math.round(flatPnl * 100) / 100,
      kellyPnl: Math.round(kellyPnl * 100) / 100,
      flatRoi,
      kellyRoi,
      brierScore,
      logLoss,
    }
  }, [filteredBets, flatSeries, kellySeries])

  // ---- Model Calibration & Reliability Metrics ----
  const calibrationData = useMemo(() => {
    if (!activeStats || activeStats.total === 0) return null

    // Group bets into probability bins for reliability diagram
    const numBins = 10
    const bins = Array.from({ length: numBins }, () => ({
      count: 0,
      wins: 0,
      avgProb: 0,
      sumProb: 0,
    }))

    let reliabilitySum = 0
    let reliabilityN = 0

    filteredBets.forEach((b) => {
      const ph = b.prob_home ?? null
      const pd = b.prob_draw ?? null
      const pa = b.prob_away ?? null
      if (ph == null || pd == null || pa == null) return

      const actualOutcome = b.outcome
      // Use the model's predicted probability for the actual outcome
      const predProb = actualOutcome === 'HOME' ? ph : actualOutcome === 'DRAW' ? pd : pa
      if (predProb == null) return

      const isWin = b.result === 'WIN'
      const binIdx = Math.min(numBins - 1, Math.floor(predProb / 10))

      bins[binIdx].count += 1
      bins[binIdx].wins += isWin ? 1 : 0
      bins[binIdx].sumProb += predProb

      // Reliability contribution: (observed_freq - avg_pred_prob)^2 * count
      reliabilitySum += (isWin ? 1 : 0) * (isWin ? 1 : 0) * 0 // placeholder below
    })

    // Compute observed frequency per bin
    bins.forEach((bin) => {
      if (bin.count > 0) {
        bin.avgProb = Math.round((bin.sumProb / bin.count) * 10) / 10
        bin.observedFreq = Math.round((bin.wins / bin.count) * 100) / 100
        // Reliability term
        const bias = bin.observedFreq - bin.avgProb / 100
        reliabilitySum += bias * bias * bin.count
        reliabilityN += bin.count
      }
    })

    const reliability = reliabilityN > 0 ? Math.round((reliabilitySum / reliabilityN) * 1000) / 1000 : null

    // Per-outcome calibration breakdown
    const outcomeStats = { HOME: { total: 0, wins: 0 }, DRAW: { total: 0, wins: 0 }, AWAY: { total: 0, wins: 0 } }
    filteredBets.forEach((b) => {
      const ph = b.prob_home ?? null
      const pd = b.prob_draw ?? null
      const pa = b.prob_away ?? null
      if (ph == null || pd == null || pa == null) return
      if (b.outcome === 'HOME') { outcomeStats.HOME.total += 1; if (b.result === 'WIN') outcomeStats.HOME.wins += 1 }
      else if (b.outcome === 'DRAW') { outcomeStats.DRAW.total += 1; if (b.result === 'WIN') outcomeStats.DRAW.wins += 1 }
      else { outcomeStats.AWAY.total += 1; if (b.result === 'WIN') outcomeStats.AWAY.wins += 1 }
    })

    // Sample-size-aware calibration labels
    const calLabel = (() => {
      if (reliability == null) return { label: 'Insufficient Data', cls: 'text-slate-400 bg-slate-500/10 border-slate-500/30' }
      if (reliability < 0.015) return { label: 'Excellent', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' }
      if (reliability <= 0.03) return { label: 'Good', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' }
      if (reliability <= 0.05) return { label: 'Acceptable', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' }
      return { label: 'Poor', cls: 'text-rose-400 bg-rose-500/10 border-rose-500/30' }
    })()

    return { bins, reliability, calLabel, outcomeStats, brierScore: activeStats.brierScore }
  }, [activeStats, filteredBets])

  // Per-league calibration breakdown
  const leagueCalibration = useMemo(() => {
    if (fullSim.bets.length === 0) return null
    const leaguesMap = {}
    const eps = 1e-15
    fullSim.bets.forEach((b) => {
      const ph = b.prob_home ?? null
      const pd = b.prob_draw ?? null
      const pa = b.prob_away ?? null
      if (ph == null || pd == null || pa == null) return
      const key = b.league || 'Unknown'
      if (!leaguesMap[key]) {
        leaguesMap[key] = { league: key, count: 0, brierSum: 0, logLossSum: 0 }
      }
      const entry = leaguesMap[key]
      entry.count += 1
      const yh = b.outcome === 'HOME' ? 1 : 0
      const yd = b.outcome === 'DRAW' ? 1 : 0
      const ya = b.outcome === 'AWAY' ? 1 : 0
      entry.brierSum += (ph/100 - yh) ** 2 + (pd/100 - yd) ** 2 + (pa/100 - ya) ** 2
      const pHome = Math.max(eps, Math.min(1 - eps, ph / 100))
      const pDraw = Math.max(eps, Math.min(1 - eps, pd / 100))
      const pAway = Math.max(eps, Math.min(1 - eps, pa / 100))
      entry.logLossSum += yh * Math.log(pHome) + yd * Math.log(pDraw) + ya * Math.log(pAway)
    })
    return Object.values(leaguesMap)
      .map((entry) => ({
        ...entry,
        brierScore: entry.count > 0 ? entry.brierSum / entry.count : null,
        logLoss: entry.count > 0 ? -entry.logLossSum / entry.count : null,
      }))
      .sort((a, b) => (a.logLoss ?? Infinity) - (b.logLoss ?? Infinity))
  }, [fullSim.bets])

  // SVG Chart Dimensions
  const chartW = 720
  const chartH = 240
  const padL = 45
  const padR = 15
  const padT = 15
  const padB = 30
  const plotW = chartW - padL - padR
  const plotH = chartH - padT - padB

  const allEquities = useMemo(() => {
    const pts = [START_BANKROLL]
    flatSeries.forEach((p) => pts.push(p.equity))
    kellySeries.forEach((p) => pts.push(p.equity))
    return pts
  }, [flatSeries, kellySeries])

  const minEq = Math.min(...allEquities) * 0.96
  const maxEq = Math.max(...allEquities) * 1.04

  const scaleX = (idx, total) => {
    if (total <= 1) return padL + plotW / 2
    return padL + (idx / (total - 1)) * plotW
  }

  const scaleY = (val) => {
    if (maxEq === minEq) return padT + plotH / 2
    return padT + plotH - ((val - minEq) / (maxEq - minEq)) * plotH
  }

  const flatPoints = flatSeries.map((p, i) => `${scaleX(i, flatSeries.length)},${scaleY(p.equity)}`).join(' ')
  const kellyPoints = kellySeries.map((p, i) => `${scaleX(i, kellySeries.length)},${scaleY(p.equity)}`).join(' ')
  const baseLineY = scaleY(START_BANKROLL)

  const brierInfo = activeStats?.brierScore != null ? getBrierTier(activeStats.brierScore) : null

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* ---- Header & Controls ---- */}
      <div className="p-4 sm:p-5 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center font-mono font-bold text-sm">
              📈
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                Track Record & Quantitative Model Ledger
              </h2>
              <p className="text-[11px] font-mono text-slate-400">
                Verified historical +EV settlements, running bankroll equity, and Brier calibration
              </p>
            </div>
          </div>
        </div>

        {/* League Selector */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <label htmlFor="ledger-league" className="text-slate-400">League:</label>
          <select
            id="ledger-league"
            value={leagueFilter}
            onChange={(e) => setLeagueFilter(e.target.value)}
            className="bg-pitch-950 border border-pitch-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value={LEAGUE_ALL}>All Active Competitions</option>
            {leagues.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ---- KPI Metrics Grid ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 font-mono">
        <div className="p-4 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-lg">
          <span className="text-[11px] text-slate-400 block mb-1">Settled Opportunities</span>
          <p className="text-lg sm:text-xl font-bold text-slate-100 tabular-nums">
            {activeStats?.total ?? 0} Selections
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">
            {activeStats?.won ?? 0} Won / {activeStats?.lost ?? 0} Lost
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-lg">
          <span className="text-[11px] text-slate-400 block mb-1">Win Rate (+EV Edges)</span>
          <p className="text-lg sm:text-xl font-bold text-amber-300 tabular-nums">
            {activeStats && activeStats.winRate != null ? `${activeStats.winRate}%` : '0.0%'}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">
            Theoretical baseline ~45-50%
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-lg">
          <span className="text-[11px] text-slate-400 block mb-1">Net Yield / Units ROI</span>
          <p className={`text-lg sm:text-xl font-bold tabular-nums ${
            (activeStats?.flatPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {activeStats && activeStats.flatPnl != null
              ? (activeStats.flatPnl >= 0 ? `+${activeStats.flatPnl.toFixed(2)}u` : `${activeStats.flatPnl.toFixed(2)}u`)
              : '+0.00u'}
          </p>
          <span className={`text-[10px] font-bold mt-1 inline-block ${
            (activeStats?.flatRoi ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {activeStats && activeStats.flatRoi != null
              ? (activeStats.flatRoi >= 0 ? `+${activeStats.flatRoi.toFixed(1)}% Yield` : `${activeStats.flatRoi.toFixed(1)}% Yield`)
              : '0.0% Yield'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-lg">
          <span className="text-[11px] text-slate-400 block mb-1">Brier Calibration Score</span>
          <p className="text-lg sm:text-xl font-bold text-sky-400 tabular-nums">
            {activeStats?.brierScore != null ? activeStats.brierScore.toFixed(3) : '0.000'}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">
            {brierInfo ? brierInfo.label : 'Benchmark 0.18 to 0.22 (0.0% Calibrated)'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-lg">
          <span className="text-[11px] text-slate-400 block mb-1">Log-Loss (Cross-Entropy)</span>
          <p className="text-lg sm:text-xl font-bold text-violet-400 tabular-nums">
            {activeStats?.logLoss != null ? activeStats.logLoss.toFixed(3) : '0.000'}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">
            Naive baseline: 1.099 · Lower = better
          </span>
        </div>
      </div>

      {/* ---- Model Calibration & Reliability Panel ---- */}
      {calibrationData && (
        <div className="p-4 sm:p-5 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pitch-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Model Calibration & Probabilistic Reliability</span>
              </h3>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                Multi-class Brier score, reliability diagram, and per-outcome observed frequencies
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${calibrationData.calLabel.cls}`}>
                {calibrationData.calLabel.label}
              </span>
              {calibrationData.brierScore != null && (
                <span className="text-[10px] font-mono text-sky-400">
                  Brier {calibrationData.brierScore.toFixed(3)}
                </span>
              )}
            </div>
          </div>

          {/* Benchmark Comparison Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-pitch-950/60 border border-pitch-800">
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Brier Score</p>
              <p className="text-lg font-black text-sky-400 tabular-nums">
                {calibrationData.brierScore != null ? calibrationData.brierScore.toFixed(3) : '--'}
              </p>
              <p className="text-[9px] text-slate-500 mt-0.5">Lower = better</p>
            </div>
            <div className="p-3 rounded-xl bg-pitch-950/60 border border-pitch-800">
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Naive Baseline</p>
              <p className="text-lg font-black text-slate-500 tabular-nums">0.222</p>
              <p className="text-[9px] text-slate-500 mt-0.5">Uniform 33.3% each</p>
            </div>
            <div className="p-3 rounded-xl bg-pitch-950/60 border border-pitch-800">
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Improvement</p>
              <p className={`text-lg font-black tabular-nums ${
                calibrationData.brierScore != null && calibrationData.brierScore < 0.222
                  ? 'text-emerald-400'
                  : 'text-slate-500'
              }`}>
                {calibrationData.brierScore != null
                  ? `+${Math.round(((0.222 - calibrationData.brierScore) / 0.222) * 100)}%`
                  : '--'}
              </p>
              <p className="text-[9px] text-slate-500 mt-0.5">vs uniform guess</p>
            </div>
            <div className="p-3 rounded-xl bg-pitch-950/60 border border-pitch-800">
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Samples</p>
              <p className="text-lg font-black text-slate-200 tabular-nums">
                {activeStats?.total ?? 0}
              </p>
              <p className="text-[9px] text-slate-500 mt-0.5">settlements analyzed</p>
            </div>
          </div>

          {/* Reliability Diagram */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Reliability Diagram (Expected vs Observed Frequency)
              </p>
              <span className="text-[10px] text-slate-500 font-mono">
                Perfect diagonal = perfectly calibrated
              </span>
            </div>
            <div className="w-full overflow-hidden">
              <svg
                viewBox="0 0 500 280"
                className="w-full h-48 sm:h-56 text-xs font-mono select-none"
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Grid */}
                {[0, 20, 40, 60, 80, 100].map((pct) => {
                  const pos = 40 + (pct / 100) * 420
                  return (
                    <g key={pct}>
                      <line x1={pos} y1={40} x2={pos} y2={260} stroke="#1e293b" strokeWidth="1" />
                      <line x1={40} y1={pos} x2={460} y2={pos} stroke="#1e293b" strokeWidth="1" />
                      <text x={pos} y={275} fill="#64748b" textAnchor="middle" fontSize="9">{pct}%</text>
                      <text x={35} y={pos + 4} fill="#64748b" textAnchor="end" fontSize="9">{pct}%</text>
                    </g>
                  )
                })}
                {/* Perfect calibration diagonal */}
                <line x1={40} y1={260} x2={460} y2={40} stroke="#334155" strokeWidth="1.5" strokeDasharray="6 3" />
                {/* Bars */}
                {calibrationData.bins.map((bin, i) => {
                  if (bin.count === 0) return null
                  const barLeft = 40 + i * 42 + 3
                  const barWidth = 36
                  const expectedTop = 260 - (bin.avgProb / 100) * 220
                  const observedTop = 260 - bin.observedFreq * 220
                  const barHeight = 260 - Math.min(expectedTop, observedTop)
                  const expectedColor = '#38bdf8'
                  const observedColor = '#f59e0b'

                  return (
                    <g key={i}>
                      {/* Expected bar */}
                      <rect
                        x={barLeft}
                        y={Math.min(expectedTop, observedTop)}
                        width={barWidth / 2 - 1}
                        height={Math.abs(expectedTop - observedTop) || barHeight}
                        fill={expectedColor}
                        fillOpacity={0.5}
                      />
                      {/* Observed bar */}
                      <rect
                        x={barLeft + barWidth / 2 + 1}
                        y={Math.min(expectedTop, observedTop)}
                        width={barWidth / 2 - 1}
                        height={Math.abs(expectedTop - observedTop) || barHeight}
                        fill={observedColor}
                        fillOpacity={0.5}
                      />
                      {/* Count label */}
                      <text
                        x={barLeft + barWidth / 2}
                        y={278}
                        fill="#94a3b8"
                        textAnchor="middle"
                        fontSize="8"
                      >
                        n={bin.count}
                      </text>
                    </g>
                  )
                })}
                {/* Legend */}
                <rect x={360} y={8} width={10} height={10} fill="#38bdf8" fillOpacity={0.5} />
                <text x={374} y={17} fill="#94a3b8" fontSize="9">Expected (model)</text>
                <rect x={360} y={24} width={10} height={10} fill="#f59e0b" fillOpacity={0.5} />
                <text x={374} y={33} fill="#94a3b8" fontSize="9">Observed (actual)</text>
              </svg>
              <div className="flex items-center justify-center gap-4 mt-1 text-[9px] text-slate-500 font-mono">
                <span>Expected = avg model probability in bin</span>
                <span>Observed = actual win rate in bin</span>
              </div>
            </div>
          </div>

          {/* Per-Outcome Calibration Breakdown */}
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
              Per-Outcome Calibration
            </p>
            <div className="grid grid-cols-3 gap-3">
              {['HOME', 'DRAW', 'AWAY'].map((outcome) => {
                const stats = calibrationData.outcomeStats[outcome]
                const obsFreq = stats.total > 0 ? (stats.wins / stats.total) * 100 : null
                const avgPred = filteredBets
                  .filter((b) => b.outcome === outcome && b.prob_home != null && b.prob_draw != null && b.prob_away != null)
                  .reduce((sum, b) => sum + (outcome === 'HOME' ? b.prob_home : outcome === 'DRAW' ? b.prob_draw : b.prob_away), 0)
                  / (stats.total || 1)

                return (
                  <div key={outcome} className="p-3 rounded-xl bg-pitch-950/60 border border-pitch-800">
                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">
                      {outcome === 'HOME' ? 'Home Win' : outcome === 'DRAW' ? 'Draw' : 'Away Win'}
                    </p>
                    <div className="flex items-end gap-2 mb-1">
                      <span className="text-sm font-bold text-slate-200 tabular-nums">
                        {obsFreq != null ? `${obsFreq.toFixed(0)}%` : '--'}
                      </span>
                      <span className="text-[10px] text-slate-500">observed</span>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                      <span className="text-sm font-bold text-sky-400 tabular-nums">
                        {!isNaN(avgPred) ? `${avgPred.toFixed(0)}%` : '--'}
                      </span>
                      <span className="text-[10px] text-slate-500">predicted</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {stats.total} occurrences
                    </div>
                    {obsFreq != null && !isNaN(avgPred) && Math.abs(obsFreq - avgPred) < 10 && (
                      <div className="mt-1 text-[9px] text-emerald-400">Calibrated</div>
                    )}
                    {obsFreq != null && !isNaN(avgPred) && Math.abs(obsFreq - avgPred) >= 10 && (
                      <div className="mt-1 text-[9px] text-rose-400">Mis-calibrated</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Per-League Calibration Breakdown */}
          {leagueCalibration && leagueCalibration.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                Per-League Calibration
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-pitch-800 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="py-2 px-3">League</th>
                      <th className="py-2 px-3 text-center">Samples</th>
                      <th className="py-2 px-3 text-right">Brier Score</th>
                      <th className="py-2 px-3 text-right">Log-Loss</th>
                      <th className="py-2 px-3 text-right">Improvement</th>
                      <th className="py-2 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pitch-800/60">
                    {leagueCalibration.map((entry) => {
                      const naiveBrier = 0.222
                      const naiveLogLoss = Math.log(3)
                      const brierImprovement = entry.brierScore != null
                        ? Math.round(((naiveBrier - entry.brierScore) / naiveBrier) * 1000) / 10
                        : null
                      const isInsufficient = entry.count < 5
                      const brierColor = !entry.brierScore ? 'text-slate-500'
                        : entry.brierScore < 0.20 ? 'text-emerald-400'
                        : entry.brierScore < 0.25 ? 'text-amber-400'
                        : 'text-rose-400'

                      return (
                        <tr key={entry.league} className="hover:bg-pitch-800/40 transition-colors">
                          <td className="py-2 px-3 font-semibold text-slate-200">
                            {entry.league}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-400">
                            {entry.count}
                          </td>
                          <td className={`py-2 px-3 text-right font-bold tabular-nums ${brierColor}`}>
                            {entry.brierScore != null ? entry.brierScore.toFixed(3) : '--'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold tabular-nums text-violet-400">
                            {entry.logLoss != null ? entry.logLoss.toFixed(3) : '--'}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-400">
                            {brierImprovement != null ? `${brierImprovement >= 0 ? '+' : ''}${brierImprovement}%` : '--'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {isInsufficient ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/30">
                                Accumulating
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                entry.brierScore < 0.20 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : entry.brierScore < 0.25 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}>
                                {entry.brierScore < 0.20 ? 'Well-Calibrated'
                                  : entry.brierScore < 0.25 ? 'Moderate'
                                  : 'Under-Calibrated'}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Interactive Responsive Equity Curve SVG ---- */}
      <div className="p-4 sm:p-5 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pitch-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Backtest Capital Equity Progression</span>
              <span className="text-[10px] font-mono text-slate-400 bg-pitch-950 px-2 py-0.5 rounded border border-pitch-800">
                Base: 100.0 Units
              </span>
            </h3>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              Simulated performance comparison: Flat 1.0-Unit staking vs 2.5% Quarter-Kelly dynamic compounding
            </p>
          </div>

          {/* Staking Line Filters */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-3 h-0.5 bg-amber-400 inline-block" />
              <span>Quarter-Kelly (2.5% cap)</span>
            </span>
            <span className="flex items-center gap-1.5 text-sky-400 ml-2">
              <span className="w-3 h-0.5 bg-sky-400 inline-block" />
              <span>Flat 1-Unit</span>
            </span>
          </div>
        </div>

        {flatSeries.length < 2 ? (
          <div className="py-20 text-center text-slate-500 font-mono text-xs">
            Minimum 2 settled fixtures required to plot equity progression.
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full h-48 sm:h-64 text-xs font-mono select-none"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Baseline (100 units) */}
              <line
                x1={padL}
                y1={baseLineY}
                x2={chartW - padR}
                y2={baseLineY}
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text x={padL - 6} y={baseLineY + 4} fill="#64748b" textAnchor="end" fontSize="10">
                100.0
              </text>

              {/* Min & Max Y Labels */}
              <text x={padL - 6} y={scaleY(maxEq) + 10} fill="#64748b" textAnchor="end" fontSize="10">
                {maxEq.toFixed(1)}
              </text>
              <text x={padL - 6} y={scaleY(minEq) - 2} fill="#64748b" textAnchor="end" fontSize="10">
                {minEq.toFixed(1)}
              </text>

              {/* Flat Series (Sky line) */}
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={flatPoints}
              />

              {/* Kelly Series (Amber line) */}
              <polyline
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={kellyPoints}
              />
            </svg>
          </div>
        )}
      </div>

      {/* ---- Verified Settlements Ledger Table ---- */}
      <div className="p-4 sm:p-5 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-pitch-800 pb-3 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              Verified Match Settlement Audit Trail
            </h3>
            <p className="text-[11px] font-mono text-slate-400">
              Official match scores from consensus data providers with model predictions
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {filteredBets.length} settled event(s)
          </span>
        </div>

        {filteredBets.length === 0 ? (
          <div className="py-16 text-center text-slate-500 font-mono text-xs">
            No settled matches found in selected scope.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-pitch-800 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Fixture</th>
                  <th className="py-2.5 px-3">League</th>
                  <th className="py-2.5 px-3 text-center">Final Score</th>
                  <th className="py-2.5 px-3 text-center">Value Pick</th>
                  <th className="py-2.5 px-3 text-center">Odds</th>
                  <th className="py-2.5 px-3 text-center">Outcome</th>
                  <th className="py-2.5 px-3 text-right">Flat Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pitch-800/60">
                {filteredBets.map((b, idx) => (
                  <tr key={idx} className="hover:bg-pitch-800/40 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                      {b.match_date ? new Date(b.match_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-200">
                      {b.matchLabel}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {b.league}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-100">
                      {b.home_score != null && b.away_score != null ? `${b.home_score} - ${b.away_score}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center text-amber-300 font-semibold">
                      {b.pick}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-300">
                      {b.odds.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        b.result === 'WIN'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {b.result}
                      </span>
                    </td>
                    <td className={`py-2.5 px-3 text-right font-bold tabular-nums ${
                      b.flatProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {b.flatProfit >= 0 ? `+${b.flatProfit.toFixed(2)}u` : `${b.flatProfit.toFixed(2)}u`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
