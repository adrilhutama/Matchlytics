// ---- App.jsx ----
// Main dashboard orchestrator:
// - Granular date range filtering (Today, Next 3 Days, Weekend, 30 Days)
// - Real-time diacritic-insensitive search
// - LocalStorage-backed Watchlist bookmarking
// - Dual View Modes (Detailed Cards vs Compact Table)
// - Interactive Poisson Score Matrix (6x6 Heatmap) modal
// - Quantitative Risk Engine & Kelly Criterion modal
// - Multi-Match Parlay/Acca Slip Builder with Copyable Summary
// - Supabase Realtime channel subscription with debounced live updates
// - Full mobile-first responsive layout (360px up to 4K displays)

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './lib/supabase'
import Header from './components/Header'
import FilterBar, { DATE_RANGES } from './components/FilterBar'
import MatchCard from './components/MatchCard'
import CompactTableView from './components/CompactTableView'
import ScoreMatrixModal from './components/ScoreMatrixModal'
import KellyCalculatorModal from './components/KellyCalculatorModal'
import ParlaySlipDrawer from './components/ParlaySlipDrawer'
import LoadingState from './components/LoadingState'
import EmptyState from './components/EmptyState'
import ErrorState from './components/ErrorState'
import {
  isDateInRange,
  matchesSearch,
  sortFixtures,
  getWatchlist,
  toggleWatchlistItem,
  getParlaySlip,
  saveParlaySlip,
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
  const [standingsMap,        setStandingsMap]        = useState({})
  const [loading,             setLoading]             = useState(true)
  const [error,               setError]               = useState(null)
  const [lastUpdated,         setLastUpdated]         = useState(null)
  const [realtimeToast,       setRealtimeToast]       = useState(false)

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

  // Parlay Slip state (persisted in localStorage)
  const [parlaySlip,          setParlaySlip]          = useState(() => getParlaySlip())
  const [isSlipDrawerOpen,    setIsSlipDrawerOpen]    = useState(false)

  // Modal fixture states
  const [selectedMatrixFixture, setSelectedMatrixFixture] = useState(null)
  const [selectedQuantFixture,  setSelectedQuantFixture]  = useState(null)

  // Debounce timer reference for realtime events
  const debounceTimerRef = useRef(null)

  // Watchlist toggle handler
  const handleToggleWatchlist = useCallback((fixtureId) => {
    setWatchlist((prev) => toggleWatchlistItem(prev, fixtureId))
  }, [])

  // Parlay slip handlers
  const handleToggleSlip = useCallback((leg) => {
    setParlaySlip((prev) => {
      const existsIndex = prev.findIndex(
        (l) => l.fixtureId === leg.fixtureId && l.pick === leg.pick
      )
      let next
      if (existsIndex >= 0) {
        next = prev.filter((_, idx) => idx !== existsIndex)
      } else {
        const filteredOtherPicks = prev.filter((l) => l.fixtureId !== leg.fixtureId)
        next = [...filteredOtherPicks, leg]
      }
      saveParlaySlip(next)
      return next
    })
  }, [])

  const handleRemoveSlipLeg = useCallback((fixtureId, pick) => {
    setParlaySlip((prev) => {
      const next = prev.filter(
        (l) => !(l.fixtureId === fixtureId && l.pick === pick)
      )
      saveParlaySlip(next)
      return next
    })
  }, [])

  const handleClearSlip = useCallback(() => {
    setParlaySlip([])
    saveParlaySlip([])
    setIsSlipDrawerOpen(false)
  }, [])

  // ---- Standings fetching from Supabase ----------------------
  const fetchStandings = useCallback(async () => {
    try {
      const { data, error: stErr } = await supabase
        .from('team_standings')
        .select('*')
      if (!stErr && data) {
        const map = {}
        data.forEach((row) => {
          if (row.id) map[row.id] = row
          if (row.team_id) map[row.team_id] = row
        })
        setStandingsMap(map)
      }
    } catch (err) {
      console.warn('Failed to load team standings:', err)
    }
  }, [])

  // ---- Data fetching from Supabase --------------------------
  const fetchFixtures = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
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
      if (!isSilent) setError(err.message || 'Failed to load fixtures.')
    } finally {
      if (!isSilent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFixtures()
    fetchStandings()
  }, [fetchFixtures, fetchStandings])

  // ---- Supabase Realtime Subscription -----------------------
  useEffect(() => {
    const channel = supabase
      .channel('matchlytics-realtime-feed')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fixtures',
        },
        () => {
          // Debounce rapid sync updates (e.g. 1500ms delay)
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
          }

          debounceTimerRef.current = setTimeout(() => {
            fetchFixtures(true)
            fetchStandings()
            setRealtimeToast(true)
            setTimeout(() => setRealtimeToast(false), 3500)
          }, 1500)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_standings',
        },
        () => {
          fetchStandings()
        }
      )
      .subscribe()

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      supabase.removeChannel(channel)
    }
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

      {/* Realtime Toast Notification */}
      {realtimeToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 right-4 sm:right-6 z-50 px-4 py-2.5 rounded-xl bg-pitch-900/95 border border-emerald-500/50 text-emerald-300 text-xs font-semibold shadow-2xl flex items-center gap-2.5 animate-slide-up backdrop-blur"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Data refreshed in real-time</span>
        </div>
      )}

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
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Realtime Active
                </span>
                <span className="text-slate-500 hidden sm:inline font-mono">
                  Odds: The Odds API (Bet365 / Pinnacle)
                </span>
              </div>
            </div>

            {/* View Mode: Detailed Cards */}
            {viewMode === 'cards' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                {displayedFixtures.map((fixture, idx) => {
                  const fixtureSlipPicks = parlaySlip
                    .filter((l) => l.fixtureId === fixture.id)
                    .map((l) => l.pick)

                  return (
                    <MatchCard
                      key={fixture.id}
                      fixture={fixture}
                      isPinned={watchlist.includes(fixture.id)}
                      onToggleWatchlist={handleToggleWatchlist}
                      onOpenMatrix={setSelectedMatrixFixture}
                      onOpenQuantModal={setSelectedQuantFixture}
                      slipPicks={fixtureSlipPicks}
                      onToggleSlip={handleToggleSlip}
                      standingsMap={standingsMap}
                      style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                    />
                  )
                })}
              </div>
            )}

            {/* View Mode: Compact Table */}
            {viewMode === 'table' && (
              <CompactTableView
                fixtures={displayedFixtures}
                watchlist={watchlist}
                onToggleWatchlist={handleToggleWatchlist}
                onOpenMatrix={setSelectedMatrixFixture}
                onOpenQuantModal={setSelectedQuantFixture}
                slipLegs={parlaySlip}
                onToggleSlip={handleToggleSlip}
                standingsMap={standingsMap}
              />
            )}
          </section>
        )}
      </main>

      {/* Interactive Poisson Score Matrix Modal */}
      <ScoreMatrixModal
        fixture={selectedMatrixFixture}
        isOpen={Boolean(selectedMatrixFixture)}
        onClose={() => setSelectedMatrixFixture(null)}
        standingsMap={standingsMap}
      />

      {/* Quantitative Risk Engine & Kelly Modal */}
      <KellyCalculatorModal
        fixture={selectedQuantFixture}
        isOpen={Boolean(selectedQuantFixture)}
        onClose={() => setSelectedQuantFixture(null)}
        onAddToSlip={handleToggleSlip}
        isInSlip={parlaySlip.some((l) => l.fixtureId === selectedQuantFixture?.id)}
      />

      {/* Multi-Match Parlay Slip Floating Drawer */}
      <ParlaySlipDrawer
        legs={parlaySlip}
        isOpen={isSlipDrawerOpen}
        onToggleOpen={() => setIsSlipDrawerOpen(!isSlipDrawerOpen)}
        onRemoveLeg={handleRemoveSlipLeg}
        onClearSlip={handleClearSlip}
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
