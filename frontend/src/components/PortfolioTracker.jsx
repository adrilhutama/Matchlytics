// ---- PortfolioTracker.jsx ----
// Bankroll & Bet Tracker (Portfolio Journal)
// Tracks positions, bankroll equity progression, ROI, win rate, and Quarter-Kelly staking.
// Backed by persistent localStorage.

import { useState, useMemo } from 'react'

export default function PortfolioTracker({
  positions = [],
  onUpdatePositionStatus,
  onUpdateStatus,
  onDeletePosition,
  onAddManualPosition,
  onAddPosition,
  bankrollAmount = 10000000,
  bankroll = 10000000,
  onUpdateBankroll,
  currencyCode = 'IDR',
}) {
  const effectiveBankroll = bankroll || bankrollAmount || 10000000
  const handleUpdate = onUpdatePositionStatus || onUpdateStatus
  const handleAdd = onAddManualPosition || onAddPosition
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newPos, setNewPos] = useState({
    fixtureName: '',
    leagueName: 'Premier League',
    selectionLabel: 'Home Win',
    odds: '2.10',
    stakeAmount: '250000',
    notes: '',
  })

  // Portfolio calculations
  const stats = useMemo(() => {
    let totalInvested = 0
    let totalReturned = 0
    let wins = 0
    let losses = 0
    let voids = 0
    let pending = 0
    let pendingExposure = 0

    positions.forEach((pos) => {
      const stake = Number(pos.stake ?? pos.stakeAmount) || 0
      const odds = Number(pos.odds ?? pos.marketOdds) || 1.0

      if (pos.status === 'WON') {
        wins += 1
        totalInvested += stake
        totalReturned += stake * odds
      } else if (pos.status === 'LOST') {
        losses += 1
        totalInvested += stake
      } else if (pos.status === 'VOID') {
        voids += 1
        totalInvested += stake
        totalReturned += stake
      } else {
        pending += 1
        pendingExposure += stake
      }
    })

    const settledCount = wins + losses
    const netPnl = totalReturned - totalInvested
    const currentEquity = effectiveBankroll + netPnl - pendingExposure
    const roiPct = totalInvested > 0 ? Number(((netPnl / totalInvested) * 100).toFixed(1)) : 0.0
    const winRate = settledCount > 0 ? Number(((wins / settledCount) * 100).toFixed(1)) : 0.0

    return {
      totalInvested,
      totalReturned,
      netPnl,
      currentEquity,
      roiPct,
      winRate,
      wins,
      losses,
      voids,
      pending,
      pendingExposure,
      totalPositions: positions.length,
    }
  }, [positions, effectiveBankroll])

  // Filtered positions
  const filteredPositions = useMemo(() => {
    if (filterStatus === 'ALL') return positions
    return positions.filter((p) => p.status === filterStatus)
  }, [positions, filterStatus])

  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (!newPos.fixtureName) return
    (handleAdd || onAddManualPosition)({
      id: `manual_${Date.now()}`,
      fixtureName: newPos.fixtureName,
      leagueName: newPos.leagueName,
      matchDate: new Date().toISOString(),
      selectionLabel: newPos.selectionLabel,
      odds: parseFloat(newPos.odds) || 2.0,
      stakeAmount: parseFloat(newPos.stakeAmount) || 100000,
      status: 'PENDING',
      notes: newPos.notes,
      loggedAt: new Date().toISOString(),
    })
    setNewPos({
      fixtureName: '',
      leagueName: 'Premier League',
      selectionLabel: 'Home Win',
      odds: '2.10',
      stakeAmount: '250000',
      notes: '',
    })
    setShowAddModal(false)
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in max-w-7xl mx-auto pb-24 md:pb-6">
      {/* ---- Top KPI Cards ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 font-mono">
        {/* Current Bankroll / Equity */}
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-lg min-w-0 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 gap-1">
            <span className="truncate">Portfolio Equity</span>
            <button
              type="button"
              onClick={() => {
                const val = prompt('Set Initial Bankroll Amount:', String(bankrollAmount))
                if (val && !isNaN(val)) onUpdateBankroll(Number(val))
              }}
              className="text-[10px] text-amber-400 hover:underline shrink-0"
            >
              Edit Base
            </button>
          </div>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-slate-100 tabular-nums truncate leading-tight">
            {currencyCode} {Math.round(stats.currentEquity).toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block truncate">
            Base: {currencyCode} {bankrollAmount.toLocaleString()}
          </span>
        </div>

        {/* Net Profit & Loss */}
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-lg min-w-0 flex flex-col justify-between">
          <span className="text-[11px] text-slate-400 block mb-1 truncate">
            Net Realized P&L
          </span>
          <p className={`text-sm sm:text-base md:text-lg lg:text-xl font-bold tabular-nums truncate leading-tight ${
            stats.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {stats.netPnl >= 0 ? `+${currencyCode} ` : `-${currencyCode} `}
            {Math.abs(Math.round(stats.netPnl)).toLocaleString()}
          </p>
          <span className={`text-[10px] font-bold mt-1 block truncate ${stats.roiPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {stats.roiPct >= 0 ? `+${stats.roiPct}% ROI` : `${stats.roiPct}% ROI`}
          </span>
        </div>

        {/* Win Rate on Settled Picks */}
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-lg min-w-0 flex flex-col justify-between">
          <span className="text-[11px] text-slate-400 block mb-1 truncate">
            Settled Win Rate
          </span>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-slate-100 tabular-nums truncate leading-tight">
            {stats.winRate}%
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block truncate">
            {stats.wins}W / {stats.losses}L {stats.voids > 0 ? `(${stats.voids}V)` : ''}
          </span>
        </div>

        {/* Active Market Exposure */}
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-lg min-w-0 flex flex-col justify-between">
          <span className="text-[11px] text-slate-400 block mb-1 truncate">
            Active Exposure
          </span>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-amber-400 tabular-nums truncate leading-tight">
            {currencyCode} {Math.round(stats.pendingExposure).toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block truncate">
            {stats.pending} Pending Position(s)
          </span>
        </div>
      </div>

      {/* ---- Actions & Filter Bar ---- */}
      <div className="p-4 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
          {['ALL', 'PENDING', 'WON', 'LOST', 'VOID'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg border transition-colors ${
                filterStatus === st
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                  : 'bg-pitch-950 text-slate-400 border-pitch-800 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-amber-500 text-pitch-950 font-bold text-xs hover:bg-amber-400 transition-colors flex items-center justify-center gap-1.5 shadow"
        >
          <span>+</span>
          <span>Manual Entry</span>
        </button>
      </div>

      {/* ---- Positions Ledger Table ---- */}
      <div className="p-4 sm:p-5 rounded-2xl bg-pitch-900 border border-pitch-700/80 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-pitch-800 pb-3 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              Logged Portfolio Positions
            </h3>
            <p className="text-[11px] font-mono text-slate-400">
              Quarter-Kelly verified active and historical positions
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {filteredPositions.length} item(s)
          </span>
        </div>

        {filteredPositions.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs font-mono space-y-2">
            <p>No positions recorded under status "{filterStatus}".</p>
            <p className="text-[11px] text-slate-600">
              Log edges directly from the Terminal scanner or Quant Lab.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 scrollbar-none">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-pitch-800 text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                  <th className="py-3 px-3 min-w-[80px]">Date</th>
                  <th className="py-3 px-3 min-w-[140px]">Fixture</th>
                  <th className="py-3 px-3 min-w-[160px]">Selection</th>
                  <th className="py-3 px-3 text-center min-w-[70px]">Odds</th>
                  <th className="py-3 px-3 text-center min-w-[90px]">Stake</th>
                  <th className="py-3 px-3 text-center min-w-[70px]">Status</th>
                  <th className="py-3 px-3 text-center min-w-[90px]">P&L</th>
                  <th className="py-3 px-3 text-right min-w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pitch-800/60">
                {filteredPositions.map((pos) => {
                  const stake = Number(pos.stake ?? pos.stakeAmount) || 0
                  const odds = Number(pos.odds ?? pos.marketOdds) || 1.0
                  const fixtureTitle = pos.fixture || pos.fixtureName || pos.fixtureMatch || (pos.legs ? `${pos.legs.length}-Leg Parlay` : 'Unknown Fixture')
                  const selectionText = pos.selection || pos.selectionLabel || pos.selectionName || pos.pick || 'Custom Selection'
                  const dateStr = pos.date || (pos.loggedAt ? new Date(pos.loggedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Today')

                  // Multi-leg parlay legs breakdown
                  const hasLegsArray = Array.isArray(pos.legs) && pos.legs.length > 0
                  const hasPlusDelimiter = typeof selectionText === 'string' && selectionText.includes(' + ')
                  const isMultiLeg = hasLegsArray || hasPlusDelimiter

                  const parsedLegs = hasLegsArray
                    ? pos.legs.map((l) => ({
                        fixture: l.matchName || (l.homeTeam ? `${l.homeTeam} vs ${l.awayTeam}` : ''),
                        pick: l.target || l.selection || l.pickLabel || l.pick || 'Pick',
                        odds: l.odds ? Number(l.odds).toFixed(2) : '',
                      }))
                    : hasPlusDelimiter
                    ? selectionText.split(' + ').map((s) => {
                        const trimmed = s.trim()
                        const parts = trimmed.split(' @')
                        return {
                          fixture: '',
                          pick: parts[0] || trimmed,
                          odds: parts[1] || '',
                        }
                      })
                    : []

                  let pnlStr = '-'
                  let pnlColor = 'text-slate-500'

                  if (pos.status === 'WON') {
                    const profit = stake * (odds - 1)
                    pnlStr = `+${currencyCode} ${Math.round(profit).toLocaleString()}`
                    pnlColor = 'text-emerald-400 font-bold'
                  } else if (pos.status === 'LOST') {
                    pnlStr = `-${currencyCode} ${Math.round(stake).toLocaleString()}`
                    pnlColor = 'text-rose-400 font-bold'
                  } else if (pos.status === 'VOID') {
                    pnlStr = '{currencyCode} 0 (Void)'
                    pnlColor = 'text-slate-400'
                  }

                  return (
                    <tr key={pos.id} className="hover:bg-pitch-800/40 transition-colors">
                      <td className="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap min-w-[80px] font-mono">
                        {dateStr}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-200 min-w-[140px]">
                        <div>
                          <span className="block truncate max-w-[240px] sm:max-w-[320px]" title={fixtureTitle}>
                            {fixtureTitle}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {pos.leagueName || (pos.legs ? `${pos.legs.length}-Leg Acca` : 'Direct Pick')}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {isMultiLeg && parsedLegs.length > 0 ? (
                          <div className="flex flex-col gap-1.5 py-0.5">
                            <div className="flex flex-wrap gap-1 max-w-[340px]">
                              {parsedLegs.map((leg, lIdx) => (
                                <span
                                  key={lIdx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-pitch-950 text-slate-200 border border-pitch-700/80 shadow-sm"
                                >
                                  <span className="text-amber-300 font-semibold">{leg.pick}</span>
                                  {leg.odds && <span className="text-slate-400">@{leg.odds}</span>}
                                  {leg.fixture && (
                                    <span className="text-slate-500 text-[9px] truncate max-w-[120px]">
                                      ({leg.fixture})
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-amber-300 font-semibold block truncate max-w-[220px]" title={selectionText}>
                            {selectionText}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-200 font-bold font-mono min-w-[70px]">
                        {Number(odds).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-300 whitespace-nowrap font-mono min-w-[90px]">
                        {currencyCode} {Math.round(stake).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pos.status === 'WON'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : pos.status === 'LOST'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : pos.status === 'VOID'
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}>
                          {pos.status}
                        </span>
                      </td>
                      <td className={`py-3 px-3 text-center whitespace-nowrap font-mono ${pnlColor}`}>
                        {pnlStr}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {pos.status === 'PENDING' ? (
                            <div className="inline-flex items-center gap-1 bg-pitch-950/80 p-1 rounded-xl border border-pitch-800">
                              <button
                                type="button"
                                onClick={() => handleUpdate && handleUpdate(pos.id, 'WON')}
                                className="min-h-[40px] px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400"
                                title="Mark position as won (realize profit)"
                              >
                                <span>✓</span>
                                <span>Won</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdate && handleUpdate(pos.id, 'LOST')}
                                className="min-h-[40px] px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
                                title="Mark position as lost"
                              >
                                <span>✗</span>
                                <span>Lost</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdate && handleUpdate(pos.id, 'VOID')}
                                className="min-h-[40px] px-2.5 py-1.5 rounded-lg bg-pitch-900 hover:bg-pitch-800 text-slate-400 hover:text-slate-200 border border-pitch-700 text-xs font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                                title="Mark position as void (refund stake)"
                              >
                                Void
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-500 uppercase px-2 py-1 rounded-lg bg-pitch-950 border border-pitch-800">
                              Settled
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeletePosition && onDeletePosition(pos.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-pitch-900 transition-colors ml-1"
                            title="Delete entry"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Entry Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-pitch-950/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-pitch-900 border border-pitch-700 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-pitch-800 pb-2">
              <h3 className="text-sm font-bold text-slate-100">
                Log New Portfolio Position
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-slate-300 text-lg"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-slate-400 block mb-1">Fixture Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arsenal vs Chelsea"
                  value={newPos.fixtureName}
                  onChange={(e) => setNewPos({ ...newPos, fixtureName: e.target.value })}
                  className="w-full bg-pitch-950 border border-pitch-700 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">League</label>
                  <input
                    type="text"
                    value={newPos.leagueName}
                    onChange={(e) => setNewPos({ ...newPos, leagueName: e.target.value })}
                    className="w-full bg-pitch-950 border border-pitch-700 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Selection</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Home Win"
                    value={newPos.selectionLabel}
                    onChange={(e) => setNewPos({ ...newPos, selectionLabel: e.target.value })}
                    className="w-full bg-pitch-950 border border-pitch-700 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Decimal Odds</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1.01"
                    required
                    value={newPos.odds}
                    onChange={(e) => setNewPos({ ...newPos, odds: e.target.value })}
                    className="w-full bg-pitch-950 border border-pitch-700 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Stake Amount ({currencyCode})</label>
                  <input
                    type="number"
                    step="1000"
                    min="1000"
                    required
                    value={newPos.stakeAmount}
                    onChange={(e) => setNewPos({ ...newPos, stakeAmount: e.target.value })}
                    className="w-full bg-pitch-950 border border-pitch-700 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Notes / Rationale</label>
                <input
                  type="text"
                  placeholder="Optional rationale..."
                  value={newPos.notes}
                  onChange={(e) => setNewPos({ ...newPos, notes: e.target.value })}
                  className="w-full bg-pitch-950 border border-pitch-700 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-pitch-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-pitch-800 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-pitch-950 font-bold hover:bg-amber-400"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
