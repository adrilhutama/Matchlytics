// ---- MatchCardSkeleton.jsx ----
// Shimmer skeleton placeholder for MatchCard during loading.
// Renders 3-4 cards with animated placeholder shapes matching card layout.
// Zero em dash characters (R-02 compliance).

export default function MatchCardSkeleton({ count = 3 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse p-3 sm:p-4 rounded-xl bg-pitch-900 border border-pitch-800"
        >
          {/* Header: league badge + time badge + star */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-pitch-700" />
                <div className="h-3 w-16 bg-pitch-700 rounded" />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="h-3 w-12 bg-pitch-700 rounded" />
                <div className="h-3 w-10 bg-pitch-700 rounded" />
                <div className="h-3 w-14 bg-pitch-700 rounded" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="h-4 w-10 bg-pitch-700 rounded" />
              <div className="h-2 w-8 bg-pitch-700 rounded" />
              <div className="w-11 h-11 rounded-xl bg-pitch-700" />
            </div>
          </div>

          {/* Teams + predicted score */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className="w-7 h-7 rounded-full bg-pitch-700" />
              <div className="h-3 w-20 bg-pitch-700 rounded" />
              <div className="h-2.5 w-12 bg-pitch-700 rounded" />
            </div>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="h-6 w-8 bg-pitch-700 rounded" />
              <div className="h-2.5 w-10 bg-pitch-700 rounded" />
            </div>
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className="w-7 h-7 rounded-full bg-pitch-700" />
              <div className="h-3 w-20 bg-pitch-700 rounded" />
              <div className="h-2.5 w-12 bg-pitch-700 rounded" />
            </div>
          </div>

          {/* Odds pills */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-12 bg-pitch-700 rounded-xl" />
            ))}
          </div>

          {/* +EV bar placeholder */}
          <div className="h-8 bg-pitch-700 rounded-xl mb-3" />

          {/* Market tabs placeholder */}
          <div className="flex gap-1 bg-pitch-800/50 rounded-xl p-1 mb-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex-1 h-6 bg-pitch-700 rounded-lg" />
            ))}
          </div>

          {/* Action buttons placeholder */}
          <div className="grid grid-cols-2 gap-2">
            <div className="h-10 bg-pitch-700 rounded-xl" />
            <div className="h-10 bg-pitch-700 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}
