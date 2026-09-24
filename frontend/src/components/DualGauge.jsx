// ---- DualGauge.jsx ----
// Dual-color progress bars for Over/Under 2.5 and BTTS (Yes/No)
// High contrast, clear labels, accessible progress bars.

export default function DualGauge({ probOver25, probBtts }) {
  const over = probOver25 != null ? Math.max(0, Math.min(100, Number(probOver25))) : null
  const under = over != null ? Math.round((100 - over) * 10) / 10 : null

  const bttsYes = probBtts != null ? Math.max(0, Math.min(100, Number(probBtts))) : null
  const bttsNo = bttsYes != null ? Math.round((100 - bttsYes) * 10) / 10 : null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-pitch-900/90 border border-pitch-700/70">
      {/* Over / Under 2.5 */}
      <div>
        <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
          <span className="text-emerald-400">
            Over 2.5: <strong className="font-mono text-emerald-300">{over != null ? `${over.toFixed(0)}%` : 'N/A'}</strong>
          </span>
          <span className="text-slate-400">
            Under 2.5: <strong className="font-mono text-slate-300">{under != null ? `${under.toFixed(0)}%` : 'N/A'}</strong>
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-pitch-700 overflow-hidden flex" role="progressbar" aria-valuenow={over || 0} aria-valuemin={0} aria-valuemax={100} aria-label="Over Under 2.5 goals probability">
          {over != null ? (
            <>
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${over}%` }}
              />
              <div
                className="h-full bg-pitch-600 transition-all duration-500"
                style={{ width: `${under}%` }}
              />
            </>
          ) : (
            <div className="h-full w-full bg-pitch-700" />
          )}
        </div>
      </div>

      {/* BTTS Yes / No */}
      <div>
        <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
          <span className="text-sky-400">
            BTTS Yes: <strong className="font-mono text-sky-300">{bttsYes != null ? `${bttsYes.toFixed(0)}%` : 'N/A'}</strong>
          </span>
          <span className="text-slate-400">
            No: <strong className="font-mono text-slate-300">{bttsNo != null ? `${bttsNo.toFixed(0)}%` : 'N/A'}</strong>
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-pitch-700 overflow-hidden flex" role="progressbar" aria-valuenow={bttsYes || 0} aria-valuemin={0} aria-valuemax={100} aria-label="Both teams to score probability">
          {bttsYes != null ? (
            <>
              <div
                className="h-full bg-sky-500 transition-all duration-500"
                style={{ width: `${bttsYes}%` }}
              />
              <div
                className="h-full bg-pitch-600 transition-all duration-500"
                style={{ width: `${bttsNo}%` }}
              />
            </>
          ) : (
            <div className="h-full w-full bg-pitch-700" />
          )}
        </div>
      </div>
    </div>
  )
}
