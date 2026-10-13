// ---- TerminalScanner.jsx ----
// Institutional Terminal Scanner workspace:
// - Default presentation mode: Master Table View (TableView.jsx)
// - Optional toggle to Grid Cards mode (VirtualizedFixturesList.jsx for 400+ performance)
// - Dense, real-time institutional feed metadata
// - Fluid container with safe mobile padding (pb-28)
// - Zero em dash characters used (R-02 compliance)

import { useState, lazy, Suspense } from 'react'
import TableView from './TableView'
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
  onViewModeChange,
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

      {/* Presentation Mode: Virtualized Grid Cards (handles 400+ fixtures efficiently) */}
      {viewMode === 'cards' && (
        <Suspense fallback={<LoadingState />}>
          <VirtualizedFixturesList
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
        </Suspense>
      )}
    </section>
  )
}
