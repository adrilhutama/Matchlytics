// ---- ParlaySlipDrawer.jsx ----
// Multi-match accumulator / parlay slip builder.
// Calculates combined market odds, joint model probability,
// cumulative parlay EV, and fractional Kelly sizing.
// Provides structured "Copy to Clipboard" export.
//
// Responsive behavior:
//   < md  : full-width bottom sheet over a dimmed overlay, opened from
//           the Slip tab in the mobile bottom nav.
//   >= md : sleek docked floating panel pinned to the bottom-right
//           corner: the legs list scrolls internally while the metrics
//           block and copy action stay pinned at the bottom.

import { useState, useMemo } from 'react'
import { calculateParlayAggregates } from '../utils/analytics'

export default function ParlaySlipDrawer({
  legs,
  isOpen,
  onToggleOpen,
  onRemoveLeg,
  onClearSlip,
  onLogPosition,
  userBankroll = 1000000,
}) {
  const [logged, setLogged] = useState(false)
  const [copied, setCopied] = useState(false)

  const aggregates = useMemo(() => {
    return calculateParlayAggregates(legs)
  }, [legs])

  const handleCopySummary = async () => {
    if (legs.length === 0) return

    const lines = [
      `🎯 MATCHLYTICS QUANT PARLAY SLIP (${legs.length} Legs)`,
      '----------------------------------------',
    ]

    legs.forEach((leg, index) => {
      lines.push(
        `${index + 1}. ${leg.homeTeam} vs ${leg.awayTeam}`,
        `   Pick: ${leg.pickLabel} @ ${Number(leg.odds).toFixed(2)} (Model: ${Number(leg.modelProb).toFixed(1)}% | EV: ${leg.ev > 0 ? '+' : ''}${Number(leg.ev).toFixed(1)}%)`
      )
    })

    lines.push(
      '----------------------------------------',
      `📈 Combined Odds: ${aggregates.totalOdds.toFixed(2)}`,
      `🎲 Joint Model Probability: ${aggregates.jointProb.toFixed(1)}%`,
      `💡 Combined Slip EV: ${aggregates.combinedEv > 0 ? '+' : ''}${aggregates.combinedEv.toFixed(1)}%`,
      `🛡️ Recommended Stake: ${aggregates.recommendedStakePct.toFixed(1)}% (Fractional Kelly)`,
      'Generated via Matchlytics. Bet responsibly.'
    )

    const text = lines.join('\n')

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for non-secure contexts
        const textarea = document.createElement('textarea')
        textarea.value = text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  // If no items in slip, do not render
  if (legs.length === 0) return null

  const slipHeader = (
    <div className="flex items-center justify-between gap-2 pb-3 border-b border-pitch-800">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base font-bold text-slate-100">Parlay Slip</span>
        <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          {legs.length} {legs.length === 1 ? 'Leg' : 'Legs'}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onClearSlip}
          className="text-xs text-slate-400 hover:text-rose-400 font-medium px-2 py-1 rounded transition-colors"
        >
          Clear All
        </button>
        <button
          type="button"
          onClick={onToggleOpen}
          aria-label="Close parlay slip"
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-pitch-800 text-slate-400 hover:text-slate-100"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )

  const slipLegs = (
    <div className="space-y-2">
      {legs.map((leg) => (
        <div
          key={`${leg.fixtureId}-${leg.pick}`}
          className="p-3 rounded-xl bg-pitch-950 border border-pitch-800 flex items-start justify-between gap-3 text-xs min-w-0"
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-200 truncate">
              {leg.homeTeam} vs {leg.awayTeam}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-bold text-amber-400">{leg.pickLabel}</span>
              <span className="font-mono text-slate-400 font-semibold">@{Number(leg.odds).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-mono">
              <span>Model: {Number(leg.modelProb).toFixed(1)}%</span>
              <span>·</span>
              <span className={leg.ev > 0 ? 'text-emerald-400' : 'text-slate-500'}>
                EV: {leg.ev > 0 ? `+${Number(leg.ev).toFixed(1)}%` : `${Number(leg.ev).toFixed(1)}%`}
              </span>
            </div>
          </div>

          {/* Remove Leg Button */}
          <button
            type="button"
            onClick={() => onRemoveLeg(leg.fixtureId, leg.pick)}
            aria-label={`Remove ${leg.homeTeam} vs ${leg.awayTeam} from slip`}
            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )

  const slipMetrics = (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-pitch-950 border border-pitch-800">
          <span className="text-[10px] text-slate-500 block uppercase font-medium">Combined Odds</span>
          <span className="text-lg font-bold font-mono text-amber-400">
            {aggregates.totalOdds.toFixed(2)}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-pitch-950 border border-pitch-800">
          <span className="text-[10px] text-slate-500 block uppercase font-medium">Joint Probability</span>
          <span className="text-lg font-bold font-mono text-sky-400">
            {aggregates.jointProb.toFixed(1)}%
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-pitch-950 border border-pitch-800">
          <span className="text-[10px] text-slate-500 block uppercase font-medium">Combined Slip EV</span>
          <span className={`text-lg font-bold font-mono ${
            aggregates.combinedEv > 0 ? 'text-emerald-400' : 'text-slate-400'
          }`}>
            {aggregates.combinedEv > 0 ? `+${aggregates.combinedEv.toFixed(1)}%` : `${aggregates.combinedEv.toFixed(1)}%`}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-pitch-950 border border-pitch-800">
          <span className="text-[10px] text-slate-500 block uppercase font-medium">Kelly Stake Cap</span>
          <span className="text-lg font-bold font-mono text-slate-200">
            {aggregates.recommendedStakePct > 0 ? `${aggregates.recommendedStakePct.toFixed(1)}%` : '0.0%'}
          </span>
        </div>
      </div>

      {/* Warning if parlay is negative EV */}
      {!aggregates.isPositiveEv && (
        <p className="text-[11px] text-amber-400/90 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
          Note: Compounding market overround has reduced total slip expectation below 0% EV.
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-1">
        {onLogPosition && (
          <button
            type="button"
            onClick={() => {
              if (legs.length === 0) return
              const combinedOdds = Number(aggregates.totalOdds || 1.0)
              const kellyStakeCap = aggregates.recommendedStakePct || 1.0
              const bankroll = Number(userBankroll || 1000000)
              const calculatedStake = Math.max(
                10000,
                Math.round(bankroll * (Math.min(2.5, Math.max(0, kellyStakeCap)) / 100))
              )
              const fixtureText = `${legs.length}-Leg Parlay (${legs.map(l => l.matchName || `${l.homeTeam} vs ${l.awayTeam}`).join(' | ')})`
              const selectionText = legs.map(l => `${l.target || l.selection || l.pickLabel || l.pick} @${Number(l.odds).toFixed(2)}`).join(' + ')

              const parlayPosition = {
                id: `parlay-${Date.now()}`,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                loggedAt: new Date().toISOString(),
                fixture: fixtureText,
                fixtureName: fixtureText,
                fixtureMatch: fixtureText,
                leagueName: `${legs.length} Markets Acca`,
                selection: selectionText,
                selectionLabel: selectionText,
                selectionName: selectionText,
                pick: `${legs.length}-Leg Parlay`,
                odds: Number(combinedOdds.toFixed(2)),
                marketOdds: Number(combinedOdds.toFixed(2)),
                stake: calculatedStake,
                stakeAmount: calculatedStake,
                status: 'PENDING',
                legs: legs,
                ev: aggregates.combinedEv || 0,
                evPercent: aggregates.combinedEv || 0,
                pnl: 0,
                bookmaker: 'Consensus Sharp Feed',
                notes: `${legs.length} accumulator legs generated in Parlay Builder`
              }

              onLogPosition(parlayPosition)
              setLogged(true)
              setTimeout(() => setLogged(false), 2400)
            }}
            className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <span>{logged ? '✓ Position Logged to Portfolio!' : '⊞ Log Parlay Position'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleCopySummary}
          className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-pitch-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span>{copied ? '✓ Copied to Clipboard!' : '📋 Copy Parlay Summary'}</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Docked-widget trigger pill, desktop only, hidden while the panel is open */}
      {!isOpen && (
        <div className="hidden md:flex fixed bottom-20 lg:bottom-6 right-6 z-40">
          <button
            type="button"
            onClick={onToggleOpen}
            aria-expanded={isOpen}
            aria-controls="parlay-drawer"
            className="px-4 py-2.5 min-h-[44px] rounded-full bg-amber-500 hover:bg-amber-400 text-pitch-950 font-bold text-xs shadow-2xl flex items-center gap-2.5 transition-all transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-pitch-950 text-amber-400 text-xs font-mono font-bold">
              {legs.length}
            </span>
            <span>Parlay Slip</span>
            <span className="px-2 py-0.5 rounded-full bg-pitch-950/20 text-pitch-950 font-mono text-[11px]">
              @{aggregates.totalOdds.toFixed(2)}
            </span>
          </button>
        </div>
      )}

      {isOpen && (
        <>
          {/* Dimming overlay for the mobile sheet; the desktop dock stays unobtrusive */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={onToggleOpen}
            aria-hidden="true"
          />

          {/*
            One panel, two modes: bottom sheet under md, docked floating
            widget at md and above. Safe-area padding collapses to 0 on
            devices without insets.
          */}
          <div
            id="parlay-drawer"
            role="dialog"
            aria-label="Parlay slip"
            className="fixed z-50 inset-x-0 bottom-0 w-full max-w-full flex flex-col max-h-[90vh] bg-pitch-900 border-t border-pitch-700 rounded-t-3xl shadow-2xl animate-fade-in md:inset-x-auto md:left-auto md:top-auto md:right-6 md:bottom-20 lg:bottom-6 md:w-96 md:max-w-md md:max-h-[85vh] md:rounded-2xl md:border md:bg-pitch-950/95 md:backdrop-blur-xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle */}
            <div className="md:hidden w-12 h-1.5 bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" aria-hidden="true" />

            <div className="px-4 md:px-5 pt-3.5 md:pt-4 shrink-0">{slipHeader}</div>

            {/* Scrollable legs list: capped on the mobile sheet, taller window in the dock */}
            <div className="px-4 md:px-4 py-3 min-h-0 max-h-[38vh] md:max-h-60 overflow-y-auto touch-pan-y">
              {slipLegs}
            </div>

            {/* Pinned metrics block + copy action */}
            <div className="px-4 md:px-5 py-3.5 shrink-0 border-t border-pitch-800">
              {slipMetrics}
            </div>
          </div>
        </>
      )}
    </>
  )
}
