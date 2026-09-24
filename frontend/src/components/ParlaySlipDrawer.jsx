// ---- ParlaySlipDrawer.jsx ----
// Multi-match accumulator / parlay slip builder drawer.
// Calculates combined market odds, joint model probability,
// cumulative parlay EV, and fractional Kelly sizing.
// Provides structured "Copy to Clipboard" export.

import { useState, useMemo } from 'react'
import { calculateParlayAggregates } from '../utils/analytics'

export default function ParlaySlipDrawer({
  legs,
  isOpen,
  onToggleOpen,
  onRemoveLeg,
  onClearSlip,
}) {
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

  // If no items in slip, do not render drawer
  if (legs.length === 0) return null

  return (
    <>
      {/* Floating Trigger Pill (always visible on bottom right when items exist) */}
      <div className="fixed bottom-4 right-4 z-40">
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

      {/* Drawer Overlay & Panel */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-end p-0 sm:p-4 bg-pitch-950/60 backdrop-blur-sm animate-fade-in"
          onClick={onToggleOpen}
        >
          <div
            id="parlay-drawer"
            className="w-full sm:max-w-md bg-pitch-900 border-t sm:border border-pitch-700 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl overflow-y-auto max-h-[85vh] text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-pitch-800">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-100">Parlay Slip</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  {legs.length} {legs.length === 1 ? 'Leg' : 'Legs'}
                </span>
              </div>
              <div className="flex items-center gap-2">
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
                  aria-label="Close parlay drawer"
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-pitch-800 text-slate-400 hover:text-slate-100"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* List of Legs */}
            <div className="py-3 space-y-2.5 max-h-[38vh] overflow-y-auto pr-1">
              {legs.map((leg) => (
                <div
                  key={`${leg.fixtureId}-${leg.pick}`}
                  className="p-3 rounded-xl bg-pitch-950 border border-pitch-800 flex items-start justify-between gap-3 text-xs"
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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Slip Aggregates Summary */}
            <div className="pt-3 border-t border-pitch-800 space-y-2">
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
                  Note: Bookmaker compounding overround has reduced total slip expectation below 0% EV.
                </p>
              )}

              {/* Copy Slip Summary Button */}
              <button
                type="button"
                onClick={handleCopySummary}
                className="w-full py-2.5 px-4 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-pitch-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span>{copied ? '✓ Copied to Clipboard!' : '📋 Copy Parlay Summary'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
