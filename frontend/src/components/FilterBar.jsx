// ---- FilterBar.jsx ----
// Multi-dimensional filters: Search input, Granular Date Range,
// League selector & Watchlist tab, +EV toggle, Sorting, and View Mode.
// High usability, zero horizontal overflow, touch-target compliant.

export const DATE_RANGES = [
  { id: 'all',       label: 'All (30 Days)' },
  { id: 'today',     label: 'Today' },
  { id: 'next3days', label: 'Next 3 Days' },
  { id: 'weekend',   label: 'This Weekend' },
]

export const SORT_OPTIONS = [
  { id: 'kickoff_asc',    label: 'Kickoff Time (Asc)' },
  { id: 'ev_desc',        label: 'Expected Value (+EV %)' },
  { id: 'home_prob_desc', label: 'Home Win Prob' },
  { id: 'xg_total_desc',  label: 'Goal Expectancy (xG Total)' },
]

export default function FilterBar({
  searchQuery,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  leagues,
  activeLeague,
  onLeagueChange,
  watchlistCount,
  showWatchlistOnly,
  onToggleWatchlistTab,
  valueOnly,
  onValueOnlyChange,
  sortOption,
  onSortChange,
  viewMode,
  onViewModeChange,
}) {
  return (
    <div className="space-y-3">
      {/* ---- Row 1: Search, Sort & View Mode ---- */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search team or league..."
            aria-label="Search fixtures by team or league"
            className="w-full pl-10 pr-9 py-2 min-h-[44px] rounded-xl bg-pitch-900 border border-pitch-700 text-sm text-slate-100 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search input"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 min-h-[44px]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Controls Cluster: Sort + View Mode */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Sorting Dropdown */}
          <div className="flex-1 sm:flex-initial">
            <label htmlFor="sort-dropdown" className="sr-only">Sort matches</label>
            <select
              id="sort-dropdown"
              value={sortOption}
              onChange={(e) => onSortChange(e.target.value)}
              className="w-full sm:w-auto min-h-[44px] px-3 py-2 rounded-xl bg-pitch-900 border border-pitch-700 text-xs font-medium text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-pitch-900 text-slate-200">
                  Sort: {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle: Cards vs Table */}
          <div
            className="inline-flex rounded-xl bg-pitch-900 border border-pitch-700 p-0.5"
            role="group"
            aria-label="View mode toggle"
          >
            <button
              type="button"
              onClick={() => onViewModeChange('cards')}
              aria-pressed={viewMode === 'cards'}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                viewMode === 'cards'
                  ? 'bg-amber-500 text-pitch-950 font-semibold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              aria-pressed={viewMode === 'table'}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                viewMode === 'table'
                  ? 'bg-amber-500 text-pitch-950 font-semibold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---- Row 2: Date Filters & Watchlist / League Pills ---- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1 border-t border-pitch-800/80">
        {/* Date Range Pills */}
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter by date range">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mr-1 hidden sm:inline">
            Time:
          </span>
          {DATE_RANGES.map((r) => {
            const isActive = dateRange === r.id
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onDateRangeChange(r.id)}
                aria-pressed={isActive}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  isActive
                    ? 'bg-pitch-700 text-amber-300 border-amber-400/60 font-semibold'
                    : 'bg-pitch-900 text-slate-400 border-pitch-700 hover:border-slate-500 hover:text-slate-200'
                }`}
              >
                {r.label}
              </button>
            )
          })}
        </div>

        {/* Value Bet Only Switch */}
        <div className="flex items-center justify-between lg:justify-end gap-3">
          <label
            htmlFor="value-only-toggle"
            className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0"
          >
            <span className="text-xs text-slate-300 font-medium whitespace-nowrap">
              +EV Bets Only
            </span>
            <button
              id="value-only-toggle"
              type="button"
              role="switch"
              aria-checked={valueOnly}
              onClick={() => onValueOnlyChange(!valueOnly)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                valueOnly ? 'bg-amber-500' : 'bg-pitch-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                  valueOnly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* ---- Row 3: League Selector & Watchlist Tab ---- */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1" role="navigation" aria-label="Filter by league or watchlist">
        {/* Watchlist Tab */}
        <button
          type="button"
          onClick={onToggleWatchlistTab}
          aria-pressed={showWatchlistOnly}
          className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
            showWatchlistOnly
              ? 'bg-amber-500 text-pitch-950 border-amber-500 shadow'
              : 'bg-pitch-900 text-amber-400 border-amber-500/40 hover:bg-amber-500/10'
          }`}
        >
          <span>⭐</span>
          <span>Watchlist</span>
          {watchlistCount > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              showWatchlistOnly ? 'bg-pitch-950 text-amber-300' : 'bg-amber-500/20 text-amber-300'
            }`}>
              {watchlistCount}
            </span>
          )}
        </button>

        {/* League Pills */}
        {leagues.map((league) => {
          const isActive = !showWatchlistOnly && activeLeague === league.id
          return (
            <button
              key={league.id}
              type="button"
              id={`filter-${league.id}`}
              onClick={() => onLeagueChange(league.id)}
              aria-pressed={isActive}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                isActive
                  ? 'bg-amber-500 text-pitch-950 border-amber-500 font-semibold'
                  : 'bg-pitch-900 text-slate-400 border-pitch-700 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              {league.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
