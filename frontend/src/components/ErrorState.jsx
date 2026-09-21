// ---- ErrorState.jsx ----
// Shown when the Supabase query throws an error.
// Names what failed and gives one action: retry (R-27).

export default function ErrorState({ message, onRetry }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 text-center animate-fade-in"
      role="alert"
      aria-live="assertive"
    >
      {/* Warning icon */}
      <svg
        width="44"
        height="44"
        viewBox="0 0 44 44"
        fill="none"
        className="text-rose-500 mb-4"
        aria-hidden="true"
      >
        <path
          d="M22 6L40 38H4L22 6Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <line x1="22" y1="18" x2="22" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="22" cy="33" r="1.5" fill="currentColor" />
      </svg>

      <h2 className="text-slate-200 font-semibold text-base mb-2">
        Could not load fixture data
      </h2>
      <p className="text-slate-500 text-sm max-w-sm text-balance mb-6">
        {message || 'A connection error occurred while fetching from Supabase. Check your network and env vars.'}
      </p>

      <button
        id="retry-btn"
        onClick={onRetry}
        className="px-5 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-pitch-950 hover:bg-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-950"
      >
        Retry
      </button>
    </div>
  )
}
