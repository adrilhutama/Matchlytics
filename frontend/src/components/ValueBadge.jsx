// ---- ValueBadge.jsx ----
// The single element that gets the amber glow (R-13 dose cap: max 1-2 elements).
// Glow justification: this is the most action-critical signal on the dashboard.
// All other elements stay matte.

export default function ValueBadge({ pick, evPct }) {
  if (!pick || !evPct) return null

  const labels = { HOME: 'Home Win', DRAW: 'Draw', AWAY: 'Away Win' }

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 value-glow animate-pulse-once"
      role="status"
      aria-label={`Value bet detected: ${labels[pick]} with ${evPct}% expected value`}
    >
      {/* Solid filled triangle: a real directional signal, not a decorative arrow (R-08) */}
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="currentColor"
        className="text-amber-500 flex-shrink-0"
        aria-hidden="true"
      >
        <polygon points="5,1 9,9 1,9" />
      </svg>
      <span className="text-xs font-semibold text-amber-400">
        +EV {evPct}%
      </span>
      <span className="text-xs text-amber-500/80 font-medium">
        {labels[pick]}
      </span>
    </div>
  )
}
