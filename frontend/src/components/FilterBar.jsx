// ---- FilterBar.jsx ----
// Multi-dimensional filters: Search input, Tier-Gated Date Range,
// League selector & Watchlist tab, +EV toggle, Sorting, and View Mode.
// Ergonomic, finger-friendly touch targets (min 44px), compact mobile register.
// Zero em dash characters (R-02 compliance).

export const DATE_RANGES = [
  { id: 'today', label: 'Today', shortLabel: 'Today' },
  { id: 'week',  label: 'Next 7 Days (Weekly)', shortLabel: '7 Days' },
  { id: 'all',   label: 'All (30 Days)', shortLabel: '30 Days' },
]

// Which horizon key each tier can actually select. The FilterBar uses
// this map to render locks and to refuse out-of-tier selections.
const TIER_ACCESS = {
  free:          ['today'],
  pro:           ['today', 'week'],
  annual:        ['today', 'week', 'all'],
  institutional: ['today', 'week', 'all'],
}

const UPGRADE_HINTS = {
  week: 'Upgrade to Pro to view weekly fixtures',
  all:  'Upgrade to Annual to view the full 30-day season',
}

export const MARKET_CATEGORIES = [
  { id: 'all',     label: 'All Markets' },
  { id: 'h2h',     label: '1X2 Moneyline' },
  { id: 'totals',  label: 'Totals (O/U)' },
  { id: 'spreads', label: 'Asian Handicap' },
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
  selectedMarket = 'all',
  onMarketChange = () => {},
  leagues = [],
  activeLeague,
  onLeagueChange,
  watchlistCount = 0,
  showWatchlistOnly = false,
  onToggleWatchlistTab,
  valueOnly = false,
  onValueOnlyChange,
  sortOption,
  onSortChange,
  viewMode = 'cards',
  onViewModeChange,
  tier = 'free',
  onTriggerUpgrade,
}) {
  const accessibleRanges = TIER_ACCESS[tier] || TIER_ACCESS.free
  const evLocked = !accessibleRanges.includes('week')

  const handlePillClick = (r) => {
    if (accessibleRanges.includes(r.id)) {
      onDateRangeChange(r.id)
      return
    }
    if (onTriggerUpgrade) onTriggerUpgrade(UPGRADE_HINTS[r.id])
  }

  const handleValueToggle = () => {
    if (evLocked) {
      if (onTriggerUpgrade) onTriggerUpgrade(UPGRADE_HINTS.week)
      return
    }
    onValueOnlyChange(!valueOnly)
  }

  return (
    <div className="space-y-2.5">
      {/* ---- Row 1: Search Bar (Full-width, clean touch clear button) ---- */}
      <div className="relative w-full">
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
          className="w-full pl-10 pr-10 py-2 min-h-[44px] rounded-xl bg-pitch-900 border border-pitch-700 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:border-transparent transition-all touch-manipulation"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search input"
            className="absolute inset-y-0 right-0 pr-3 flex items-center justify-center text-slate-400 hover:text-slate-200 min-h-[44px] min-w-[44px] active:scale-95 transition-transform"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* ---- Row 2: Sort Dropdown (flex-1) + Cards/Table Segment (min-h-[44px]) ---- */}
      <div className="flex items-center gap-2 w-full">
        {/* Sorting Dropdown with generous touch area */}
        <div className="flex-1 min-w-0">
          <label htmlFor="sort-dropdown" className="sr-only">Sort matches</label>
          <div className="relative">
            <select
              id="sort-dropdown"
              value={sortOption}
              onChange={(e) => onSortChange(e.target.value)}
              className="w-full min-h-[44px] pl-3 pr-8 py-2 rounded-xl bg-pitch-900 border border-pitch-700 text-xs font-medium text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 appearance-none truncate cursor-pointer transition-colors"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-pitch-900 text-slate-200">
                  Sort: {opt.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>

        {/* View Mode Toggle: Cards vs Table with finger-friendly buttons */}
        <div
          className="inline-flex rounded-xl bg-pitch-900 border border-pitch-700 p-1 flex-shrink-0"
          role="group"
          aria-label="View mode toggle"
        >
          <button
            type="button"
            onClick={() => onViewModeChange('cards')}
            aria-pressed={viewMode === 'cards'}
            className={`min-h-[42px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 active:scale-95 touch-manipulation ${
              viewMode === 'cards'
                ? 'bg-amber-500 text-pitch-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-pitch-800'
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
            className={`min-h-[42px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 active:scale-95 touch-manipulation ${
              viewMode === 'table'
                ? 'bg-amber-500 text-pitch-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-pitch-800'
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

            {/* ---- Row 2.5: Market Category Selector Pills ---- */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 touch-pan-x" role="group" aria-label="Filter by market category">
        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider pl-1 flex-shrink-0">
          Market:
        </span>
        {MARKET_CATEGORIES.map((cat) => {
          const isActive = selectedMarket === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onMarketChange(cat.id)}
              aria-pressed={isActive}
              className={`flex-shrink-0 min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-xl transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 active:scale-95 touch-manipulation ${
                isActive
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm'
                  : 'bg-pitch-900 text-slate-400 border-pitch-700 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          )
        })}
      </div>

{/* ---- Row 3: Horizon Selector Pills & Finger-Friendly +EV Toggle ---- */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-pitch-800/80">
        {/* Date Range Pills with short labels on mobile and full on desktop */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-nowrap py-0.5 touch-pan-x min-w-0"
          role="group"
          aria-label="Filter by date range"
        >
          {DATE_RANGES.map((r) => {
            const isActive = dateRange === r.id
            const isLocked = !accessibleRanges.includes(r.id)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => handlePillClick(r)}
                aria-pressed={isActive}
                title={isLocked ? UPGRADE_HINTS[r.id] : undefined}
                className={`flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 min-h-[44px] active:scale-95 touch-manipulation ${
                  isActive
                    ? 'bg-pitch-800 text-amber-300 border-amber-400/60 font-semibold shadow-sm'
                    : isLocked
                    ? 'bg-pitch-900 text-slate-500 border-amber-500/20 cursor-pointer hover:border-amber-500/40'
                    : 'bg-pitch-900 text-slate-400 border-pitch-700 hover:border-slate-500 hover:text-slate-200'
                }`}
              >
                {isLocked && (
                  <span aria-hidden="true" className="text-amber-400 text-xs">🔒</span>
                )}
                {/* Compact label on narrow mobile, full label on larger screens */}
                <span className="sm:hidden">{r.shortLabel}</span>
                <span className="hidden sm:inline">{r.label}</span>
              </button>
            )
          })}
        </div>

        {/* Large, Finger-Friendly +EV Only Action Button */}
        <button
          type="button"
          role="switch"
          aria-checked={evLocked ? false : valueOnly}
          onClick={handleValueToggle}
          title={evLocked ? 'Pro feature. Tap to unlock.' : undefined}
          className={`flex-shrink-0 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 active:scale-95 touch-manipulation select-none ${
            valueOnly && !evLocked
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
              : evLocked
              ? 'bg-pitch-900 text-slate-500 border-amber-500/30'
              : 'bg-pitch-900 text-slate-400 border-pitch-700 hover:border-slate-500 hover:text-slate-200'
          }`}
        >
          {evLocked ? (
            <span aria-hidden="true" className="text-amber-400 text-xs">🔒</span>
          ) : (
            <span className={valueOnly ? 'text-emerald-400' : 'text-slate-500'}>⚡</span>
          )}
          <span>+EV Only</span>
        </button>
      </div>

      {/* ---- Row 4: League Selector & Watchlist Tab (Desktop lg+ only) ---- */}
      <div className="hidden lg:flex overflow-x-auto no-scrollbar items-center gap-1.5 py-1 touch-pan-x" role="navigation" aria-label="Filter by league or watchlist">
        {/* Watchlist Tab */}
        <button
          type="button"
          onClick={onToggleWatchlistTab}
          aria-pressed={showWatchlistOnly}
          className={`flex-shrink-0 min-h-[44px] px-3 py-2 text-xs font-semibold rounded-xl transition-all border flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
            showWatchlistOnly
              ? 'bg-amber-500 text-pitch-950 border-amber-500 shadow'
              : 'bg-pitch-900 text-amber-400 border-amber-500/40 hover:bg-amber-500/10'
          }`}
        >
          <span>⭐</span>
          <span>Watchlist</span>
          {watchlistCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
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
              className={`flex-shrink-0 min-h-[44px] px-3 py-2 text-xs font-medium rounded-xl transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
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
