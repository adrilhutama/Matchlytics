// ---- TerminalScanner.jsx ----
// Institutional Terminal Scanner workspace:
// - Default presentation mode: Master Table View (TableView.jsx)
// - Desktop Grid: VirtualizedFixturesList for 400+ fixtures
// - Mobile Grid: regular scrollable card grid (AutoSizer unreliable on mobile)
// - Dense, real-time institutional feed metadata
// - Fluid container with safe mobile padding (pb-28)
// - Zero em dash characters used (R-02 compliance).

import { lazy, Suspense } from 'react'
import TableView from './TableView'
import MatchCard from './MatchCard'
const VirtualizedFixturesList = lazy(() => import('./VirtualizedFixturesList'))
import LoadingState from './LoadingState'

export default function TerminalScanner({
  fixtures = [],
  allFixturesCount = 0,
  currentLeagueLabel = '',
  currentDateRangeLabel = '',
  showWatchlistOnly = false,
  activeLeague = 'all',
  dateRange = 'all',
  watchlist = [],
  onToggleWatchlist,
  onOpenMatrix,
  onOpenQuantModal,
  onSelectForLab,
  onLogPosition,
  slipLegs = [],
  onToggleSlip,
  standingsMap = {},
  quantLocked = false,
  onTriggerUpgrade,
  viewMode = 'table',
  visibleCount = 24,
  totalCount = 0,
  onLoadMore,
}) {
  const validFixtures = (fixtures || []).filter(Boolean)

  return (
    <section aria-label="Terminal Scanner Feed" className="space-y-4">
      {/* Feed Metadata Status Bar */}
      <div className="hidden sm:flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-xs text-slate-400">
        <p className="font-mono text-[11px] sm:text-xs">
          <strong className="text-amber-400">{fixtures.length}</strong>
          <span className="text-slate-500 mx-1">of</span>
          <strong className="text-slate-200">{allFixturesCount}</strong>
          {showWatchlistOnly
            ? <span className="text-slate-500"> watchlist</span>
            : activeLeague !== 'all'
            ? <span className="text-slate-500"> {currentLeagueLabel}</span>
            : null}
          {dateRange !== 'all' ? <span className="text-slate-500">({currentDateRangeLabel})</span> : null}
        </p>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            Live
          </span>
          <span className="text-slate-500 hidden sm:inline font-mono">
            Institutional Consensus
          </span>
        </div>
      </div>

      {/* Presentation Mode: Default Master Table */}
      {viewMode === 'table' && (
        <TableView
          fixtures={validFixtures}
          watchlist={watchlist}
          onToggleWatchlist={onToggleWatchlist}
          onOpenMatrix={onOpenMatrix}
          onOpenQuantModal={onOpenQuantModal}
          onSelectForLab={onSelectForLab}
          onLogPosition={onLogPosition}
          slipLegs={slipLegs}
          onToggleSlip={onToggleSlip}
          standingsMap={standingsMap}
          quantLocked={quantLocked}
          onTriggerUpgrade={onTriggerUpgrade}
        />
      )}

      {/* Desktop: Virtualized Grid Cards (handles 400+ fixtures efficiently) */}
      {viewMode === 'cards' && (
        <div className="hidden sm:block">
          <Suspense fallback={<LoadingState />}>
            <VirtualizedFixturesList
              fixtures={validFixtures}
              watchlist={watchlist}
              onToggleWatchlist={onToggleWatchlist}
              onOpenMatrix={onOpenMatrix}
              onOpenQuantModal={onOpenQuantModal}
              onSelectForLab={onSelectForLab}
              onLogPosition={onLogPosition}
              slipLegs={slipLegs}
              onToggleSlip={onToggleSlip}
              standingsMap={standingsMap}
              quantLocked={quantLocked}
              onTriggerUpgrade={onTriggerUpgrade}
            />
          </Suspense>
        </div>
      )}

      {/* Mobile: Simple Scrollable Card Grid (no AutoSizer needed) */}
      {viewMode === 'cards' && (
        <div className="sm:hidden space-y-4 pb-4">
          {validFixtures.slice(0, visibleCount).map((fixture, idx) => (
            <MatchCard
              key={fixture.id}
              fixture={fixture}
              isPinned={watchlist?.includes(fixture.id)}
              onToggleWatchlist={onToggleWatchlist}
              onOpenMatrix={onOpenMatrix}
              onOpenQuantModal={onOpenQuantModal}
              onSelectForLab={onSelectForLab}
              onLogPosition={onLogPosition}
              slipPicks={(slipLegs || []).filter((l) => l?.fixtureId === fixture.id).map((l) => l.pick)}
              onToggleSlip={onToggleSlip}
              standingsMap={standingsMap}
              quantLocked={quantLocked}
              onTriggerUpgrade={onTriggerUpgrade}
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            />
          ))}

          {/* Load More Button */}
          {visibleCount < totalCount && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={onLoadMore}
                className="px-6 py-2.5 rounded-xl bg-pitch-950 border border-pitch-700 hover:border-amber-500/50 hover:bg-pitch-800 text-xs font-mono font-semibold text-slate-300 hover:text-amber-400 transition-all flex items-center gap-2.5 shadow-lg group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <span>Load More Fixtures</span>
                <span className="px-2 py-0.5 rounded-md bg-pitch-900 group-hover:bg-amber-500/20 text-[10px] text-amber-400 border border-pitch-700 group-hover:border-amber-500/30 transition-colors">
                  +{Math.min(24, totalCount - visibleCount)} of {totalCount - visibleCount} remaining
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
