// ---- FilterBar.jsx ----
// Compact sportsbook filter bar optimized for mobile.
// Mobile (< 640px): Single-row compact header with icon shortcuts.
// Desktop (>= 640px): Full tiered filter bar.
// Zero em dash characters (R-02 compliance).

import { useState } from 'react'

export const DATE_RANGES = [
  { id: 'today', label: 'Today', shortLabel: 'T' },
  { id: 'week',  label: '7 Days', shortLabel: '7D' },
  { id: 'all',   label: '30 Days', shortLabel: '30D' },
]

const TIER_ACCESS = {
  free:          ['today'],
  pro:           ['today', 'week'],
  annual:        ['today', 'week', 'all'],
  institutional: ['today', 'week', 'all'],
}

const UPGRADE_HINTS = {
  week: 'Upgrade to Pro to view weekly fixtures',
  all:  'Upgrade to Annual to view the full 30-day season',
}

export const MARKET_CATEGORIES = [
  { id: 'all',     label: 'All' },
  { id: 'h2h',     label: '1X2' },
  { id: 'totals',  label: 'O/U' },
  { id: 'spreads', label: 'AH' },
]

export const SORT_OPTIONS = [
  { id: 'kickoff_asc',    label: 'Time' },
  { id: 'ev_desc',        label: '+EV%' },
  { id: 'home_prob_desc', label: 'Home%' },
  { id: 'xg_total_desc',  label: 'xG' },
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
}) {
  const accessibleRanges = TIER_ACCESS[tier] || TIER_ACCESS.free
  const evLocked = !accessibleRanges.includes('week')
  const [showMobileFilters, setShowMobileFilters] = useState(false)

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

  // Mobile: Compact single-row header
  const renderMobileHeader = () => (
    <div className="flex items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-0">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          aria-label="Search fixtures"
          className="w-full pl-8 pr-7 py-1.5 min-h-[36px] rounded-lg bg-pitch-900 border border-pitch-700 text-xs text-slate-200 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 touch-manipulation"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-500 hover:text-slate-200 min-h-[36px]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Time Range Selector (dropdown-style on mobile) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="min-h-[36px] min-w-[36px] px-2 py-1 rounded-lg bg-pitch-900 border border-pitch-700 text-[11px] font-semibold text-slate-300 hover:text-slate-100 transition-colors flex items-center gap-1"
            aria-label="Filter options"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span className="hidden sm:inline">Filter</span>
          </button>
        </div>

        {/* View Mode */}
        <button
          type="button"
          onClick={() => onViewModeChange(viewMode === 'cards' ? 'table' : 'cards')}
          aria-label={viewMode === 'cards' ? 'Switch to table view' : 'Switch to card view'}
          className="min-h-[36px] min-w-[36px] px-2 py-1 rounded-lg bg-pitch-900 border border-pitch-700 text-slate-400 hover:text-slate-200 transition-colors"
        >
          {viewMode === 'cards' ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          )}
        </button>

        {/* Date Range Indicator (mobile only) */}
        <span className="text-[11px] font-mono text-slate-400 tabular-nums px-1 hidden sm:inline">
          {DATE_RANGES.find((r) => r.id === dateRange)?.shortLabel ?? ''}
        </span>

        {/* Fixture Count */}
        <span className="text-[11px] font-mono text-slate-500 tabular-nums">
          {activeFixtureCount}
        </span>
      </div>
    </div>
  )

  // Mobile expanded filter panel
  const renderMobileFilterPanel = () => {
    if (!showMobileFilters) return null

    return (
      <div className="mt-2 space-y-3 animate-fade-in">
        {/* Market Categories */}
        <div>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Market</p>
          <div className="flex gap-1.5 flex-wrap">
            {MARKET_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onMarketChange(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedMarket === cat.id
                    ? 'bg-amber-500 text-pitch-950'
                    : 'bg-pitch-900 text-slate-400 border border-pitch-700 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Time Range */}
        <div>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Time Range</p>
          <div className="flex gap-1.5 flex-wrap">
            {DATE_RANGES.map((r) => {
              const isActive = dateRange === r.id
              const isLocked = !accessibleRanges.includes(r.id)
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handlePillClick(r)}
                  disabled={isLocked}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all min-h-[36px] ${
                    isActive
                      ? 'bg-pitch-700 text-amber-300 border-amber-500/50'
                      : isLocked
                      ? 'bg-pitch-900 text-slate-600 border-pitch-800 cursor-not-allowed'
                      : 'bg-pitch-900 text-slate-400 border-pitch-700 hover:text-slate-200'
                  }`}
                >
                  {r.shortLabel}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sort Options */}
        <div>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Sort By</p>
          <div className="flex gap-1.5 flex-wrap">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSortChange(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all min-h-[36px] ${
                  sortOption === opt.id
                    ? 'bg-amber-500 text-pitch-950 border-amber-500'
                    : 'bg-pitch-900 text-slate-400 border-pitch-700 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Toggles */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleValueToggle}
            aria-pressed={valueOnly}
            className={`flex-1 min-h-[40px] px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-2 ${
              valueOnly && !evLocked
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-pitch-900 text-slate-400 border-pitch-700 hover:text-slate-200'
            }`}
          >
            <span>⚡</span>
            <span>+EV Only</span>
            {valueOnly && !evLocked && valueCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/30 text-[10px] font-mono font-bold">{valueCount}</span>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleWatchlistTab}
            aria-pressed={showWatchlistOnly}
            className={`flex-1 min-h-[40px] px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-2 ${
              showWatchlistOnly
                ? 'bg-amber-500 text-pitch-950 border-amber-500'
                : 'bg-pitch-900 text-slate-400 border-pitch-700 hover:text-slate-200'
            }`}
          >
            <span>★</span>
            <span>Watchlist</span>
            {watchlistCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-pitch-950 text-amber-300">{watchlistCount}</span>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Mobile: Compact single-row header */}
      <div className="sm:hidden">
        {renderMobileHeader()}
        {renderMobileFilterPanel()}
      </div>

      {/* Desktop: Full tiered filter bar */}
      <div className="hidden sm:block space-y-1.5">
        {/* ---- TIER 1: Compact Header Bar ---- */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Left: Search + Market Segmented Control */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Search */}
            <div className="relative flex-1 max-w-[220px] sm:max-w-[280px]">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search..."
                aria-label="Search fixtures"
                className="w-full pl-8 pr-7 py-1 min-h-[32px] rounded-lg bg-pitch-900 border border-pitch-700 text-xs text-slate-200 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 touch-manipulation"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search"
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-500 hover:text-slate-200 min-h-[32px]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Market Segmented Control */}
            <div className="inline-flex rounded-lg bg-pitch-900 border border-pitch-700 p-0.5 flex-shrink-0" role="group" aria-label="Market category">
              {MARKET_CATEGORIES.map((cat) => {
                const isActive = selectedMarket === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onMarketChange(cat.id)}
                    aria-pressed={isActive}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
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

          {/* Center: Time Filter Pills */}
          <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-start mt-1 sm:mt-0" role="group" aria-label="Time range">
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
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                    isActive
                      ? 'bg-pitch-700 text-amber-300 border-amber-500/50'
                      : isLocked
                      ? 'bg-pitch-900 text-slate-600 border-pitch-800 cursor-not-allowed'
                      : 'bg-pitch-900 text-slate-400 border-pitch-700 hover:text-slate-200 hover:border-pitch-600'
                  }`}
                >
                  {isLocked && <span className="mr-0.5 text-[9px]">&#x1F512;</span>}
                  {r.shortLabel}
                </button>
              )
            })}
          </div>

          {/* Right: +EV Toggle + Watchlist + View Mode + Count */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* +EV Toggle */}
            <button
              type="button"
              onClick={handleValueToggle}
              aria-pressed={valueOnly}
              title={evLocked ? 'Pro feature' : undefined}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                valueOnly && !evLocked
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-pitch-900 text-slate-500 border-pitch-700 hover:text-slate-300'
              }`}
            >
              <span className="text-[10px]">{valueOnly && !evLocked ? '&#x26A1;' : evLocked ? '&#x1F512;' : '·'}</span>
              <span className="hidden sm:inline">+EV</span>
              {valueOnly && !evLocked && valueCount > 0 && (
                <span className="px-1 py-0.5 rounded bg-emerald-500/30 text-[10px] font-mono font-bold">{valueCount}</span>
              )}
            </button>

            {/* Watchlist */}
            <button
              type="button"
              onClick={onToggleWatchlistTab}
              aria-pressed={showWatchlistOnly}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                showWatchlistOnly
                  ? 'bg-amber-500 text-pitch-950 border-amber-500'
                  : 'bg-pitch-900 text-slate-400 border-pitch-700 hover:text-slate-200'
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
              {watchlistCount > 0 && (
                <span className="px-1 py-0.5 rounded-full text-[10px] font-mono font-bold bg-pitch-950 text-amber-300">{watchlistCount}</span>
              )}
            </button>

            {/* View Mode Toggle */}
            <div className="inline-flex rounded-lg bg-pitch-900 border border-pitch-700 p-0.5" role="group" aria-label="View mode">
              {['cards', 'table'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onViewModeChange(mode)}
                  aria-pressed={viewMode === mode}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all ${
                    viewMode === mode
                      ? 'bg-amber-500 text-pitch-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode === 'cards' ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* Fixture count */}
            <span className="text-[11px] font-mono text-slate-500 tabular-nums whitespace-nowrap">
              {activeFixtureCount}
            </span>
          </div>
        </div>

        {/* ---- TIER 2: League Pill Rail with fade masks ---- */}
        <div className="relative py-1">
          {/* Left fade mask */}
          <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-pitch-950 to-transparent pointer-events-none z-10" />
          {/* Right fade mask */}
          <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-pitch-950 to-transparent pointer-events-none z-10" />

          <div
            className="flex items-center gap-1 overflow-x-auto no-scrollbar touch-pan-x"
            role="navigation"
            aria-label="Filter by league"
          >
            {leagues.map((league) => {
              const isActive = activeLeague === league.id
              return (
                <button
                  key={league.id}
                  type="button"
                  onClick={() => onLeagueChange(league.id)}
                  aria-pressed={isActive}
                  className={`flex-shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all ${
                    isActive
                      ? 'bg-amber-500 text-pitch-950 border-amber-500 font-bold'
                      : 'bg-pitch-900 text-slate-400 border-pitch-700 hover:text-slate-200 hover:border-pitch-600'
                  }`}
                >
                  {league.code || league.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
