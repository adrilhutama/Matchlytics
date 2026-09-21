// ---- LoadingState.jsx ----
// Skeleton card grid displayed while Supabase query is in flight.
// Shimmer animation communicates that content is loading (R-27).

function SkeletonCard() {
  return (
    <div className="match-card p-5" aria-hidden="true">
      {/* League row */}
      <div className="flex items-center gap-2 mb-4">
        <div className="shimmer h-4 w-4 rounded-full" />
        <div className="shimmer h-3 w-28 rounded" />
        <div className="shimmer h-3 w-16 rounded ml-auto" />
      </div>
      {/* Team names */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex flex-col items-center gap-2">
          <div className="shimmer h-10 w-10 rounded-full" />
          <div className="shimmer h-3 w-20 rounded" />
        </div>
        <div className="text-center flex flex-col gap-1">
          <div className="shimmer h-5 w-10 rounded mx-auto" />
          <div className="shimmer h-3 w-16 rounded mx-auto" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="shimmer h-10 w-10 rounded-full" />
          <div className="shimmer h-3 w-20 rounded" />
        </div>
      </div>
      {/* Prob bars */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="shimmer h-3 w-10 rounded" />
            <div className="shimmer h-4 w-14 rounded" />
            <div className="shimmer h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
      {/* Odds row */}
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="shimmer h-14 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export default function LoadingState() {
  return (
    <section aria-busy="true" aria-label="Loading match data">
      <p className="sr-only">Loading fixtures, please wait.</p>
      <div className="grid gap-4 sm:gap-5">
        {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    </section>
  )
}
