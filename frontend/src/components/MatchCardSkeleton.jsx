// ---- MatchCardSkeleton.jsx ----
// Shimmer skeleton placeholder for MatchCard grid slots while fixtures load.
// Zero em dash characters (R-02 compliance).

export default function MatchCardSkeleton() {
  return (
    <article
      className="bg-pitch-800 border border-pitch-700 rounded-xl p-3.5 sm:p-4 animate-pulse flex flex-col justify-between"
      aria-hidden="true"
    >
      {/* Header skeleton */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-pitch-600 flex-shrink-0" />
            <div className="h-3 w-20 rounded bg-pitch-600" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="h-5 w-14 rounded-md bg-pitch-600" />
            <div className="h-5 w-16 rounded-md bg-pitch-600" />
            <div className="h-5 w-12 rounded-md bg-pitch-600" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="h-6 w-14 rounded-lg bg-pitch-600" />
          <div className="w-11 h-11 rounded-xl bg-pitch-600" />
        </div>
      </div>

      {/* Teams & score skeleton */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex flex-col items-center gap-1.5 flex-1 text-center min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-pitch-600" />
          <div className="h-3 w-14 rounded bg-pitch-600" />
          <div className="h-2 w-10 rounded bg-pitch-700 mt-1" />
        </div>
        <div className="flex flex-col items-center gap-1 flex-shrink-0 px-2">
          <div className="h-2 w-8 rounded bg-pitch-600 mb-1" />
          <div className="h-8 w-12 rounded bg-pitch-600" />
          <div className="h-2 w-16 rounded bg-pitch-700 mt-1" />
        </div>
        <div className="flex flex-col items-center gap-1.5 flex-1 text-center min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-pitch-600" />
          <div className="h-3 w-14 rounded bg-pitch-600" />
          <div className="h-2 w-10 rounded bg-pitch-700 mt-1" />
        </div>
      </div>

      {/* Odds cells skeleton */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="h-16 rounded-xl bg-pitch-700" />
        <div className="h-16 rounded-xl bg-pitch-700" />
        <div className="h-16 rounded-xl bg-pitch-700" />
      </div>

      {/* EV highlight bar skeleton */}
      <div className="h-10 rounded-xl bg-pitch-700/60 mb-3" />

      {/* Expand trigger skeleton */}
      <div className="pt-3 mt-2 border-t border-pitch-800/60">
        <div className="h-10 rounded-xl bg-pitch-700/40" />
      </div>
    </article>
  )
}
