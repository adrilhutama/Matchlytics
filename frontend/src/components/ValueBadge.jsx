// ---- ValueBadge.jsx ----
// Tiered +EV Badge with Kelly Criterion fraction indicator.
// Interactive click trigger to open the quantitative Kelly calculator modal.
// Touch target >= 44px for full mobile usability.

export default function ValueBadge({
  pick,
  evPct,
  odds,
  modelProb,
  onClick,
}) {
  if (!pick || !evPct) return null

  const labels = { HOME: 'Home Win', DRAW: 'Draw', AWAY: 'Away Win' }
  const numericEv = Number(evPct) || 0

  // Quick Kelly approximation if odds and modelProb provided
  let kellyFraction = null
  if (odds && modelProb) {
    const o = Number(odds)
    const p = Number(modelProb) / 100
    if (o > 1 && p > 0) {
      const b = o - 1
      const q = 1 - p
      const full = Math.max(0, (b * p - q) / b)
      kellyFraction = Math.min(5.0, Math.max(0, full * 0.25 * 100)).toFixed(1)
    }
  }

  // Tiered visual treatment
  let tierBadge = 'Moderate'
  let borderClass = 'border-amber-500/40 bg-amber-500/15 text-amber-300'
  if (numericEv >= 15.0) {
    tierBadge = 'Prime'
    borderClass = 'border-amber-400 bg-amber-500/25 text-amber-300 shadow-sm'
  } else if (numericEv >= 8.0) {
    tierBadge = 'High'
    borderClass = 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
  }

  const badgeContent = (
    <div className="inline-flex items-center gap-1.5 sm:gap-2">
      {/* Triangle indicator */}
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="currentColor"
        className="text-amber-400 flex-shrink-0"
        aria-hidden="true"
      >
        <polygon points="5,1 9,9 1,9" />
      </svg>
      <span className="font-bold font-mono">
        +EV {numericEv.toFixed(1)}%
      </span>
      {kellyFraction && (
        <span className="text-[11px] font-mono text-slate-300 hidden sm:inline">
          · Kelly {kellyFraction}%
        </span>
      )}
      <span className="text-[10px] px-1.5 py-0.2 rounded bg-pitch-950/60 font-semibold uppercase">
        {tierBadge}
      </span>
      <span className="text-[11px] text-slate-400 font-mono ml-0.5" aria-hidden="true">
        ⓘ
      </span>
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`View quant breakdown for ${labels[pick] || pick} with ${numericEv}% expected value`}
        className={`inline-flex items-center px-3 py-2 min-h-[44px] rounded-full border transition-all hover:scale-105 active:scale-95 value-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${borderClass}`}
      >
        {badgeContent}
      </button>
    )
  }

  return (
    <div
      className={`inline-flex items-center px-3 py-1.5 rounded-full border value-glow ${borderClass}`}
      role="status"
    >
      {badgeContent}
    </div>
  )
}
