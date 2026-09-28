// ---- PerformanceModal.jsx ----
// Historical bankroll simulator, equity curve visualizer, and
// verified settled-bets ledger. Desktop: centered modal. Mobile:
// edge-to-edge bottom sheet with drag handle.
//
// No external charting library: pure responsive SVG line chart.
// Running equity is derived chronologically from the visible (filtered)
// bet set so every view stays internally consistent.

import { useEffect, useRef, useState, useMemo } from 'react'
import { simulateBankroll, getBrierTier } from '../utils/analytics'

const LEAGUE_ALL = '__all__'
const START_BANKROLL = 100
const KELLY_PCT = 2.5

export default function PerformanceModal({ isOpen, onClose, fixtures }) {
  const modalRef = useRef(null)
  const svgRef = useRef(null)
  const [activeTab, setActiveTab] = useState('equity')
  const [leagueFilter, setLeagueFilter] = useState(LEAGUE_ALL)
  const [hoverPoint, setHoverPoint] = useState(null)

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  // Full simulation over every settled fixture
  const fullSim = useMemo(() => {
    if (!fixtures || fixtures.length === 0) {
      return { stats: null, bets: [], brierScore: null }
    }
    const settled = fixtures.filter((f) => {
      const ok = ['FT', 'FINISHED', 'AET', 'PEN'].includes(f.status)
      return ok && f.home_score != null && f.away_score != null && f.value_pick != null
    })
    const out = simulateBankroll(settled, KELLY_PCT)
    return { stats: out.stats, bets: out.bets, brierScore: out.brierScore }
  }, [fixtures])

  // League-filtered bet list
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

  // Unique leagues present in the history, alphabetical
  const leaguePills = useMemo(() => {
    const set = new Set(fullSim.bets.map((b) => b.league).filter(Boolean))
    return Array.from(set).sort()
  }, [fullSim.bets])

  // ---- SVG Equity Curve Geometry --------------------------
  const CHART_W = 600
  const CHART_H = 240
  const PAD_L = 46
  const PAD_R = 14
  const PAD_T = 14
  const PAD_B = 34
  const PLOT_W = CHART_W - PAD_L - PAD_R
  const PLOT_H = CHART_H - PAD_T - PAD_B

  const chart = useMemo(() => {
    if (flatSeries.length === 0) return null

    const allVals = flatSeries.map((p) => p.equity)
      .concat(kellySeries.map((p) => p.equity))
      .concat([START_BANKROLL])
    const minV = Math.min(...allVals)
    const maxV = Math.max(...allVals)
    const range = (maxV - minV) || 1
    const scale = (v) => PAD_T + PLOT_H - ((v - minV) / range) * PLOT_H
    const stepX = PLOT_W / Math.max(1, flatSeries.length - 1)
    const px = (i) => (i === 0 ? PAD_L : PAD_L + i * stepX)

    const flatPath = flatSeries.map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${scale(p.equity).toFixed(1)}`
    ).join(' ')

    const kellyPath = kellySeries.map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${scale(p.equity).toFixed(1)}`
    ).join(' ')

    const ticks = []
    const tickCount = 4
    for (let i = 0; i <= tickCount; i++) {
      const val = minV + (range * i) / tickCount
      ticks.push({ y: scale(val), label: val.toFixed(1) })
    }

    const labelStep = Math.max(1, Math.floor(flatSeries.length / 5))
    const xLabels = []
    for (let i = 0; i < flatSeries.length; i += labelStep) {
      const d = new Date(flatSeries[i].match_date)
      xLabels.push({
        x: px(i),
        label: `${d.getMonth() + 1}/${d.getDate()}`,
      })
    }

    return { flatPath, kellyPath, scale, stepX, px, minV, maxV, baselineY: scale(START_BANKROLL), ticks, xLabels }
  }, [flatSeries, kellySeries])

  const handlePointerMove = (e) => {
    if (!svgRef.current || !chart || flatSeries.length === 0) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = (e.clientX - rect.left) * (CHART_W / rect.width)
    let idx
    if (flatSeries.length === 1) {
      idx = 0
    } else {
      idx = Math.round((relX - PAD_L) / chart.stepX)
      idx = Math.max(0, Math.min(flatSeries.length - 1, idx))
    }
    const point = flatSeries[idx]
    setHoverPoint({ ...point, kellyEquity: kellySeries[idx]?.equity ?? null, idx })
  }

  const handlePointerLeave = () => setHoverPoint(null)

  if (!isOpen) return null

  const stats = fullSim.stats
  const brierScore = fullSim.brierScore
  const brierTier = getBrierTier(brierScore)
  const totalBets = fullSim.bets.length
  const wins = stats?.wins ?? 0
  const losses = stats?.losses ?? 0
  const winRate = stats?.winRate ?? 0
  const roiPct = stats?.roiPct ?? 0
  const finalFlat = flatSeries.length ? flatSeries[flatSeries.length - 1].equity : START_BANKROLL
  const finalKelly = kellySeries.length ? kellySeries[kellySeries.length - 1].equity : START_BANKROLL
  const filteredNet = filteredBets.reduce((sum, b) => sum + b.flatProfit, 0)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perf-modal-title"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-full sm:max-w-4xl bg-pitch-900 border-t sm:border border-pitch-700 rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" aria-hidden="true" />

        {/* Header */}
        <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-5 border-b border-pitch-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close performance modal"
            className="absolute top-4 right-4 w-9 h-9 min-h-[36px] flex items-center justify-center rounded-lg bg-pitch-800 text-slate-400 hover:text-slate-100 hover:bg-pitch-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Verified Results</p>
          <h2 id="perf-modal-title" className="text-lg sm:text-xl font-bold text-slate-100 mt-0.5">
            Track Record &amp; Backtest
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Simulated bankroll from settled +EV selections. Starting bankroll: {START_BANKROLL} units. Quarter-Kelly at {KELLY_PCT}% stake.
          </p>
        </div>

        {/* Section tabs (compact, mobile-friendly) */}
        <div className="flex border-b border-pitch-800 px-4 shrink-0 overflow-x-auto no-scrollbar">
          {[
            { id: 'equity', label: 'Equity Curve' },
            { id: 'ledger', label: `Settled Bets (${totalBets})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {/* Final equity readout, anchored right on wide screens */}
          <div className="ml-auto hidden sm:flex items-center gap-3 pr-2 text-[10px] font-mono">
            <span className="text-sky-400">F {finalFlat}</span>
            <span className="text-amber-400">K {finalKelly}</span>
          </div>
        </div>

        {/* Scrollable body */}
        <div
          className="overflow-y-auto flex-1 touch-pan-y p-4 sm:p-5 space-y-4"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* ---- Summary Metric Tiles ---- */}
          {stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-pitch-950 border border-pitch-800">
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Settled Bets</p>
                <p className="text-xl font-bold text-slate-100 font-mono mt-0.5">{totalBets}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  <span className="text-emerald-400 font-mono">{wins}W</span>
                  {' / '}
                  <span className="text-rose-400 font-mono">{losses}L</span>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-pitch-950 border border-pitch-800">
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Win Rate</p>
                <p className={`text-xl font-bold font-mono mt-0.5 ${
                  winRate >= 55 ? 'text-emerald-400' : winRate >= 45 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {winRate}%
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {winRate >= 55 ? 'Strong' : winRate >= 45 ? 'Fair' : 'Below par'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-pitch-950 border border-pitch-800">
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">ROI</p>
                <p className={`text-xl font-bold font-mono mt-0.5 ${roiPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {roiPct > 0 ? '+' : ''}{roiPct}%
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Per unit staked, flat model</p>
              </div>

              <div className="p-3 rounded-xl bg-pitch-950 border border-pitch-800">
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Brier Score</p>
                <p className="text-xl font-bold font-mono mt-0.5 text-slate-100">
                  {brierScore != null ? brierScore.toFixed(3) : '--'}
                </p>
                {brierTier ? (
                  <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${brierTier.cls}`}>
                    {brierTier.label}
                  </span>
                ) : (
                  <span className="block text-[10px] text-slate-600 mt-1">No probability coverage yet</span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 sm:p-8 rounded-xl bg-pitch-950 border border-pitch-800 text-center">
              <p className="text-slate-400 text-sm">No settled +EV matches yet.</p>
              <p className="text-slate-600 text-xs mt-1.5 leading-relaxed">
                Results appear here once the daily pipeline settles finished fixtures that had a value pick attached.
                Early season tracks start thin and accumulate match by match.
              </p>
            </div>
          )}

          {/* ---- Equity Curve ---- */}
          {activeTab === 'equity' && (
            <div className="rounded-xl bg-pitch-950 border border-pitch-800 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  Cumulative Bankroll Growth
                </p>
                <div className="flex items-center gap-3 text-[10px] font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 rounded-full bg-sky-400 inline-block" aria-hidden="true" />
                    <span className="text-sky-400">Flat 1 Unit</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 rounded-full bg-amber-400 inline-block" aria-hidden="true" />
                    <span className="text-amber-400">Quarter-Kelly</span>
                  </span>
                </div>
              </div>

              {chart ? (
                <div className="relative w-full" style={{ touchAction: 'pan-y' }}>
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="w-full h-auto select-none"
                    onPointerMove={handlePointerMove}
                    onPointerLeave={handlePointerLeave}
                    role="img"
                    aria-label="Line chart of cumulative bankroll for flat and quarter-Kelly staking across settled matches"
                  >
                    {/* Horizontal gridlines + left axis labels */}
                    {chart.ticks.map((tick, i) => (
                      <g key={`t${i}`}>
                        <line
                          x1={PAD_L} y1={tick.y}
                          x2={CHART_W - PAD_R} y2={tick.y}
                          stroke="rgba(100,116,139,0.15)"
                          strokeWidth={1}
                        />
                        <text
                          x={PAD_L - 6} y={tick.y + 3}
                          textAnchor="end" fill="#64748b"
                          fontSize={9} fontFamily="'DM Mono', Consolas, monospace"
                        >
                          {tick.label}
                        </text>
                      </g>
                    ))}

                    {/* Starting bankroll reference line */}
                    <line
                      x1={PAD_L} y1={chart.baselineY}
                      x2={CHART_W - PAD_R} y2={chart.baselineY}
                      stroke="rgba(100,116,139,0.35)"
                      strokeWidth={1}
                      strokeDasharray="4,3"
                    />

                    {/* Quarter-Kelly line (drawn first, behind) */}
                    <path
                      d={chart.kellyPath}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.9}
                    />

                    {/* Flat staking line */}
                    <path
                      d={chart.flatPath}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* X-axis date labels */}
                    {chart.xLabels.map((lbl, i) => (
                      <text
                        key={`x${i}`}
                        x={lbl.x} y={CHART_H - 8}
                        textAnchor="middle" fill="#475569"
                        fontSize={8} fontFamily="'DM Mono', Consolas, monospace"
                      >
                        {lbl.label}
                      </text>
                    ))}

                    {/* Hover crosshair + value dots */}
                    {hoverPoint && (
                      <>
                        <line
                          x1={chart.px(hoverPoint.idx)} y1={PAD_T}
                          x2={chart.px(hoverPoint.idx)} y2={PAD_T + PLOT_H}
                          stroke="rgba(148,163,184,0.4)"
                          strokeWidth={1}
                          strokeDasharray="3,3"
                        />
                        <circle
                          cx={chart.px(hoverPoint.idx)}
                          cy={chart.scale(hoverPoint.equity)}
                          r={4}
                          fill="#38bdf8"
                          stroke="#080b11"
                          strokeWidth={1.5}
                        />
                        {hoverPoint.kellyEquity != null && (
                          <circle
                            cx={chart.px(hoverPoint.idx)}
                            cy={chart.scale(hoverPoint.kellyEquity)}
                            r={3}
                            fill="#f59e0b"
                            stroke="#080b11"
                            strokeWidth={1.5}
                          />
                        )}
                      </>
                    )}
                  </svg>

                  {/* Floating tooltip */}
                  {hoverPoint && (
                    <div
                      className="absolute pointer-events-none z-10 bg-pitch-800/95 border border-pitch-700 rounded-lg px-2.5 py-1.5 text-xs shadow-xl"
                      style={{
                        left: `${Math.max(2, Math.min(72, (chart.px(hoverPoint.idx) / CHART_W) * 100))}%`,
                        top: '2px',
                        transform: 'translateX(-50%)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <p className="text-slate-500 font-mono text-[10px]">
                        {new Date(hoverPoint.match_date).toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </p>
                      <p className="text-slate-200 font-medium truncate max-w-[190px]">{hoverPoint.matchLabel}</p>
                      <div className="flex items-center gap-3 mt-0.5 font-mono text-[11px]">
                        <span className="text-sky-400">F {hoverPoint.equity.toFixed(2)}</span>
                        {hoverPoint.kellyEquity != null && (
                          <span className="text-amber-400">K {hoverPoint.kellyEquity.toFixed(2)}</span>
                        )}
                        <span className={hoverPoint.betProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {hoverPoint.betProfit >= 0 ? '+' : ''}{hoverPoint.betProfit.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-slate-500 text-sm">No equity points to plot.</p>
                  <p className="text-slate-600 text-xs mt-1">The curve fills in as settled bets land in the ledger.</p>
                </div>
              )}

              {chart && (
                <div className="flex items-center justify-between mt-2.5 text-[10px] font-mono text-slate-500">
                  <span>Low {chart.minV.toFixed(2)}</span>
                  <span>Start {START_BANKROLL}.00</span>
                  <span>High {chart.maxV.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* ---- Settled Bets Ledger ---- */}
          {activeTab === 'ledger' && (
            <div>
              {/* League filter pills */}
              {leaguePills.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap mb-3 no-scrollbar overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setLeagueFilter(LEAGUE_ALL)}
                    className={`px-2.5 py-1.5 min-h-[32px] rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                      leagueFilter === LEAGUE_ALL
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-pitch-800 text-slate-400 border border-pitch-700 hover:text-slate-200'
                    }`}
                  >
                    All
                  </button>
                  {leaguePills.map((league) => (
                    <button
                      key={league}
                      type="button"
                      onClick={() => setLeagueFilter(league)}
                      className={`px-2.5 py-1.5 min-h-[32px] rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                        leagueFilter === league
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-pitch-800 text-slate-400 border border-pitch-700 hover:text-slate-200'
                      }`}
                    >
                      {league}
                    </button>
                  ))}
                </div>
              )}

              {filteredBets.length === 0 ? (
                <div className="rounded-xl bg-pitch-950 border border-pitch-800 p-6 text-center">
                  <p className="text-slate-400 text-sm">No settled bets in this league yet.</p>
                  <p className="text-slate-600 text-xs mt-1">
                    The tracker accumulates as today&apos;s matches finish and the pipeline settles them.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-pitch-950 border border-pitch-800 overflow-hidden">
                  {/* Header row (desktop) */}
                  <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-b border-pitch-800 bg-pitch-900/60">
                    <div className="col-span-2">Date</div>
                    <div className="col-span-4">Match</div>
                    <div className="col-span-2">Selection</div>
                    <div className="col-span-1 text-right">Odds</div>
                    <div className="col-span-1 text-center">Result</div>
                    <div className="col-span-2 text-right">Net P/L</div>
                  </div>

                  <div className="max-h-[52vh] overflow-y-auto touch-pan-y no-scrollbar">
                    {filteredBets.map((bet, i) => (
                      <div
                        key={`${bet.match_date}-${i}`}
                        className={`grid grid-cols-12 gap-2 px-4 py-2.5 text-xs items-center border-b border-pitch-800/50 last:border-0 ${
                          bet.result === 'WIN' ? 'bg-emerald-500/[0.03]' : 'bg-rose-500/[0.03]'
                        }`}
                      >
                        <div className="col-span-2 text-[11px] font-mono text-slate-500 md:static">
                          <span className="md:inline">
                            {new Date(bet.match_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>

                        <div className="col-span-4 min-w-0">
                          <p className="text-slate-200 font-medium truncate">{bet.matchLabel}</p>
                          <p className="text-[10px] text-slate-600 truncate">{bet.league}</p>
                        </div>

                        <div className="col-span-2">
                          <span className={`text-[10px] font-bold font-mono ${
                            bet.selection === 'HOME' ? 'text-sky-400'
                            : bet.selection === 'DRAW' ? 'text-slate-300'
                            : 'text-rose-400'
                          }`}>
                            {bet.selection === 'HOME' ? 'Home Win' : bet.selection === 'DRAW' ? 'Draw' : 'Away Win'}
                          </span>
                        </div>

                        <div className="col-span-1 text-right font-mono text-slate-300">
                          {bet.odds > 0 ? Number(bet.odds).toFixed(2) : '--'}
                        </div>

                        <div className="col-span-1 flex justify-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border ${
                            bet.result === 'WIN'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          }`}>
                            {bet.result}
                          </span>
                        </div>

                        <div className={`col-span-2 text-right font-mono font-semibold ${
                          bet.flatProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {bet.flatProfit >= 0 ? '+' : ''}{bet.flatProfit.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Running total footer for the visible slice */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-pitch-900/60 border-t border-pitch-800 text-[11px] font-mono">
                    <span className="text-slate-500">
                      {filteredBets.length} bet{filteredBets.length !== 1 ? 's' : ''}
                      {leagueFilter !== LEAGUE_ALL ? ` · ${leagueFilter}` : ''}
                    </span>
                    <span className={`font-semibold ${filteredNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      Net {filteredNet >= 0 ? '+' : ''}{filteredNet.toFixed(2)} units
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
