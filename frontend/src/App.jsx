// ---- App.jsx ----
// Main dashboard orchestrator, modern SaaS layout:
// - Left Sidebar  (desktop/laptop, lg+)       : branding, feeds, leagues, status
// - Top Filter Bar (scrolls with main content): search, date range, sort, view mode
// - Mobile Bottom Nav (below lg)              : Matches / +EV / Leagues / Watchlist / Slip
// - Mobile League Drawer                      : slide-up sheet triggered from nav
//
// Data sources
// - Supabase realtime channel debounced at 1500 ms
// - LocalStorage-backed watchlist & parlay slip
// - Date-range, league, value-only, search, sort, and view-mode filters all applied client-side

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './lib/supabase'
import Header from './components/Header'
import FilterBar, { DATE_RANGES } from './components/FilterBar'
import MatchCard from './components/MatchCard'
import CompactTableView from './components/CompactTableView'
import ScoreMatrixModal from './components/ScoreMatrixModal'
import KellyCalculatorModal from './components/KellyCalculatorModal'
import ParlaySlipDrawer from './components/ParlaySlipDrawer'
import PerformanceModal from './components/PerformanceModal'
import LoadingState from './components/LoadingState'
import EmptyState from './components/EmptyState'
import ErrorState from './components/ErrorState'
import Sidebar from './components/Sidebar'
import MobileNav from './components/MobileNav'
import MobileLeagueDrawer from './components/MobileLeagueDrawer'
import InstallPrompt from './components/InstallPrompt'
import {
  isDateInRange,
  matchesSearch,
  sortFixtures,
  getWatchlist,
  toggleWatchlistItem,
  getParlaySlip,
  saveParlaySlip,
} from './utils/analytics'

// ---- League metadata (also imported by Sidebar when needed) --------
export const LEAGUES = [
  { id: 'all',  label: 'All Leagues',            country: null },
  { id: 2021,   label: 'Premier League',         country: 'England' },
  { id: 2014,   label: 'La Liga',                country: 'Spain' },
  { id: 2019,   label: 'Serie A',                country: 'Italy' },
  { id: 2002,   label: 'Bundesliga',             country: 'Germany' },
  { id: 2015,   label: 'Ligue 1',                country: 'France' },
  { id: 2001,   label: 'UEFA Champions League',  country: 'Europe' },
]

const LEAGUE_IDS = LEAGUES.filter((l) => l.id !== 'all').map((l) => l.id)

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

// Feed type maps cleanly onto existing filter booleans:
//   'all'        -> no extra filters
//   'value'      -> valueOnly = true
//   'watchlist'  -> showWatchlistOnly = true
//   'matches'    -> same as 'all' (kept for mobile-nav consistency)

export default function App() {
  const [fixtures,            setFixtures]            = useState([])
  const [standingsMap,        setStandingsMap]        = useState({})
  const [loading,             setLoading]             = useState(true)
  const [error,               setError]               = useState(null)
  const [lastUpdated,         setLastUpdated]         = useState(null)
  const [realtimeToast,       setRealtimeToast]       = useState(false)

  // Navigation state
  const [activeFeed,          setActiveFeed]          = useState('all')
  const [activeLeague,        setActiveLeague]        = useState('all')
  const [showWatchlistOnly,   setShowWatchlistOnly]   = useState(false)
  const [valueOnly,           setValueOnly]           = useState(false)
  const [dateRange,           setDateRange]           = useState('all')
  const [searchQuery,         setSearchQuery]         = useState('')
  const [sortOption,          setSortOption]          = useState('kickoff_asc')
  const [viewMode,            setViewMode]            = useState('cards')

  // Mobile-specific sheet state
  const [isLeagueDrawerOpen,  setIsLeagueDrawerOpen]  = useState(false)
  const [activeMobileTab,     setActiveMobileTab]     = useState('matches')

  // Persistence-backed lists
  const [watchlist,           setWatchlist]           = useState(() => getWatchlist())
  const [parlaySlip,          setParlaySlip]          = useState(() => getParlaySlip())
  const [isSlipDrawerOpen,    setIsSlipDrawerOpen]    = useState(false)

  // Modal fixtures
  const [selectedMatrixFixture, setSelectedMatrixFixture] = useState(null)
  const [selectedQuantFixture,  setSelectedQuantFixture]  = useState(null)
  const [isBacktestOpen, setIsBacktestOpen] = useState(false)
  const [settledFixtures, setSettledFixtures] = useState([])

  // PWA: capture native install prompt so Sidebar can offer "Install App"
  const [deferredInstall, setDeferredInstall] = useState(null)

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault()
      setDeferredInstall(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const debounceTimerRef = useRef(null)

  // Keep activeFeed in sync when user interacts with top-level toggles
  const handleFeedSelect = useCallback((feed) => {
    setActiveFeed(feed)
    if (feed === 'value')       { setValueOnly(true);            setShowWatchlistOnly(false) }
    else if (feed === 'watchlist') { setValueOnly(false); setShowWatchlistOnly(true)  }
    else                        { setValueOnly(false); setShowWatchlistOnly(false)  }
  }, [])

  const handleToggleValueOnly = useCallback(() => {
    setValueOnly((prev) => {
      const next = !prev
      setActiveFeed(next ? 'value' : 'all')
      setShowWatchlistOnly(false)
      return next
    })
  }, [])

  const handleToggleWatchlistFeed = useCallback(() => {
    setShowWatchlistOnly((prev) => {
      const next = !prev
      setActiveFeed(next ? 'watchlist' : 'all')
      setValueOnly(false)
      return next
    })
  }, [])

  // Watchlist toggle per-match star
  const handleToggleWatchlist = useCallback((fixtureId) => {
    setWatchlist((prev) => toggleWatchlistItem(prev, fixtureId))
  }, [])

  // Parlay-slip handlers
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
          if (row.id) map[String(row.id)] = row
          if (row.team_id) map[String(row.team_id)] = row
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

  // ---- Settled fixtures fetching (for performance backtest) ----
  const fetchSettledFixtures = useCallback(async () => {
    try {
      const { data, error: sbErr } = await supabase
        .from('fixtures')
        .select('*')
        .in('status', ['FT', 'FINISHED', 'AET', 'PEN'])
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .not('value_pick', 'is', null)
        .order('match_date', { ascending: true })

      if (!sbErr && data) setSettledFixtures(data)
    } catch (err) {
      console.warn('Failed to load settled fixtures for backtest:', err)
    }
  }, [])

  useEffect(() => {
    fetchFixtures()
    fetchStandings()
    fetchSettledFixtures()
  }, [fetchFixtures, fetchStandings, fetchSettledFixtures])

  // ---- Supabase Realtime Subscription -----------------------
  useEffect(() => {
    const channel = supabase
      .channel('matchlytics-realtime-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fixtures' },
        () => {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = setTimeout(() => {
            fetchFixtures(true)
            fetchStandings()
            fetchSettledFixtures()
            setRealtimeToast(true)
            setTimeout(() => setRealtimeToast(false), 3500)
          }, 1500)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_standings' },
        () => {
          fetchStandings()
        }
      )
      .subscribe()

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      supabase.removeChannel(channel)
    }
  }, [fetchFixtures])

  // ---- Client-side Multi-Criteria Filtering & Sorting -------
  const displayedFixtures = useMemo(() => {
    let result = fixtures

    if (showWatchlistOnly) {
      result = result.filter((f) => watchlist.includes(f.id))
    } else if (activeLeague !== 'all') {
      result = result.filter((f) => f.league_id === activeLeague)
    }

    if (valueOnly) {
      result = result.filter((f) => Boolean(f.value_pick))
    }

    if (dateRange !== 'all') {
      result = result.filter((f) => isDateInRange(f.match_date, dateRange))
    }

    if (searchQuery.trim()) {
      result = result.filter((f) => matchesSearch(f, searchQuery))
    }

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

  const valueCount = fixtures.filter((f) => Boolean(f.value_pick)).length

  // Map activeFeed back to the three boolean toggles used by the rest of the app
  useEffect(() => {
    if (activeFeed === 'value') {
      setValueOnly(true)
      setShowWatchlistOnly(false)
    } else if (activeFeed === 'watchlist') {
      setValueOnly(false)
      setShowWatchlistOnly(true)
    } else {
      setValueOnly(false)
      setShowWatchlistOnly(false)
    }
  }, [activeFeed])

  const handleLeagueChangeFromSidebar = useCallback((id) => {
    setActiveLeague(id)
    setShowWatchlistOnly(false)
    setActiveFeed(id === 'all' ? 'all' : 'matches')
  }, [])

  const handleMobileTab = useCallback((tab) => {
    setActiveMobileTab(tab)
    if (tab === 'value')        { setValueOnly(true);  setShowWatchlistOnly(false) }
    else if (tab === 'watchlist') { setValueOnly(false); setShowWatchlistOnly(true)  }
    else                        { setValueOnly(false); setShowWatchlistOnly(false) }
  }, [])

  return (
    <div className="w-full min-h-screen bg-pitch-900 text-slate-100 flex overflow-x-hidden">
      {/* ─── Desktop Left Sidebar ────────────────────────────── */}
      <Sidebar
        activeFeed={activeFeed}
        onFeedSelect={handleFeedSelect}
        leagues={LEAGUES.filter((l) => l.id !== 'all')}
        activeLeague={activeLeague}
        onLeagueChange={handleLeagueChangeFromSidebar}
        valueCount={valueCount}
        watchlistCount={watchlist.length}
        lastUpdated={lastUpdated}
        deferredInstall={deferredInstall}
        onOpenBacktest={() => setIsBacktestOpen(true)}
      />

      {/* ─── Main Content Area ──────────────────────────────── */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 pb-20 lg:pb-8">
        {/* Mobile top brand bar (visible below lg) */}
        <div className="lg:hidden sticky top-0 z-20 bg-pitch-950/90 backdrop-blur-md border-b border-pitch-800 px-4 py-3 flex items-center gap-2.5">
          <span
            className="inline-block w-7 h-7 rounded-md bg-amber-500 flex-shrink-0"
            aria-hidden="true"
            style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
          />
          <h1 className="text-sm font-bold text-slate-100 tracking-tight">Matchlytics</h1>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            Live
          </span>
        </div>

        {/* Sticky glassmorphism Filter Bar */}
        <div className="sticky top-0 z-10 glass-filter">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3">
            <FilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              leagues={LEAGUES}   // passed through; hidden on desktop via CSS/media if needed
              activeLeague={activeLeague}
              onLeagueChange={(id) => {
                setActiveLeague(id)
                setShowWatchlistOnly(false)
              }}
              watchlistCount={watchlist.length}
              showWatchlistOnly={showWatchlistOnly}
              onToggleWatchlistTab={() => setShowWatchlistOnly((p) => !p)}
              valueOnly={valueOnly}
              onValueOnlyChange={(v) => {
                setValueOnly(v)
                if (v) setActiveFeed('value')
                else if (showWatchlistOnly) setActiveFeed('watchlist')
                else setActiveFeed('all')
              }}
              sortOption={sortOption}
              onSortChange={setSortOption}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </div>
        </div>

        {/* Realtime Toast Notification */}
        {realtimeToast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed top-20 right-3 sm:right-6 z-50 px-4 py-2.5 rounded-xl bg-pitch-900/95 border border-emerald-500/50 text-emerald-300 text-xs font-semibold shadow-2xl flex items-center gap-2.5 animate-slide-up backdrop-blur"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" aria-hidden="true" />
            <span>Data refreshed in real-time</span>
          </div>
        )}

        <main className="w-full px-2 sm:px-4 lg:px-6 py-2 min-w-0" id="main-content">
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
                  Showing{' '}
                  <strong className="text-amber-400 font-mono">
                    {displayedFixtures.length}
                  </strong>{' '}
                  {displayedFixtures.length === 1 ? 'fixture' : 'fixtures'}
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
                    Realtime Active
                  </span>
                  <span className="text-slate-500 hidden sm:inline font-mono">
                    Odds: The Odds API (Bet365 / Pinnacle)
                  </span>
                </div>
              </div>

              {/* View Mode: Detailed Cards */}
              {viewMode === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
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

        {/* Footer */}
        <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-8 border-t border-pitch-800/80 w-full mt-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>
              Matchlytics uses Poisson bivariate goal distribution modelling.
              Probabilities are quantitative estimates, not guarantees.
            </p>
            <p className="text-slate-600 font-mono">
              Bet Responsibly. 18+
            </p>
          </div>
        </footer>
      </div>

      {/* ─── Mobile Bottom Navigation Bar ─────────────────── */}
      <MobileNav
        activeTab={activeMobileTab}
        onTabChange={handleMobileTab}
        valueOnly={valueOnly}
        onToggleValueOnly={handleToggleValueOnly}
        watchlistCount={watchlist.length}
        slipCount={parlaySlip.length}
        onOpenLeagues={() => setIsLeagueDrawerOpen(true)}
        onOpenSlip={() => setIsSlipDrawerOpen(true)}
        onOpenBacktest={() => setIsBacktestOpen(true)}
      />

      {/* ─── Mobile League Sheet (below lg only) ─────────── */}
      <MobileLeagueDrawer
        leagues={LEAGUES.filter((l) => l.id !== 'all')}
        activeLeague={activeLeague}
        onSelect={handleLeagueChangeFromSidebar}
        isOpen={isLeagueDrawerOpen}
        onClose={() => setIsLeagueDrawerOpen(false)}
      />

      {/* ─── Modals & Drawers (always rendered) ───────────── */}
      <ScoreMatrixModal
        fixture={selectedMatrixFixture}
        isOpen={Boolean(selectedMatrixFixture)}
        onClose={() => setSelectedMatrixFixture(null)}
        standingsMap={standingsMap}
      />

      <KellyCalculatorModal
        fixture={selectedQuantFixture}
        isOpen={Boolean(selectedQuantFixture)}
        onClose={() => setSelectedQuantFixture(null)}
        onAddToSlip={handleToggleSlip}
        isInSlip={parlaySlip.some(
          (l) => l.fixtureId === selectedQuantFixture?.id
        )}
      />

      <ParlaySlipDrawer
        legs={parlaySlip}
        isOpen={isSlipDrawerOpen}
        onToggleOpen={() => setIsSlipDrawerOpen(!isSlipDrawerOpen)}
        onRemoveLeg={handleRemoveSlipLeg}
        onClearSlip={handleClearSlip}
      />

      {/* Historical Bankroll Simulator & Settled Bets Ledger */}
      <PerformanceModal
        isOpen={isBacktestOpen}
        onClose={() => setIsBacktestOpen(false)}
        fixtures={settledFixtures}
      />

      {/* PWA install prompt (mobile floating banner + iOS hint) */}
      <InstallPrompt />
    </div>
  )
}
