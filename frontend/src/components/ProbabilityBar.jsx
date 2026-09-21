// ---- ProbabilityBar.jsx ----
// Visual probability bars: home / draw / away as coloured strips
// with accessible percentage labels.

const COLORS = {
  home: { bar: 'bg-sky-500',     text: 'text-sky-400'     },
  draw: { bar: 'bg-slate-400',   text: 'text-slate-400'   },
  away: { bar: 'bg-rose-500',    text: 'text-rose-400'    },
}

function Bar({ label, prob, color, side }) {
  const pct = Math.max(0, Math.min(100, prob ?? 0))
  return (
    <div
      className={`flex flex-col gap-1 ${side === 'away' ? 'items-end text-right' : 'items-start'}`}
    >
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${color.text}`}>
        {pct.toFixed(1)}%
      </span>
      <div className="prob-track w-full">
        <div
          className={`h-full ${color.bar} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
          role="presentation"
        />
      </div>
    </div>
  )
}

export default function ProbabilityBar({ probHome, probDraw, probAway }) {
  return (
    <div
      className="grid grid-cols-3 gap-3"
      role="group"
      aria-label="Win probabilities"
    >
      <Bar label="Home"  prob={probHome} color={COLORS.home} side="home" />
      <Bar label="Draw"  prob={probDraw} color={COLORS.draw} side="draw" />
      <Bar label="Away"  prob={probAway} color={COLORS.away} side="away" />
    </div>
  )
}
