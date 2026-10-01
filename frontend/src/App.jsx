// ---- App.jsx ----
// Multi-Workspace Quantitative Sports Terminal
// Workspace Decomposition:
// - Workspace 1: ◈ Terminal / Scanner (Feed, +EV discrepancy radar, league filters, search)
// - Workspace 2: ⚅ Quant Lab (Single match deep-dive: 6x6 Bivariate Poisson matrix, 10,000-iteration Monte Carlo, reverse odds)
// - Workspace 3: ⊞ Bankroll & Bet Tracker (Portfolio journal, P&L, ROI, Quarter-Kelly sizing, local persistence)
// - Workspace 4: 📈 Track Record & Model Ledger (Settled history, equity curve, Brier calibration)
//
// Desktop Left Sidebar (lg+) & Mobile Top Brand Bar & Sticky Workspace Nav
// Zero em dash characters used (R-02 compliance)

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './lib/supabase'
import Header from './components/Header'
import FilterBar, { DATE_RANGES } from './components/FilterBar'
import MatchCard from './components/MatchCard'
import CompactTableView from './components/CompactTableView'
import TableView from './components/TableView'
import TerminalScanner from './components/TerminalScanner'
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
import LandingPage from './components/LandingPage'
import LoginPage from './components/LoginPage'
import SubscriptionModal from './components/SubscriptionModal'
import WorkspaceNav from './components/WorkspaceNav'
import CommandPalette from './components/CommandPalette'
import QuantLab from './components/QuantLab'
import PortfolioTracker from './components/PortfolioTracker'
import ModelLedger from './components/ModelLedger'
import { AuthProvider, useAuth } from './context/AuthContext'
import {
  isDateInRange,
  matchesSearch,
  sortFixtures,
  getWatchlist,
  toggleWatchlistItem,
  getParlaySlip,
  saveParlaySlip,
} from './utils/analytics'

// ---- Dual-domain routing --------------------------------------
// The same SPA ships to two domains:
//   imortifex.me        : landing surface (product showcase)
//   app.imortifex.me    : live terminal dashboard
// Query param (?view=) and hash (#/) overrides take precedence.
const getInitialView = () => {
  const hostname = window.location.hostname
  const searchParams = new URLSearchParams(window.location.search)
  if (searchParams.get('view') === 'app' || window.location.hash === '#/app') return 'dashboard'
  if (searchParams.get('view') === 'landing' || window.location.hash === '#/') return 'landing'
  if (hostname.startsWith('app.') || hostname.startsWith('tips.')) return 'dashboard'
  return 'landing'
}

// ---- League metadata ------------------------------------------
export const LEAGUES = [
  { id: 'all', label: 'All Leagues' },
  { id: 2021,  label: 'Premier League' },
  { id: 2014,  label: 'La Liga' },
  { id: 2019,  label: 'Serie A' },
  { id: 2002,  label: 'Bundesliga' },
  { id: 2015,  label: 'Ligue 1' },
  { id: 2001,  label: 'Champions League' },
]

// Single window: now - 2h to now + 30 days
const buildDateRange = () => {
  const now = new Date()
  const from = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
  const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  return { from, to }
}

const UPCOMING_STATUSES = ['NS', 'SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED']

function AppInner() {
  const [currentView, setCurrentView] = useState(getInitialView)

  const {
    user, profile, loading: authLoading, signOut,
    tier, canAccessWeekly, canAccessMonthly, canAccessQuantFeatures,
  } = useAuth()

  const [fixtures,            setFixtures]            = useState([])
  const [standingsMap,        setStandingsMap]        = useState({})
  const [loading,             setLoading]             = useState(true)
  const [error,               setError]               = useState(null)
  const [lastUpdated,         setLastUpdated]         = useState(null)
  const [realtimeToast,       setRealtimeToast]       = useState(false)

  // Multi-workspace terminal state: 'terminal' | 'quant_lab' | 'portfolio' | 'ledger'
  const [activeWorkspace,     setActiveWorkspace]     = useState('terminal')
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [selectedLabFixture,  setSelectedLabFixture]  = useState(null)
  const [visibleCount,        setVisibleCount]        = useState(24)

  // Portfolio journal state (persisted in localStorage)
  const [portfolioPositions, setPortfolioPositions] = useState(() => {
    try {
      const saved = localStorage.getItem('matchlytics_portfolio_positions_v1')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [bankrollAmount, setBankrollAmount] = useState(() => {
    try {
      const saved = localStorage.getItem('matchlytics_bankroll_amount_v1')
      return saved ? Number(saved) : 1000000
    } catch {
      return 1000000
    }
  })

  const [portfolioToast, setPortfolioToast] = useState(null)

  // Navigation state for scanner
  const [activeFeed,          setActiveFeed]          = useState('all')
  const [activeLeague,        setActiveLeague]        = useState('all')
  const [selectedMarket,      setSelectedMarket]      = useState('all')
  const [showWatchlistOnly,   setShowWatchlistOnly]   = useState(false)
  const [valueOnly,           setValueOnly]           = useState(false)
  const [dateRange,           setDateRangeState]      = useState('all')
  const [rangeTouched,        setRangeTouched]        = useState(false)
  const setDateRange = useCallback((id) => {
    setRangeTouched(true)
    setDateRangeState(id)
  }, [])
  const [searchQuery,         setSearchQuery]         = useState('')
  const [sortOption,          setSortOption]          = useState('kickoff_asc')
  const [viewMode,            setViewMode]            = useState('table')

  const [showUpgradeModal,    setShowUpgradeModal]    = useState(false)

  // Clamping horizon based on tier
  const RANK = { today: 0, week: 1, all: 2 }
  useEffect(() => {
    if (authLoading) return
    const maxRange = canAccessMonthly ? 'all' : canAccessWeekly ? 'week' : 'today'
    if (RANK[dateRange] > RANK[maxRange]) {
      setDateRangeState(maxRange)
      return
    }
    if (!rangeTouched) setDateRangeState(maxRange)
  }, [tier, canAccessMonthly, canAccessWeekly, authLoading])

  // Mobile sheet states
  const [isLeagueDrawerOpen,  setIsLeagueDrawerOpen]  = useState(false)
  const [activeMobileTab,     setActiveMobileTab]     = useState('matches')

  // Persistence-backed lists
  const [watchlist,           setWatchlist]           = useState(() => getWatchlist())
  const [parlaySlip,          setParlaySlip]          = useState(() => getParlaySlip())
  const [isSlipDrawerOpen,    setIsSlipDrawerOpen]    = useState(false)

  // Modal fixtures
  const [selectedMatrixFixture, setSelectedMatrixFixture] = useState(null)
  const [selectedQuantFixture,  setSelectedQuantFixture]  = useState(null)
  const [isBacktestOpen,        setIsBacktestOpen]        = useState(false)
  const [settledFixtures,       setSettledFixtures]       = useState([])

  const [deferredInstall,       setDeferredInstall]       = useState(null)

  // Dedicated match deep route check: /match/:id or #/match/:id or ?match=:id
  useEffect(() => {
    if (typeof window === 'undefined' || fixtures.length === 0) return

    const getTargetMatchId = () => {
      const hash = window.location.hash
      const hashMatch = hash.match(/#\/match\/([a-zA-Z0-9_-]+)/)
      if (hashMatch) return hashMatch[1]

      const pathname = window.location.pathname
      const pathMatch = pathname.match(/\/match\/([a-zA-Z0-9_-]+)/)
      if (pathMatch) return pathMatch[1]

      const searchParams = new URLSearchParams(window.location.search)
      return searchParams.get('match') || null
    }

    const matchId = getTargetMatchId()
    if (matchId) {
      const found = fixtures.find((f) => String(f.id) === String(matchId))
      if (found) {
        setSelectedLabFixture(found)
        setActiveWorkspace('quant_lab')
      }
    }

    const handleLocationChange = () => {
      const updatedId = getTargetMatchId()
      if (updatedId) {
        const found = fixtures.find((f) => String(f.id) === String(updatedId))
        if (found) {
          setSelectedLabFixture(found)
          setActiveWorkspace('quant_lab')
        }
      }
    }

    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener('hashchange', handleLocationChange)
    return () => {
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener('hashchange', handleLocationChange)
    }
  }, [fixtures])

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault()
      setDeferredInstall(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  // Persist portfolio positions
  useEffect(() => {
    try {
      localStorage.setItem('matchlytics_portfolio_positions_v1', JSON.stringify(portfolioPositions))
    } catch (err) {
      console.warn('Failed to persist portfolio positions:', err)
    }
  }, [portfolioPositions])

  // Persist bankroll amount
  useEffect(() => {
    try {
      localStorage.setItem('matchlytics_bankroll_amount_v1', String(bankrollAmount))
    } catch (err) {
      console.warn('Failed to persist bankroll amount:', err)
    }
  }, [bankrollAmount])

  // Global Command Palette shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen((prev) => !prev)
      }
    }
    const handleOpenPaletteEvent = () => setIsCommandPaletteOpen(true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('open-command-palette', handleOpenPaletteEvent)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('open-command-palette', handleOpenPaletteEvent)
    }
  }, [])

  // Reset pagination visible count on filter changes
  useEffect(() => {
    setVisibleCount(24)
  }, [activeLeague, dateRange, searchQuery, valueOnly, showWatchlistOnly])

  // Auto-select initial fixture for Quant Lab prioritizing highest +EV match
  useEffect(() => {
    if (!selectedLabFixture && fixtures.length > 0) {
      const sortedByValue = [...fixtures]
        .filter((f) => Boolean(f.value_pick))
        .sort((a, b) => (b.ev_percentage || 0) - (a.ev_percentage || 0))
      setSelectedLabFixture(sortedByValue[0] || fixtures[0])
    }
  }, [fixtures, selectedLabFixture])

  const debounceTimerRef = useRef(null)

  // Navigation handlers
  const handleFeedSelect = useCallback((feed) => {
    setActiveFeed(feed)
    if (feed === 'value')       { setValueOnly(true);  setShowWatchlistOnly(false) }
    else if (feed === 'watchlist') { setValueOnly(false); setShowWatchlistOnly(true)  }
    else                        { setValueOnly(false); setShowWatchlistOnly(false) }
  }, [])

  const handleToggleValueOnly = useCallback(() => {
    setValueOnly((prev) => {
      const next = !prev
      setActiveFeed(next ? 'value' : 'all')
      setShowWatchlistOnly(false)
      return next
    })
  }, [])

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

  // Portfolio logging handlers
  const handleLogPosition = useCallback((positionData) => {
    const newPosition = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      status: 'PENDING',
      loggedAt: new Date().toISOString(),
      ...positionData,
    }
    setPortfolioPositions((prev) => [newPosition, ...prev])
    setPortfolioToast({
      message: `Logged ${newPosition.selectionName || newPosition.pick} to Portfolio!`,
      type: 'success',
    })
    setTimeout(() => setPortfolioToast(null), 3200)
  }, [])

  const handleUpdatePositionStatus = useCallback((positionId, newStatus) => {
    setPortfolioPositions((prev) =>
      prev.map((pos) => (pos.id === positionId ? { ...pos, status: newStatus } : pos))
    )
  }, [])

  const handleDeletePosition = useCallback((positionId) => {
    setPortfolioPositions((prev) => prev.filter((pos) => pos.id !== positionId))
  }, [])

  const handleAddManualPosition = useCallback((newPos) => {
    setPortfolioPositions((prev) => [newPos, ...prev])
  }, [])

  const handleUpdateBankroll = useCallback((newBankroll) => {
    setBankrollAmount(newBankroll)
  }, [])

  // Soft upgrade trigger
  const openUpgradeFor = useCallback((reason) => {
    console.info('Upgrade prompt:', reason || 'tier lock')
    setShowUpgradeModal(true)
  }, [])

  // Quant Lab navigation action
  const handleSelectForLab = useCallback((fixture) => {
    if (!canAccessQuantFeatures) {
      openUpgradeFor('Quant Lab deep-dive requires a Pro pass')
      return
    }
    setSelectedLabFixture(fixture)
    setActiveWorkspace('quant_lab')
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState(null, '', `#/match/${fixture.id}`)
      } catch {
        // fallback
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [canAccessQuantFeatures, openUpgradeFor])

  const handleBackToScanner = useCallback(() => {
    setActiveWorkspace('terminal')
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState(null, '', `#/app`)
      } catch {
        // fallback
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Centralized workspace switcher with auto-selection
  const handleSelectWorkspace = useCallback((ws) => {
    if ((ws === 'quant_lab' || ws === 'portfolio') && !canAccessQuantFeatures) {
      openUpgradeFor(`${ws === 'quant_lab' ? 'Quant Lab' : 'Portfolio Tracker'} requires a Pro pass`)
      return
    }
    if (ws === 'quant_lab' && !selectedLabFixture && fixtures.length > 0) {
      const sortedByValue = [...fixtures]
        .filter((f) => Boolean(f.value_pick))
        .sort((a, b) => (b.ev_percentage || 0) - (a.ev_percentage || 0))
      setSelectedLabFixture(sortedByValue[0] || fixtures[0])
    }
    setActiveWorkspace(ws)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [canAccessQuantFeatures, selectedLabFixture, fixtures, openUpgradeFor])

  // Data fetching: Standings
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

  // Data fetching: Fixtures
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
        .in('status', UPCOMING_STATUSES)
        .order('match_date', { ascending: true })

      if (sbErr) throw sbErr

      setFixtures(data || [])
      setLastUpdated(new Date())

      if (isSilent) {
        setRealtimeToast(true)
        setTimeout(() => setRealtimeToast(false), 3500)
      }
    } catch (err) {
      console.error('Error fetching fixtures:', err)
      setError('Unable to load upcoming fixtures. Verify Supabase connection.')
    } finally {
      if (!isSilent) setLoading(false)
    }
  }, [])

  // Data fetching: Settled historical fixtures
  const fetchSettledFixtures = useCallback(async () => {
    try {
      const { data, error: stErr } = await supabase
        .from('fixtures')
        .select('*')
        .in('status', ['FT', 'FINISHED', 'AET', 'PEN'])
        .order('match_date', { ascending: false })
        .limit(150)

      if (!stErr && data) {
        setSettledFixtures(data)
      }
    } catch (err) {
      console.warn('Settled fixtures query failed:', err)
    }
  }, [])

  useEffect(() => {
    fetchFixtures()
    fetchStandings()
    fetchSettledFixtures()
  }, [fetchFixtures, fetchStandings, fetchSettledFixtures])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('fixtures_realtime_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fixtures' },
        () => {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = setTimeout(() => {
            fetchFixtures(true)
            fetchSettledFixtures()
          }, 1500)
        }
      )
      .subscribe()

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      supabase.removeChannel(channel)
    }
  }, [fetchFixtures, fetchSettledFixtures])

  // Client-side filtering & sorting
  const displayedFixtures = useMemo(() => {
    let result = fixtures

    if (showWatchlistOnly) {
      result = result.filter((f) => watchlist.includes(f.id))
    } else if (activeLeague !== 'all') {
      result = result.filter((f) => f.league_id === activeLeague)
    }

    // Market category and +EV edge filtering
    if (valueOnly) {
      if (selectedMarket === 'all') {
        result = result.filter(
          (f) => Boolean(f.value_pick) || (Array.isArray(f.ev_opportunities) && f.ev_opportunities.length > 0)
        )
      } else if (selectedMarket === 'h2h') {
        result = result.filter(
          (f) => Boolean(f.value_pick) || f.ev_opportunities?.some((o) => o.market === 'h2h')
        )
      } else if (selectedMarket === 'totals') {
        result = result.filter(
          (f) => f.ev_opportunities?.some((o) => o.market === 'totals')
        )
      } else if (selectedMarket === 'spreads') {
        result = result.filter(
          (f) => f.ev_opportunities?.some((o) => o.market === 'spreads')
        )
      }
    } else {
      if (selectedMarket === 'totals') {
        result = result.filter(
          (f) => f.market_odds?.totals || f.ev_opportunities?.some((o) => o.market === 'totals') || f.prob_over_25 != null
        )
      } else if (selectedMarket === 'spreads') {
        result = result.filter(
          (f) => f.market_odds?.spreads || f.ev_opportunities?.some((o) => o.market === 'spreads')
        )
      } else if (selectedMarket === 'h2h') {
        result = result.filter(
          (f) => f.odds_home || f.market_odds?.h2h || f.value_pick
        )
      }
    }

    result = result.filter((f) => isDateInRange(f.match_date, dateRange))

    if (searchQuery.trim()) {
      result = result.filter((f) => matchesSearch(f, searchQuery))
    }

    return sortFixtures(result, sortOption)
  }, [fixtures, activeLeague, showWatchlistOnly, watchlist, valueOnly, selectedMarket, dateRange, searchQuery, sortOption])

  // Slice-based pagination for smooth 60 FPS rendering
  const paginatedFixtures = useMemo(() => {
    return displayedFixtures.slice(0, visibleCount)
  }, [displayedFixtures, visibleCount])

  const handleClearFilters = useCallback(() => {
    setActiveLeague('all')
    setShowWatchlistOnly(false)
    setValueOnly(false)
    setSelectedMarket('all')
    setDateRange(canAccessMonthly ? 'all' : canAccessWeekly ? 'week' : 'today')
    setRangeTouched(true)
    setSearchQuery('')
    setSortOption('kickoff_asc')
  }, [setDateRange, canAccessMonthly, canAccessWeekly])

  const currentLeagueLabel = LEAGUES.find((l) => l.id === activeLeague)?.label
  const currentDateRangeLabel = DATE_RANGES.find((r) => r.id === dateRange)?.label
  const valueCount = fixtures.filter((f) => Boolean(f.value_pick)).length

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
    setActiveWorkspace('terminal')
  }, [])

  const handleMobileTab = useCallback((tab) => {
    setActiveMobileTab(tab)
    if (tab === 'value') {
      setValueOnly(true)
      setShowWatchlistOnly(false)
      setActiveWorkspace('terminal')
    } else if (tab === 'watchlist') {
      setValueOnly(false)
      setShowWatchlistOnly(true)
      setActiveWorkspace('terminal')
    } else if (tab === 'portfolio') {
      setActiveWorkspace('portfolio')
    } else if (tab === 'track') {
      setActiveWorkspace('ledger')
    } else {
      setValueOnly(false)
      setShowWatchlistOnly(false)
      setActiveWorkspace('terminal')
    }
  }, [])

  const syncUrlForView = useCallback((view) => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('view', view === 'dashboard' ? 'app' : 'landing')
      url.hash = ''
      window.history.replaceState(null, '', url.toString())
    } catch {
      // non-fatal
    }
  }, [])

  const handleEnterApp = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'imortifex.me') {
      window.location.assign('https://app.imortifex.me/')
      return
    }
    setCurrentView('dashboard')
    syncUrlForView('dashboard')
  }, [syncUrlForView])

  const handleEcosystemVisit = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'app.imortifex.me') {
      window.location.assign('https://imortifex.me/')
      return
    }
    setCurrentView('landing')
    syncUrlForView('landing')
  }, [syncUrlForView])

  const openMatrixGated = canAccessQuantFeatures
    ? (fixture) => setSelectedMatrixFixture(fixture)
    : () => openUpgradeFor('Score Matrix requires a Pro pass')
  const openQuantGated = canAccessQuantFeatures
    ? (fixture) => setSelectedQuantFixture(fixture)
    : () => openUpgradeFor('Quant and Kelly require a Pro pass')
  const toggleSlipGated = canAccessQuantFeatures
    ? handleToggleSlip
    : () => openUpgradeFor('Parlay Builder requires a Pro pass')

  useEffect(() => {
    if (canAccessQuantFeatures && showUpgradeModal) setShowUpgradeModal(false)
  }, [canAccessQuantFeatures, showUpgradeModal])

  // Modals and shared overlays
  const sharedOverlays = (
    <>
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
        onAddToSlip={toggleSlipGated}
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
        onLogPosition={handleLogPosition}
        userBankroll={bankrollAmount}
      />

      <PerformanceModal
        isOpen={isBacktestOpen}
        onClose={() => setIsBacktestOpen(false)}
        fixtures={settledFixtures}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        fixtures={fixtures}
        onSelectFixture={(f) => {
          handleSelectForLab(f)
        }}
        onSelectWorkspace={handleSelectWorkspace}
        onFilterLeague={(leagueId) => {
          setActiveLeague(leagueId)
          setShowWatchlistOnly(false)
          setActiveWorkspace('terminal')
        }}
        onClearFilters={handleClearFilters}
      />

      <InstallPrompt />

      {showUpgradeModal && (
        <SubscriptionModal onClose={() => setShowUpgradeModal(false)} />
      )}
    </>
  )

  // Landing view
  if (currentView === 'landing') {
    return (
      <div className="w-full min-h-screen bg-pitch-950 text-slate-100 overflow-x-hidden">
        <LandingPage
          onEnterApp={handleEnterApp}
          onOpenBacktest={() => setIsBacktestOpen(true)}
          fixtures={fixtures}
          settledFixtures={settledFixtures}
          fixturesLoading={loading}
          dataError={error}
          lastUpdated={lastUpdated}
        />
        {sharedOverlays}
      </div>
    )
  }

  // Dashboard view auth check
  if (authLoading) {
    return (
      <div className="w-full min-h-screen bg-pitch-950 flex items-center justify-center overflow-x-hidden">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <span
            className="inline-block w-9 h-9 rounded-lg border-2 border-pitch-700 border-t-amber-500 animate-spin"
            aria-hidden="true"
          />
          <p className="text-xs font-mono text-slate-500">Verifying session...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="w-full min-h-screen bg-pitch-950 text-slate-100 overflow-x-hidden">
        <LoginPage onBackToLanding={handleEcosystemVisit} />
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen bg-pitch-900 text-slate-100 flex overflow-x-hidden">
      {/* Desktop Left Sidebar */}
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
        onEcosystemVisit={handleEcosystemVisit}
        userEmail={user?.email}
        subscriptionTier={profile?.subscription_tier}
        onSignOut={signOut}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={handleSelectWorkspace}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 pb-20 lg:pb-8">
        {/* Mobile top brand bar */}
        <div className="lg:hidden sticky top-0 z-20 bg-pitch-950/90 backdrop-blur-md border-b border-pitch-800 px-4 py-3 flex items-center gap-2.5 pt-safe" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}>
          <span
            className="inline-block w-7 h-7 rounded-md bg-amber-500 flex-shrink-0"
            aria-hidden="true"
            style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-100 tracking-tight leading-none">Matchlytics</p>
            <p className="text-[9px] font-mono text-slate-500 mt-0.5">by imortifex</p>
          </div>
          <div className="ml-auto flex items-center gap-2 min-w-0">
            {user && (
              <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
                <p className="hidden sm:block text-[10px] font-mono text-slate-500 truncate max-w-[90px]">{user.email}</p>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold tracking-wider ${
                    profile?.subscription_tier === 'free'
                      ? 'bg-pitch-800 text-slate-500 border border-pitch-700'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {(profile?.subscription_tier || 'free').toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  title="Sign out of this device"
                  className="min-h-[32px] min-w-[32px] rounded-lg text-slate-500 hover:text-rose-400 hover:bg-pitch-900 transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span className="sr-only">Sign out</span>
                </button>
              </div>
            )}
            <a
              href="https://imortifex.me/"
              onClick={(e) => {
                if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                  e.preventDefault()
                  handleEcosystemVisit()
                }
              }}
              className="min-h-[36px] px-2.5 sm:px-3 rounded-lg border border-pitch-700 bg-pitch-900 text-[11px] font-mono text-slate-300 hover:text-slate-100 transition-colors flex items-center gap-1.5 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer"
              title="Open imortifex.me landing surface"
            >
              <span aria-hidden="true">🌐</span>
              <span className="hidden sm:inline">imortifex.me</span>
              <span className="sr-only">Open imortifex.me landing surface</span>
            </a>
          </div>
        </div>

        {/* Multi-Workspace Top Sub-Nav Switcher */}
        <WorkspaceNav
          activeWorkspace={activeWorkspace}
          onWorkspaceChange={handleSelectWorkspace}
          onSelectWorkspace={handleSelectWorkspace}
          activeFixtureCount={displayedFixtures.length}
          valueCount={valueCount}
          valueBetCount={valueCount}
          portfolioCount={portfolioPositions.length}
          selectedLabFixture={selectedLabFixture}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          tier={tier}
        />

        {/* Realtime Toast Notification */}
        {realtimeToast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed top-24 right-3 sm:right-6 z-50 px-4 py-2.5 rounded-xl bg-pitch-900/95 border border-emerald-500/50 text-emerald-300 text-xs font-semibold shadow-2xl flex items-center gap-2.5 animate-slide-up backdrop-blur"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" aria-hidden="true" />
            <span>Data refreshed in real-time</span>
          </div>
        )}

        {/* Portfolio Toast Notification */}
        {portfolioToast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed top-24 right-3 sm:right-6 z-50 px-4 py-2.5 rounded-xl bg-pitch-900/95 border border-emerald-500/50 text-emerald-300 text-xs font-semibold shadow-2xl flex items-center gap-2.5 animate-slide-up backdrop-blur"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
            <span>{portfolioToast.message}</span>
          </div>
        )}

        {/* Main Workspace Body */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-3 min-w-0 pb-28 md:pb-8" id="main-content">
          {/* Workspace 1: Terminal / Scanner */}
          {activeWorkspace === 'terminal' && (
            <div className="space-y-4">
              {/* Sticky glassmorphism Filter Bar */}
              <div className="sticky top-14 sm:top-16 z-30 backdrop-blur-md bg-pitch-950/90 border-b border-pitch-800 -mx-4 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-2 sm:py-3 transition-all">
                <div className="max-w-7xl mx-auto">
                  <FilterBar
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    selectedMarket={selectedMarket}
                    onMarketChange={setSelectedMarket}
                    leagues={LEAGUES}
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
                    tier={tier}
                    onTriggerUpgrade={openUpgradeFor}
                  />
                </div>
              </div>

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
                <TerminalScanner
                  fixtures={paginatedFixtures}
                  allFixturesCount={displayedFixtures.length}
                  currentLeagueLabel={currentLeagueLabel}
                  currentDateRangeLabel={currentDateRangeLabel}
                  showWatchlistOnly={showWatchlistOnly}
                  activeLeague={activeLeague}
                  dateRange={dateRange}
                  watchlist={watchlist}
                  onToggleWatchlist={handleToggleWatchlist}
                  onOpenMatrix={openMatrixGated}
                  onOpenQuantModal={openQuantGated}
                  onSelectForLab={handleSelectForLab}
                  onLogPosition={handleLogPosition}
                  slipLegs={parlaySlip}
                  onToggleSlip={toggleSlipGated}
                  standingsMap={standingsMap}
                  quantLocked={!canAccessQuantFeatures}
                  onTriggerUpgrade={openUpgradeFor}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  visibleCount={visibleCount}
                  totalCount={displayedFixtures.length}
                  onLoadMore={() => setVisibleCount((prev) => prev + 24)}
                />
              )}
            </div>
          )}

          {/* Workspace 2: Quant Lab (Single Match Deep-Dive) */}
          {activeWorkspace === 'quant_lab' && (
            <QuantLab
              fixture={selectedLabFixture}
              selectedFixture={selectedLabFixture}
              allFixtures={fixtures}
              fixtures={fixtures}
              onSelectFixture={setSelectedLabFixture}
              standingsMap={standingsMap}
              onLogPosition={handleLogPosition}
              userBankroll={bankrollAmount}
              bankrollAmount={bankrollAmount}
              onBackToScanner={handleBackToScanner}
            />
          )}

          {/* Workspace 3: Bankroll & Bet Tracker */}
          {activeWorkspace === 'portfolio' && (
            <PortfolioTracker
              positions={portfolioPositions}
              bankroll={bankrollAmount}
              onUpdateBankroll={handleUpdateBankroll}
              onUpdateStatus={handleUpdatePositionStatus}
              onDeletePosition={handleDeletePosition}
              onAddPosition={handleAddManualPosition}
            />
          )}

          {/* Workspace 4: Track Record & Model Ledger */}
          {activeWorkspace === 'ledger' && (
            <ModelLedger
              settledFixtures={settledFixtures}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-8 border-t border-pitch-800/80 w-full mt-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>
              Matchlytics uses Proprietary Bivariate Poisson core distribution modelling.
              Probabilities are quantitative estimates, not guarantees.
            </p>
            <p className="text-slate-600 font-mono">
              Bet Responsibly. 18+
            </p>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav
        activeTab={activeMobileTab}
        onTabChange={handleMobileTab}
        valueOnly={valueOnly}
        onToggleValueOnly={handleToggleValueOnly}
        activeFixtureCount={displayedFixtures.length}
        valueCount={valueCount}
        portfolioCount={portfolioPositions.length}
        slipCount={parlaySlip.length}
        onOpenLeagues={() => setIsLeagueDrawerOpen(true)}
        onOpenSlip={() => setIsSlipDrawerOpen(true)}
        onOpenBacktest={() => setIsBacktestOpen(true)}
        onSelectWorkspace={handleSelectWorkspace}
      />

      {/* Mobile League Sheet */}
      <MobileLeagueDrawer
        leagues={LEAGUES.filter((l) => l.id !== 'all')}
        activeLeague={activeLeague}
        onSelect={handleLeagueChangeFromSidebar}
        isOpen={isLeagueDrawerOpen}
        onClose={() => setIsLeagueDrawerOpen(false)}
      />

      {/* Shared Modals and Overlays */}
      {sharedOverlays}
    </div>
  )
}

// Application Root with AuthProvider
export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
