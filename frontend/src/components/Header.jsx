// ---- Header.jsx ----
// Top-of-page header. Single <h1> per page (SEO). Shows product name
// and last-data-update timestamp.

export default function Header({ lastUpdated }) {
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <header className="border-b border-pitch-800 bg-pitch-900">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Logo: product name in type — no generated asset (R-23) */}
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-7 h-7 rounded-md bg-amber-500 flex-shrink-0"
              aria-hidden="true"
              style={{
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              }}
            />
            <h1 className="text-lg font-semibold text-slate-200 tracking-tight">
              Matchlytics
            </h1>
          </div>
          <span className="hidden sm:inline-block text-xs text-slate-500 border border-pitch-700 rounded px-2 py-0.5">
            Pre-Match Analytics
          </span>
        </div>

        <div className="text-right">
          {timeStr && (
            <p className="text-xs text-slate-500">
              Data refreshed at{' '}
              <span className="text-slate-400 tabular-nums">{timeStr}</span>
            </p>
          )}
          <p className="text-xs text-slate-600 mt-0.5">
            Model: Poisson / Bet365 odds
          </p>
        </div>
      </div>
    </header>
  )
}
