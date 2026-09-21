// ---- EmptyState.jsx ----
// Shown when the Supabase query returns zero rows.
// Names the cause and provides the one action to resolve it (R-27).

export default function EmptyState({ leagueLabel, valueOnly, onClearFilters }) {
  const reason = valueOnly
    ? `No value bets detected in ${leagueLabel || 'the selected leagues'} for the next 30 days.`
    : `No upcoming fixtures found for ${leagueLabel || 'the selected league'} in the next 30 days.`

  const hint = valueOnly
    ? 'The model found no odds mispricing above the 5% EV threshold. Check back after the next daily sync (06:00 UTC).'
    : 'Fixture metadata is populated by the monthly sync. Run sync_monthly_fixtures.py or trigger the GitHub Action if data is missing.'

  return (
    <div
      className="flex flex-col items-center justify-center py-20 text-center animate-fade-in"
      role="status"
      aria-live="polite"
    >
      {/* Pitch icon — relevant to a sports data tool */}
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        className="text-pitch-600 mb-4"
        aria-hidden="true"
      >
        <rect x="4" y="8" width="40" height="32" rx="3" stroke="currentColor" strokeWidth="2" />
        <line x1="24" y1="8" x2="24" y2="40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="1.5" />
        <rect x="4" y="16" width="6" height="16" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="38" y="16" width="6" height="16" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>

      <h2 className="text-slate-300 font-semibold text-base mb-2">{reason}</h2>
      <p className="text-slate-500 text-sm max-w-md text-balance">{hint}</p>

      {(valueOnly || leagueLabel !== 'All Leagues') && (
        <button
          id="clear-filters-btn"
          onClick={onClearFilters}
          className="mt-6 px-4 py-2 text-sm font-medium rounded-lg bg-pitch-800 border border-pitch-700 text-slate-300 hover:border-slate-500 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
