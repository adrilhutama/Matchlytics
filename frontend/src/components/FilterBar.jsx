// ---- FilterBar.jsx ----
// Professional filter bar with chip system
// Tier 1: Search + Market + Time filters
// Tier 2: League pills with fade masks
// R-02 Compliant: Zero em dashes

import { useState, useRef, useEffect } from 'react'
import { Chip, LeagueChip } from './ui'

export const DATE_RANGES = [
  { id: 'today', label: 'Today', shortLabel: 'T' },
  { id: 'week', label: '7 Days', shortLabel: '7D' },
  { id: 'all', label: '30 Days', shortLabel: '30D' },
]

const TIER_ACCESS = {
  free: ['today'],
  pro: ['today', 'week'],
  annual: ['today', 'week', 'all'],
  institutional: ['today', 'week', 'all'],
}

const UPGRADE_HINTS = {
  week: 'Upgrade to Pro to view weekly fixtures',
  all: 'Upgrade to Annual to view the full 30-day season',
}

export const MARKET_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'h2h', label: '1X2' },
  { id: 'totals', label: 'O/U' },
  { id: 'spreads', label: 'AH' },
]

export const SORT_OPTIONS = [
  { id: 'kickoff_asc', label: 'Time' },
  { id: 'ev_desc', label: '+EV%' },
  { id: 'home_prob_desc', label: 'Home%' },
  { id: 'xg_total_desc', label: 'xG' },
]

export default function FilterBar({
  searchQuery,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  selectedMarket = 'all',
  onMarketChange = () => {},
  leagues = [],
  activeLeague,
  onLeagueChange,
  watchlistCount = 0,
  showWatchlistOnly = false,
  onToggleWatchlistTab,
  valueOnly = false,
  onValueOnlyChange,
  sortOption,
  onSortChange,
  viewMode = 'cards',
  onViewModeChange,
  tier = 'free',
  onTriggerUpgrade,
  activeFixtureCount = 0,
  valueCount = 0,
  lastSyncTime,
}) {
  const accessibleRanges = TIER_ACCESS[tier] || TIER_ACCESS.free
  const evLocked = !accessibleRanges.includes('week')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchRef = useRef(null)
  
  // Click outside to close search
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePillClick = (r) => {
    if (accessibleRanges.includes(r.id)) {
      onDateRangeChange(r.id)
      return
    }
    if (onTriggerUpgrade) onTriggerUpgrade(UPGRADE_HINTS[r.id])
  }

  const handleValueToggle = () => {
    if (evLocked) {
      if (onTriggerUpgrade) onTriggerUpgrade(UPGRADE_HINTS.week)
      return
    }
    onValueOnlyChange(!valueOnly)
  }

  return (
    <div className="space-y-2">
      {/* ---- TIER 1: Primary Controls ---- */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Left: Search + Market */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Search */}
          <div ref={searchRef} className="relative flex-1 max-w-[240px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search teams..."
              aria-label="Search fixtures"
              className="w-full pl-9 pr-8 py-2 rounded-lg bg-pitch-800 border border-pitch-700 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all min-h-[44px] sm:min-h-auto"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-200"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Market Segmented Control */}
          <div className="inline-flex rounded-lg bg-pitch-800 border border-pitch-700 p-0.5" role="group" aria-label="Market category">
            {MARKET_CATEGORIES.map((cat) => {
              const isActive = selectedMarket === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onMarketChange(cat.id)}
                  aria-pressed={isActive}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all min-h-[44px] sm:min-h-auto ${
                    isActive
                      ? 'bg-amber-500 text-pitch-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Center: Time Filter */}
        <div className="flex items-center gap-1" role="group" aria-label="Time range">
          {DATE_RANGES.map((r) => {
            const isActive = dateRange === r.id
            const isLocked = !accessibleRanges.includes(r.id)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => handlePillClick(r)}
                aria-pressed={isActive}
                title={isLocked ? UPGRADE_HINTS[r.id] : undefined}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all min-h-[44px] sm:min-h-auto ${
                  isActive
                    ? 'bg-pitch-700 text-amber-300 border-amber-500/50'
                    : isLocked
                    ? 'bg-pitch-900 text-slate-600 border-pitch-800 cursor-not-allowed'
                    : 'bg-pitch-800 text-slate-400 border-pitch-700 hover:text-slate-200 hover:border-pitch-600'
                }`}
              >
                {isLocked && <span className="mr-1 text-[9px]">&#x1F512;</span>}
                {r.shortLabel}
              </button>
            )
          })}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* +EV Toggle */}
          <button
            type="button"
            onClick={handleValueToggle}
            aria-pressed={valueOnly}
            title={evLocked ? 'Pro feature' : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all min-h-[44px] sm:min-h-auto ${
              valueOnly && !evLocked
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-pitch-800 text-slate-500 border-pitch-700 hover:text-slate-300'
            }`}
          >
            <span className="text-[10px]">{valueOnly && !evLocked ? '⚡' : evLocked ? '🔒' : '·'}</span>
            <span>+EV</span>
            {valueOnly && !evLocked && valueCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-[10px] font-mono font-bold">{valueCount}</span>
            )}
          </button>

          {/* Watchlist */}
          <button
            type="button"
            onClick={onToggleWatchlistTab}
            aria-pressed={showWatchlistOnly}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all min-h-[44px] sm:min-h-auto ${
              showWatchlistOnly
                ? 'bg-amber-500 text-pitch-950 border-amber-500'
                : 'bg-pitch-800 text-slate-400 border-pitch-700 hover:text-slate-200'
            }`}
          >
            <span>★</span>
            {watchlistCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-pitch-950 text-amber-300">{watchlistCount}</span>
            )}
          </button>

          {/* View Mode */}
          <div className="inline-flex rounded-lg bg-pitch-800 border border-pitch-700 p-0.5" role="group" aria-label="View mode">
            {['cards', 'table'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onViewModeChange(mode)}
                aria-pressed={viewMode === mode}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all min-h-[44px] sm:min-h-auto ${
                  viewMode === mode
                    ? 'bg-amber-500 text-pitch-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'cards' ? '⊞' : '☰'}
              </button>
            ))}
          </div>

          {/* Count */}
          <span className="text-xs font-mono text-slate-500 tabular-nums whitespace-nowrap">
            {activeFixtureCount}
          </span>
        </div>
      </div>

      {/* ---- TIER 2: League Rail ---- */}
      <div className="relative py-1">
        {/* Fade masks */}
        <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-pitch-950 to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-pitch-950 to-transparent pointer-events-none z-10" />

        <div
          className="flex items-center gap-1.5 overflow-x-auto scroll-hide touch-pan-x"
          role="navigation"
          aria-label="Filter by league"
        >
          <LeagueChip
            league={{ id: 'all', label: 'All Leagues', code: 'ALL' }}
            active={activeLeague === 'all'}
            onClick={() => onLeagueChange('all')}
            className="flex-shrink-0"
          />
          {leagues.filter((l) => l.id !== 'all' && l.code !== 'ALL' && l.code?.toLowerCase() !== 'all').map((league) => (
            <LeagueChip
              key={league.id}
              league={league}
              active={activeLeague === league.id}
              onClick={() => onLeagueChange(league.id)}
              className="flex-shrink-0"
            />
          ))}
        </div>
      </div>

      {/* ---- Active Filters Summary ---- */}
      {(activeLeague !== 'all' || valueOnly || showWatchlistOnly) && (
        <div className="flex items-center gap-2 flex-wrap py-1">
          <span className="text-[11px] text-slate-500">Active filters:</span>
          {activeLeague !== 'all' && (
            <Chip
              active
              removable
              onRemove={() => onLeagueChange('all')}
              className="text-[11px]"
            >
              {leagues.find(l => l.id === activeLeague)?.label || activeLeague}
            </Chip>
          )}
          {valueOnly && (
            <Chip
              active
              removable
              onRemove={() => onValueOnlyChange(false)}
              className="text-[11px] bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
            >
              +EV Only
            </Chip>
          )}
          {showWatchlistOnly && (
            <Chip
              active
              removable
              onRemove={() => onToggleWatchlistTab()}
              className="text-[11px] bg-amber-500/20 text-amber-300 border-amber-500/30"
            >
              Watchlist
            </Chip>
          )}
        </div>
      )}

      {/* Sync Info */}
      {lastSyncTime && (
        <div className="text-[10px] text-slate-600 font-mono">
          Last sync: {lastSyncTime}
        </div>
      )}
    </div>
  )
}
