// ---- EmptyState.jsx ----
// Context-sensitive empty state when no fixtures match active filters.
// Provides clear diagnostic explanation and single reset action.

export default function EmptyState({
  leagueLabel,
  valueOnly,
  dateRangeLabel,
  searchQuery,
  isWatchlist,
  onClearFilters,
}) {
  let title = 'No fixtures found'
  let hint = 'Try adjusting your search criteria, league filter, or time window.'

  if (isWatchlist) {
    title = 'Your Watchlist is empty'
    hint = 'Click the star icon (⭐) on any match card to bookmark it for quick access here.'
  } else if (searchQuery) {
    title = `No matches found for "${searchQuery}"`
    hint = 'Check the team or league spelling, or clear the search query to view all available fixtures.'
  } else if (valueOnly) {
    title = `No +EV value bets found in ${leagueLabel || 'selected leagues'}`
    hint = 'The quantitative model found no current market mispricings meeting the strict 2%-35% EV guardrails.'
  } else if (dateRangeLabel && dateRangeLabel !== 'All (30 Days)') {
    title = `No upcoming matches scheduled for ${dateRangeLabel}`
    hint = 'No fixtures kick off in this specific time window. Switch to All (30 Days) to see future matches.'
  }

  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in bg-pitch-900/40 border border-pitch-800 rounded-2xl"
      role="status"
      aria-live="polite"
    >
      <div className="w-16 h-16 rounded-2xl bg-pitch-800 flex items-center justify-center text-slate-500 mb-4 border border-pitch-700">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </div>

      <h2 className="text-slate-200 font-semibold text-base sm:text-lg mb-2">{title}</h2>
      <p className="text-slate-400 text-sm max-w-md text-balance leading-relaxed mb-6">{hint}</p>

      <button
        type="button"
        id="clear-filters-btn"
        onClick={onClearFilters}
        className="px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl bg-pitch-800 hover:bg-amber-500 hover:text-pitch-950 text-slate-200 border border-pitch-700 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        Reset all filters
      </button>
    </div>
  )
}
