// ---- FilterBar.jsx ----
// League filter pills + value-bet toggle.
// Glassmorphism is applied to the parent wrapper in App.jsx (single element dose cap).

export default function FilterBar({
  leagues,
  activeLeague,
  onLeagueChange,
  valueOnly,
  onValueOnlyChange,
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      {/* League pills */}
      <nav
        role="navigation"
        aria-label="Filter by league"
        className="flex items-center gap-1.5 flex-wrap"
      >
        {leagues.map((league) => {
          const isActive = activeLeague === league.id
          return (
            <button
              key={league.id}
              id={`filter-${league.id}`}
              onClick={() => onLeagueChange(league.id)}
              aria-pressed={isActive}
              className={[
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150',
                'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-900',
                isActive
                  ? 'bg-amber-500 text-pitch-950 border-amber-500'
                  : 'bg-pitch-800 text-slate-400 border-pitch-700 hover:border-slate-500 hover:text-slate-300',
              ].join(' ')}
            >
              {league.label}
            </button>
          )
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Value bet toggle */}
      <label
        htmlFor="value-only-toggle"
        className="flex items-center gap-2.5 cursor-pointer select-none flex-shrink-0"
      >
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
          +EV Value Bets Only
        </span>
        <button
          id="value-only-toggle"
          role="switch"
          aria-checked={valueOnly}
          onClick={() => onValueOnlyChange(!valueOnly)}
          className={[
            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-900',
            valueOnly ? 'bg-amber-500' : 'bg-pitch-600',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200',
              valueOnly ? 'translate-x-4' : 'translate-x-1',
            ].join(' ')}
          />
        </button>
      </label>
    </div>
  )
}
