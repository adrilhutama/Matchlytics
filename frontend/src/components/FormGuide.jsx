// ---- FormGuide.jsx ----
// 5-match form guide badge pill ([W] [D] [L]) with accessible color coding:
// - Green for Win (W)
// - Amber for Draw (D)
// - Red for Loss (L)

export default function FormGuide({ form, size = 'md' }) {
  if (!form || typeof form !== 'string') return null

  // Clean form string to uppercase W, D, L chars, max 5 matches
  const chars = form
    .toUpperCase()
    .replace(/[^WDL]/g, '')
    .slice(-5)
    .split('')

  if (chars.length === 0) return null

  const sizeClasses = size === 'sm'
    ? 'w-4 h-4 text-[9px]'
    : 'w-4.5 h-4.5 text-[10px]'

  return (
    <div
      className="inline-flex items-center gap-1"
      aria-label={`Recent 5-match form: ${chars.join('-')}`}
      title={`Recent form: ${chars.join('-')}`}
    >
      {chars.map((char, index) => {
        let badgeStyle = 'bg-pitch-800 text-slate-400 border-pitch-700'
        let label = 'Result'

        if (char === 'W') {
          badgeStyle = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
          label = 'Win'
        } else if (char === 'D') {
          badgeStyle = 'bg-amber-500/20 text-amber-400 border-amber-500/40'
          label = 'Draw'
        } else if (char === 'L') {
          badgeStyle = 'bg-rose-500/20 text-rose-400 border-rose-500/40'
          label = 'Loss'
        }

        return (
          <span
            key={index}
            className={`${sizeClasses} inline-flex items-center justify-center font-bold font-mono rounded border ${badgeStyle} shadow-sm`}
            aria-label={label}
          >
            {char}
          </span>
        )
      })}
    </div>
  )
}
