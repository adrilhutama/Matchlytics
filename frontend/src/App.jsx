// ---- App.jsx ----
// Main dashboard orchestrator:
// - Granular date range filtering (Today, Next 3 Days, Weekend, 30 Days)
// - Real-time diacritic-insensitive search
// - LocalStorage-backed Watchlist bookmarking
// - Dual View Modes (Detailed Cards vs Compact Table)
// - Interactive Poisson Score Matrix (6x6 Heatmap) modal
// - Full mobile-first responsive layout (360px up to 4K displays)

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './lib/supabase'
import Header from './components/Header'
import FilterBar, { DATE_RANGES } from './components/FilterBar'
import MatchCard from './components/MatchCard'
import CompactTableView from './components/CompactTableView'
import ScoreMatrixModal from './components/ScoreMatrixModal'
import LoadingState from './components/LoadingState'
import EmptyState from './components/EmptyState'
import ErrorState from './components/ErrorState'
import {
  isDateInRange,
  matchesSearch,
  sortFixtures,
  getWatchlist,
  toggleWatchlistItem,
} from './utils/analytics'

// ---- League metadata ----------------------------------------
export const LEAGUES = [
  { id: 'all',  label: 'All Leagues',            country: null },
  { id: 2021,   label: 'Premier League',         country: 'England' },
  { id: 2014,   label: 'La Liga',                country: 'Spain' },
  { id: 2019,   label: 'Serie A',                country: 'Italy' },
  { id: 2002,   label: 'Bundesliga',             country: 'Germany' },
  { id: 2015,   label: 'Ligue 1',                country: 'France' },
  { id: 2001,   label: 'UEFA Champions League',  country: 'Europe' },
]

const DAYS_AHEAD = 30

function buildDateRange() {
  const now = new Date()
  const end = new Date(now)
  end.setDate(end.getDate() + DAYS_AHEAD)
  return {
    from: now.toISOString(),
    to:   end.toISOString(),
  }
}

export default function App() {
  const [fixtures,            setFixtures]            = useState([])
  const [loading,             setLoading]             = useState(true)
  const [error,               setError]               = useState(null)
  const [lastUpdated,         setLastUpdated]         = useState(null)

  // Filter & Navigation states
  const [activeLeague,        setActiveLeague]        = useState('all')
  const [showWatchlistOnly,   setShowWatchlistOnly]   = useState(false)
  const [valueOnly,           setValueOnly]           = useState(false)
  const [dateRange,           setDateRange]           = useState('all')
  const [searchQuery,         setSearchQuery]         = useState('')
  const [sortOption,          setSortOption]          = useState('kickoff_asc')
  const [viewMode,            setViewMode]            = useState('cards')

  // Watchlist state (persisted in localStorage)
  const [watchlist,           setWatchlist]           = useState(() => getWatchlist())

  // Modal fixture state
  const [selectedFixture,     setSelectedFixture]     = useState(null)

  // Watchlist toggle handler
  const handleToggleWatchlist = useCallback((fixtureId) => {
    setWatchlist((prev) => toggleWatchlistItem(prev, fixtureId))
  }, [])

  // ---- Data fetching from Supabase --------------------------
  const fetchFixtures = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { from, to } = buildDateRange()

    try {
      const { data, error: sbErr } = await supabase
        .from('fixtures')
        .select('*')
        .gte('match_date', from)
        .lte('match_date', to)
        .eq('status', 'NS')
        .order('match_date', { ascending: true })

      if (sbErr) throw sbErr

      setFixtures(data || [])
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Supabase fetch error:', err)
      setError(err.message || 'Failed to load fixtures.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFixtures()
  }, [fetchFixtures])

  // ---- Client-side Multi-Criteria Filtering & Sorting -------
  const displayedFixtures = useMemo(() => {
    let result = fixtures

    // 1. Watchlist tab filter
    if (showWatchlistOnly) {
      result = result.filter((f) => watchlist.includes(f.id))
    } else if (activeLeague !== 'all') {
      result = result.filter((f) => f.league_id === activeLeague)
    }

    // 2. Value bet (+EV) only filter
    if (valueOnly) {
      result = result.filter((f) => Boolean(f.value_pick))
    }

    // 3. Granular date range filter
    if (dateRange !== 'all') {
      result = result.filter((f) => isDateInRange(f.match_date, dateRange))
    }

    // 4. Diacritic-insensitive search
    if (searchQuery.trim()) {
      result = result.filter((f) => matchesSearch(f, searchQuery))
    }

    // 5. Multi-criteria sorting
    return sortFixtures(result, sortOption)
  }, [fixtures, activeLeague, showWatchlistOnly, watchlist, valueOnly, dateRange, searchQuery, sortOption])

  // Clear all filters handler
  const handleClearFilters = useCallback(() => {
    setActiveLeague('all')
    setShowWatchlistOnly(false)
    setValueOnly(false)
    setDateRange('all')
    setSearchQuery('')
    setSortOption('kickoff_asc')
  }, [])

  const currentLeagueLabel = LEAGUES.find((l) => l.id === activeLeague)?.label
  const currentDateRangeLabel = DATE_RANGES.find((r) => r.id === dateRange)?.label

  return (
    <div className="min-h-dvh bg-pitch-950 flex flex-col text-slate-200">
      {/* Header */}
      <Header lastUpdated={lastUpdated} />

      {/* Sticky glassmorphism Filter Bar */}
      <div className="sticky top-0 z-20 glass-filter">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            leagues={LEAGUES}
            activeLeague={activeLeague}
            onLeagueChange={(id) => {
              setActiveLeague(id)
              setShowWatchlistOnly(false)
            }}
            watchlistCount={watchlist.length}
            showWatchlistOnly={showWatchlistOnly}
            onToggleWatchlistTab={() => setShowWatchlistOnly(!showWatchlistOnly)}
            valueOnly={valueOnly}
            onValueOnlyChange={setValueOnly}
            sortOption={sortOption}
            onSortChange={setSortOption}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full" id="main-content">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchFixtures} />
        ) : displayedFixtures.length === 0 ? (
          <EmptyState
            leagueLabel={currentLeagueLabel}
            valueOnly={valueOnly}
            dateRangeLabel={currentDateRangeLabel}
            searchQuery={searchQuery}
            isWatchlist={showWatchlistOnly}
            onClearFilters={handleClearFilters}
          />
        ) : (
          <section aria-label="Match fixtures feed">
            {/* Feed metadata bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-xs text-slate-400">
              <p>
                Showing <strong className="text-amber-400 font-mono">{displayedFixtures.length}</strong> {displayedFixtures.length === 1 ? 'fixture' : 'fixtures'}
                {showWatchlistOnly ? ' in Watchlist' : activeLeague !== 'all' ? ` in ${currentLeagueLabel}` : ''}
                {dateRange !== 'all' ? ` (${currentDateRangeLabel})` : ''}
              </p>
              <p className="text-slate-500 hidden sm:block">
                Odds powered by The Odds API (Bet365 / Pinnacle)
              </p>
            </div>

            {/* View Mode: Detailed Cards */}
            {viewMode === 'cards' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                {displayedFixtures.map((fixture, idx) => (
                  <MatchCard
                    key={fixture.id}
                    fixture={fixture}
                    isPinned={watchlist.includes(fixture.id)}
                    onToggleWatchlist={handleToggleWatchlist}
                    onOpenMatrix={setSelectedFixture}
                    style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                  />
                ))}
              </div>
            )}

            {/* View Mode: Compact Table */}
            {viewMode === 'table' && (
              <CompactTableView
                fixtures={displayedFixtures}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                onOpenMatrix={setSelectedFixture}
              />
            )}
          </section>
        )}
      </main>

      {/* Interactive Poisson Score Matrix Modal */}
      <ScoreMatrixModal
        fixture={selectedFixture}
        isOpen={Boolean(selectedFixture)}
        onClose={() => setSelectedFixture(null)}
      />

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-8 border-t border-pitch-800/80 w-full mt-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            Matchlytics uses Poisson bivariate goal distribution modelling. Probabilities are quantitative estimates, not guarantees.
          </p>
          <p className="text-slate-600 font-mono">
            Bet Responsibly. 18+
          </p>
        </div>
      </footer>
    </div>
  )
}
