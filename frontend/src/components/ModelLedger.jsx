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
    const won = filteredBets.filter((b) => b.outcome === 'WON').length
    const winRate = Math.round((won / total) * 1000) / 10
    const flatPnl = flatSeries.length > 0 ? flatSeries[flatSeries.length - 1].equity - START_BANKROLL : 0
    const kellyPnl = kellySeries.length > 0 ? kellySeries[kellySeries.length - 1].equity - START_BANKROLL : 0
    const flatRoi = total > 0 ? Math.round((flatPnl / total) * 1000) / 10 : 0
    const kellyRoi = Math.round((kellyPnl / START_BANKROLL) * 1000) / 10

    let brierSum = 0
    let brierN = 0
    filteredBets.forEach((b) => {
      if (b.brierContribution != null) {
        brierSum += b.brierContribution
        brierN += 1
      }
    })
    const brierScore = brierN > 0 ? Math.round((brierSum / brierN) * 1000) / 1000 : null

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
    }
  }, [filteredBets, flatSeries, kellySeries])

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
      </div>

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
                      {b.actualScore}
                    </td>
                    <td className="py-2.5 px-3 text-center text-amber-300 font-semibold">
                      {b.pick}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-300">
                      {b.odds.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        b.outcome === 'WON'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {b.outcome}
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
