// ---- TerminalScanner.jsx ----
// Institutional Terminal Scanner workspace:
// - Default presentation mode: Master Table View (TableView.jsx)
// - Optional toggle to Grid Cards mode (MatchCard.jsx)
// - Dense, real-time institutional feed metadata
// - Fluid container with safe mobile padding (pb-28)
// - Zero em dash characters used (R-02 compliance)

import { useState } from 'react'
import TableView from './TableView'
import MatchCard from './MatchCard'

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
  onViewModeChange,
  visibleCount = 24,
  totalCount = 0,
  onLoadMore,
}) {
  return (
    <section aria-label="Terminal Scanner Feed" className="space-y-4">
      {/* Feed Metadata Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <p className="font-mono">
          Showing <strong className="text-amber-400">{fixtures.length}</strong> of{' '}
          <strong className="text-slate-200">{allFixturesCount}</strong>{' '}
          {allFixturesCount === 1 ? 'fixture' : 'fixtures'}
          {showWatchlistOnly
            ? ' in Watchlist'
            : activeLeague !== 'all'
            ? ` in ${currentLeagueLabel}`
            : ''}
          {dateRange !== 'all' ? ` (${currentDateRangeLabel})` : ''}
        </p>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            Realtime Feed
          </span>
          <span className="text-slate-500 hidden sm:inline font-mono">
            Table-First Institutional Consensus
          </span>
        </div>
      </div>

      {/* Presentation Mode: Default Master Table */}
      {viewMode === 'table' && (
        <TableView
          fixtures={(fixtures || []).filter(Boolean)}
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

      {/* Presentation Mode: Secondary Grid Cards */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {(fixtures || []).filter(Boolean).map((fixture, idx) => {
            if (!fixture?.id) return null
            const fixtureSlipPicks = (slipLegs || [])
              .filter((l) => l?.fixtureId === fixture.id)
              .map((l) => l.pick)

            return (
              <MatchCard
                key={fixture.id}
                fixture={fixture}
                isPinned={watchlist?.includes(fixture.id)}
                onToggleWatchlist={onToggleWatchlist}
                onOpenMatrix={onOpenMatrix}
                onOpenQuantModal={onOpenQuantModal}
                onSelectForLab={onSelectForLab}
                onLogPosition={onLogPosition}
                slipPicks={fixtureSlipPicks}
                onToggleSlip={onToggleSlip}
                standingsMap={standingsMap}
                style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                quantLocked={quantLocked}
                onTriggerUpgrade={onTriggerUpgrade}
              />
            )
          })}
        </div>
      )}

      {/* Pagination Load More Button */}
      {visibleCount < totalCount && (
        <div className="flex justify-center pt-6 pb-4">
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
    </section>
  )
}
