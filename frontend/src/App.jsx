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

import { useState, useEffect, useCallback, useMemo, useRef, Component, lazy, Suspense } from 'react'
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
import SubscriptionBanner from './components/SubscriptionBanner'
import WorkspaceNav from './components/WorkspaceNav'
import CommandPalette from './components/CommandPalette'
// Lazy loaded components for bundle splitting
const QuantLab = lazy(() => import('./components/QuantLab'))
const PortfolioTracker = lazy(() => import('./components/PortfolioTracker'))
const ModelLedger = lazy(() => import('./components/ModelLedger'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard'))
const AdminPanel = lazy(() => import('./components/AdminPanel'))
const UserProfile = lazy(() => import('./components/UserProfile'))
const DailyPicksModal = lazy(() => import('./components/DailyPicksModal'))
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
import { generateMockFixtures, generateMockSettledFixtures } from './utils/mockTelemetryData'

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
// All 12 Free Tier competitions from football-data.org.
// `id` is the football-data.org integer ID (used for display); `code` is the
// 2-4 letter competition code stored in fixtures.competition_code.
export const LEAGUES = [
  { id: 'all',      label: 'All Leagues', code: 'all' },
  { id: 2021,       label: 'Premier League', code: 'PL' },
  { id: 2014,       label: 'La Liga',        code: 'PD' },
  { id: 2019,       label: 'Serie A',        code: 'SA' },
  { id: 2002,       label: 'Bundesliga',     code: 'BL1' },
  { id: 2015,       label: 'Ligue 1',        code: 'FL1' },
  { id: 2001,       label: 'Champions League', code: 'CL' },
  { id: 2003,       label: 'Eredivisie',     code: 'DED' },
  { id: 2017,       label: 'Liga Portugal',  code: 'PPL' },
  { id: 2016,       label: 'Championship',   code: 'ELC' },
  { id: 2013,       label: 'Brasileirao',    code: 'BSA' },
  { id: 2000,       label: 'World Cup',      code: 'WC' },
  { id: 2018,       label: 'Euro',           code: 'EC' },
]

// Single window: now - 2h to now + 30 days
const buildDateRange = () => {
  const now = new Date()
  const from = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
  const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  return { from, to }
}

// Global Error Boundary to prevent blank-screen crashes from render errors
class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary] Render error:', error, info)
  }
  handleReset = () => this.setState({ hasError: false, error: null })
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-pitch-950 flex items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-md">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto text-xl font-bold">!</div>
            <h2 className="text-base font-bold text-slate-100">Something went wrong loading the app.</h2>
            <p className="text-xs text-slate-400 font-mono">{String(this.state.error?.message || 'Unknown error')}</p>
            <button type="button" onClick={this.handleReset} className="px-4 py-2.5 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-pitch-950 font-bold text-xs transition-colors">
              Reload App
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
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

  // Multi-workspace terminal state: 'terminal' | 'quant_lab' | 'portfolio' | 'ledger' | 'profile'
  const [activeWorkspace,     setActiveWorkspace]     = useState('terminal')
  const [isAdminView,         setIsAdminView]         = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [selectedLabFixture,  setSelectedLabFixture]  = useState(null)
  const [visibleCount,        setVisibleCount]        = useState(24)

  // Portfolio journal state (persisted in localStorage)
  const [portfolioPositions, setPortfolioPositions] = useState(() => {
    try {
      const saved = localStorage.getItem('matchlytics_portfolio_positions_v1')
      const parsed = saved ? JSON.parse(saved) : []
      return Array.isArray(parsed) ? parsed.filter(Boolean) : []
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

  // Daily Picks modal state
  const [isDailyPicksOpen, setIsDailyPicksOpen] = useState(false)
  const handleOpenDailyPicks = useCallback(() => setIsDailyPicksOpen(true), [])
  const handleCloseDailyPicks = useCallback(() => setIsDailyPicksOpen(false), [])
  useEffect(() => {
    if (!user || authLoading || !fixtures || fixtures.length === 0) return
    const todayKey = new Date().toISOString().split('T')[0]
    try {
      const dismissed = localStorage.getItem(`matchlytics_daily_picks_dismissed_${todayKey}`)
      if (!dismissed) setIsDailyPicksOpen(true)
    } catch {}
  }, [user, authLoading, fixtures])

  // Dedicated match deep route check: /match/:id or #/match/:id or ?match=:id
  useEffect(() => {
    if (typeof window === 'undefined' || !fixtures || fixtures.length === 0) return

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
      const found = (fixtures || []).find((f) => f && String(f.id) === String(matchId)) || null
      if (found) {
        setSelectedLabFixture(found)
        setActiveWorkspace('quant_lab')
      }
    }

    const handleLocationChange = () => {
      const updatedId = getTargetMatchId()
      if (updatedId) {
        const found = (fixtures || []).find((f) => f && String(f.id) === String(updatedId)) || null
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
    const valid = (fixtures || []).filter(Boolean)
    if (!selectedLabFixture && valid.length > 0) {
      const sortedByValue = [...valid]
        .filter((f) => Boolean(f?.value_pick))
        .sort((a, b) => (b?.ev_percentage || 0) - (a?.ev_percentage || 0))
      setSelectedLabFixture(sortedByValue[0] || valid[0] || null)
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

  // Profile view navigation
  const handleOpenProfile = useCallback(() => {
    setActiveWorkspace('profile')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleBackFromProfile = useCallback(() => {
    setActiveWorkspace('terminal')
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
      const valid = (fixtures || []).filter(Boolean)
      const sortedByValue = [...valid]
        .filter((f) => Boolean(f?.value_pick))
        .sort((a, b) => (b?.ev_percentage || 0) - (a?.ev_percentage || 0))
      setSelectedLabFixture(sortedByValue[0] || valid[0] || null)
    }
    setActiveWorkspace(ws)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [canAccessQuantFeatures, selectedLabFixture, fixtures, openUpgradeFor])

  // Admin guard: only whitelisted emails can open admin
  const handleOpenAdmin = useCallback(() => {
    const raw = import.meta.env.VITE_ADMIN_EMAILS || ''
    const emails = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
    if (emails.includes((user?.email || '').toLowerCase())) {
      setIsAdminView(true)
    }
  }, [user])

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

    if (import.meta.env.VITE_SUPABASE_URL?.includes('placeholder')) {
      const mock = generateMockFixtures(72)
      setFixtures(mock)
      setLastUpdated(new Date())
      if (!isSilent) setLoading(false)
      return
    }

    try {
      // Robust column-based foreign key syntax and kickoff_time ordering
      let { data, error: sbErr } = await supabase
        .from('fixtures')
        .select(`
          *,
          home_team:teams!home_team_id(id, name, short_name, crest_url, home_attack, home_defense, away_attack, away_defense),
          away_team:teams!away_team_id(id, name, short_name, crest_url, home_attack, home_defense, away_attack, away_defense)
        `)
        .in('status', UPCOMING_STATUSES)
        .order('kickoff_time', { ascending: true })

      if (sbErr) {
        console.error('[Supabase fetchFixtures error]:', sbErr)
        // Resilient fallback: plain select('*') ordered by kickoff_time
        const fallbackRes = await supabase
          .from('fixtures')
          .select('*')
          .in('status', UPCOMING_STATUSES)
          .order('kickoff_time', { ascending: true })

        if (fallbackRes.error) {
          console.error('[Supabase fetchFixtures fallback error]:', fallbackRes.error)
          // Unconstrained fallback: plain select without strict ordering
          const unconstrainedRes = await supabase
            .from('fixtures')
            .select('*')
            .limit(250)

          if (unconstrainedRes.error) {
            console.error('[Supabase fetchFixtures unconstrained error]:', unconstrainedRes.error)
            throw unconstrainedRes.error
          }
          data = unconstrainedRes.data
        } else {
          data = fallbackRes.data
        }
      }

      if (!data || data.length === 0) {
        data = generateMockFixtures(72)
      }
      setFixtures((data || []).filter(Boolean))
      setLastUpdated(new Date())

      if (isSilent) {
        setRealtimeToast(true)
        setTimeout(() => setRealtimeToast(false), 3500)
      }
    } catch (err) {
      console.warn('[Supabase fetchFixtures error - using fallback mock]:', err)
      const mock = generateMockFixtures(72)
      setFixtures(mock)
      setLastUpdated(new Date())
    } finally {
      if (!isSilent) setLoading(false)
    }
  }, [])

  // Data fetching: Settled historical fixtures with joined team metadata
  const fetchSettledFixtures = useCallback(async () => {
    if (import.meta.env.VITE_SUPABASE_URL?.includes('placeholder')) {
      setSettledFixtures(generateMockSettledFixtures(30))
      return
    }
    try {
      let { data, error: stErr } = await supabase
        .from('fixtures')
        .select(`
          *,
          home_team:teams!home_team_id(id, name, short_name, crest_url, home_attack, home_defense, away_attack, away_defense),
          away_team:teams!away_team_id(id, name, short_name, crest_url, home_attack, home_defense, away_attack, away_defense)
        `)
        .in('status', ['FT', 'FINISHED', 'AET', 'PEN'])
        .order('kickoff_time', { ascending: false })
        .limit(150)

      if (stErr) {
        console.error('[Supabase fetchSettledFixtures error]:', stErr)
        const fallbackRes = await supabase
          .from('fixtures')
          .select('*')
          .in('status', ['FT', 'FINISHED', 'AET', 'PEN'])
          .order('kickoff_time', { ascending: false })
          .limit(150)

        if (fallbackRes.error) {
          console.error('[Supabase fetchSettledFixtures fallback error]:', fallbackRes.error)
          const unconstrainedRes = await supabase
            .from('fixtures')
            .select('*')
            .in('status', ['FT', 'FINISHED', 'AET', 'PEN'])
            .limit(100)
          data = unconstrainedRes.data
        } else {
          data = fallbackRes.data
        }
      }

      if (!data || data.length === 0) {
        data = generateMockSettledFixtures(30)
      }
      setSettledFixtures((data || []).filter(Boolean))
    } catch (err) {
      console.warn('[Supabase fetchSettledFixtures fallback]:', err)
      setSettledFixtures(generateMockSettledFixtures(30))
    }
  }, [])

  useEffect(() => {
    fetchFixtures()
    fetchStandings()
    fetchSettledFixtures()
  }, [fetchFixtures, fetchStandings, fetchSettledFixtures])

  // Rational Portfolio Settlement: Auto-settle pending positions matching finished fixtures
  useEffect(() => {
    if (fixtures.length === 0 && settledFixtures.length === 0) return

    setPortfolioPositions((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev
      const allMatches = [...fixtures, ...settledFixtures]
      const matchMap = new Map()
      allMatches.forEach((m) => {
        if (m.id) matchMap.set(m.id, m)
      })

      let changed = false
      const next = prev.map((pos) => {
        if (pos.status !== 'PENDING') return pos
        const m = matchMap.get(pos.fixture_id || pos.fixtureId)
        if (!m || !['FT', 'FINISHED', 'AET', 'PEN'].includes(m.status)) return pos
        if (m.home_score == null || m.away_score == null) return pos

        const hScore = Number(m.home_score)
        const aScore = Number(m.away_score)
        const totalGoals = hScore + aScore
        const sel = String(pos.selection || pos.pick || pos.selectionLabel || '').toUpperCase()

        let status = 'LOST'
        if (sel === 'HOME' || (sel.startsWith('HOME') && !sel.includes('AWAY'))) {
          if (hScore > aScore) status = 'WON'
        } else if (sel === 'DRAW' || sel.includes('DRAW') || sel === 'X') {
          if (hScore === aScore) status = 'WON'
        } else if (sel === 'AWAY' || (sel.startsWith('AWAY') && !sel.includes('HOME'))) {
          if (aScore > hScore) status = 'WON'
        } else if (sel.includes('OVER')) {
          const line = sel.includes('1.5') ? 1.5 : sel.includes('3.5') ? 3.5 : 2.5
          if (totalGoals > line) status = 'WON'
        } else if (sel.includes('UNDER')) {
          const line = sel.includes('1.5') ? 1.5 : sel.includes('3.5') ? 3.5 : 2.5
          if (totalGoals < line) status = 'WON'
        }

        const rawOdds = Number(pos.odds ?? pos.marketOdds) || 1.0
        const cappedOdds = Math.min(250.0, Math.max(1.0, rawOdds))
        const stake = Number(pos.stake ?? pos.stakeAmount) || 0
        const payout = status === 'WON' ? Math.round(stake * cappedOdds) : 0

        changed = true
        return {
          ...pos,
          status,
          capped_odds: cappedOdds,
          payout,
          settledAt: new Date().toISOString(),
        }
      })

      return changed ? next : prev
    })
  }, [fixtures, settledFixtures])

  // Realtime subscription
  useEffect(() => {
    if (import.meta.env.VITE_SUPABASE_URL?.includes('placeholder')) return undefined
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
    let result = (fixtures || []).filter(Boolean)

    if (showWatchlistOnly) {
      result = result.filter((f) => f?.id && watchlist.includes(f.id))
    } else if (activeLeague !== 'all') {
      const code = LEAGUES.find((l) => l.id === activeLeague)?.code
      result = result.filter((f) => f?.competition_code === code)
    }

    // Market category and +EV edge filtering
    if (valueOnly) {
      if (selectedMarket === 'all') {
        result = result.filter(
          (f) => Boolean(f?.value_pick) || (Array.isArray(f?.ev_opportunities) && f.ev_opportunities.length > 0)
        )
      } else if (selectedMarket === 'h2h') {
        result = result.filter(
          (f) => Boolean(f?.value_pick) || f?.ev_opportunities?.some((o) => o?.market === 'h2h')
        )
      } else if (selectedMarket === 'totals') {
        result = result.filter(
          (f) => f?.ev_opportunities?.some((o) => o?.market === 'totals')
        )
      } else if (selectedMarket === 'spreads') {
        result = result.filter(
          (f) => f?.ev_opportunities?.some((o) => o?.market === 'spreads')
        )
      }
    } else {
      if (selectedMarket === 'totals') {
        result = result.filter(
          (f) => f?.market_odds?.totals || f?.ev_opportunities?.some((o) => o?.market === 'totals') || f?.prob_over_25 != null
        )
      } else if (selectedMarket === 'spreads') {
        result = result.filter(
          (f) => f?.market_odds?.spreads || f?.ev_opportunities?.some((o) => o?.market === 'spreads')
        )
      } else if (selectedMarket === 'h2h') {
        result = result.filter(
          (f) => f?.odds_home || f?.market_odds?.h2h || f?.value_pick
        )
      }
    }

    result = result.filter((f) => isDateInRange(f?.kickoff_time || f?.match_date, dateRange))

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

  const handleViewAllFixtures = useCallback(() => {
    setDateRange(canAccessMonthly ? 'all' : canAccessWeekly ? 'week' : 'today')
    setRangeTouched(true)
    setActiveLeague('all')
  }, [setDateRange, canAccessMonthly, canAccessWeekly])

  const currentLeagueLabel = LEAGUES.find((l) => l.id === activeLeague)?.label
  const currentDateRangeLabel = DATE_RANGES.find((r) => r.id === dateRange)?.label
  const valueCount = (fixtures || []).filter((f) => Boolean(f?.value_pick)).length

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
        fixtures={(settledFixtures || []).filter(Boolean)}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        fixtures={(fixtures || []).filter(Boolean)}
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

      <DailyPicksModal
        isOpen={isDailyPicksOpen}
        onClose={handleCloseDailyPicks}
        fixtures={(fixtures || []).filter(Boolean)}
        onAddToSlip={(leg) => {
          setParlaySlip(prev => {
            const exists = prev.some(l => l.fixtureId === leg.fixtureId && l.pick === leg.pick)
            if (exists) return prev.filter(l => !(l.fixtureId === leg.fixtureId && l.pick === leg.pick))
            const next = [...prev, leg]
            saveParlaySlip(next)
            return next
          })
        }}
        onOpenSlip={() => setIsSlipDrawerOpen(true)}
      />

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
          fixtures={(fixtures || []).filter(Boolean)}
          settledFixtures={(settledFixtures || []).filter(Boolean)}
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

  // Admin view (whitelisted emails only)
  if (isAdminView) {
    return (
      <div className="w-full min-h-screen bg-pitch-950 text-slate-100">
        <AdminPanel onBack={() => setIsAdminView(false)} />
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen bg-pitch-900 text-slate-100 flex overflow-x-hidden">
      {/* Desktop Left Sidebar (collapsible mini-rail) */}
      <Sidebar
        activeFeed={activeFeed}
        onFeedSelect={handleFeedSelect}
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
        onOpenAdmin={handleOpenAdmin}
        onOpenProfile={handleOpenProfile}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-16 flex flex-col min-w-0 pb-20 lg:pb-8">
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
            {/* Daily Alpha Slips trigger */}
            {!isAdminView && (
              <button
                type="button"
                onClick={handleOpenDailyPicks}
                className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold transition-colors min-h-[32px] flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                title="Open Daily Quant Intelligence"
              >
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                <span className="hidden sm:inline">Daily Alpha</span>
              </button>
            )}
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
                  onClick={() => { setActiveWorkspace('profile'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  title="User Profile & Settings"
                  className="min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center bg-pitch-800 hover:bg-amber-500/20 hover:border-amber-500/50 border border-pitch-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <span className="text-xs font-bold text-slate-300 hover:text-amber-400 w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500/30 to-amber-300/10 flex items-center justify-center">
                    {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                  </span>
                  <span className="sr-only">Open account settings</span>
                </button>
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

        {/* Subscription status banner */}
        <SubscriptionBanner />

        {/* Multi-Workspace Top Sub-Nav Switcher */}
        {activeWorkspace !== 'profile' && (
          <WorkspaceNav
            activeWorkspace={activeWorkspace}
            onWorkspaceChange={handleSelectWorkspace}
            onSelectWorkspace={handleSelectWorkspace}
            activeFixtureCount={fixtures.length}
            valueCount={valueCount}
            valueBetCount={valueCount}
            portfolioCount={portfolioPositions.length}
            selectedLabFixture={selectedLabFixture}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onOpenDailyPicks={handleOpenDailyPicks}
            tier={tier}
          />
        )}

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
                  onViewAllFixtures={handleViewAllFixtures}
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
            <Suspense fallback={<LoadingState />}>
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
            </Suspense>
          )}

          {/* Workspace 3: Bankroll & Bet Tracker */}
          {activeWorkspace === 'portfolio' && (
            <Suspense fallback={<LoadingState />}>
              <PortfolioTracker
                positions={portfolioPositions}
                bankroll={bankrollAmount}
                onUpdateBankroll={handleUpdateBankroll}
                onUpdateStatus={handleUpdatePositionStatus}
                onDeletePosition={handleDeletePosition}
                onAddPosition={handleAddManualPosition}
              />
            </Suspense>
          )}

          {/* Workspace 4: Track Record & Model Ledger */}
          {activeWorkspace === 'ledger' && (
            <Suspense fallback={<LoadingState />}>
              <ModelLedger
                settledFixtures={(settledFixtures || []).filter(Boolean)}
              />
            </Suspense>
          )}

          {/* Workspace 5: User Profile & Account Settings */}
          {activeWorkspace === 'profile' && (
            <Suspense fallback={<LoadingState />}>
              <UserProfile onBack={handleBackFromProfile} />
            </Suspense>
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
        onOpenAdmin={handleOpenAdmin}
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
      <AppErrorBoundary>
        <AppInner />
      </AppErrorBoundary>
    </AuthProvider>
  )
}
