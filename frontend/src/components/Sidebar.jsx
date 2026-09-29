// ---- Sidebar.jsx ----
// Desktop navigation rail (lg+): branding, feed filters, league list,
// and system status footer. Hidden on mobile where MobileNav takes over.

import { useEffect } from 'react'

const LEAGUES = [
  { id: 2021, label: 'Premier League' },
  { id: 2014, label: 'La Liga' },
  { id: 2019, label: 'Serie A' },
  { id: 2002, label: 'Bundesliga' },
  { id: 2015, label: 'Ligue 1' },
  { id: 2001, label: 'Champions League' },
]

export default function Sidebar({
  activeFeed,            // 'all' | 'value' | 'watchlist'
  onFeedSelect,
  leagues,
  activeLeague,
  onLeagueChange,
  valueCount,
  watchlistCount,
  lastUpdated,
  deferredInstall,
  onOpenBacktest,
  onEcosystemVisit,      // opens the imortifex.me landing surface
}) {
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : null

  const handleInstall = async () => {
    if (!deferredInstall) return
    deferredInstall.prompt()
    const { outcome } = await deferredInstall.userChoice
    console.log(`Install prompt outcome: ${outcome}`)
  }

  return (
    <aside
      className="hidden lg:flex lg:flex-col w-64 fixed inset-y-0 left-0 bg-pitch-950 border-r border-pitch-800 z-30 p-4 select-none"
      aria-label="Main navigation"
    >
      {/* ---- Branding Header ---- */}
      <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-pitch-800">
        <span
          className="inline-block w-8 h-8 rounded-md bg-amber-500 flex-shrink-0"
          aria-hidden="true"
          style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
        />
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-100 tracking-tight leading-none">
            Matchlytics
            <span className="ml-1.5 text-[10px] font-mono font-normal text-slate-500">by imortifex</span>
          </h1>
          <p className="text-[11px] text-slate-500 mt-1">Pre-Match Quant Analytics</p>
        </div>
      </div>

      {/* ---- Feeds Section ---- */}
      <nav aria-label="Feeds">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-2 mb-1.5">
          Feeds
        </p>
        <ul className="space-y-1 mb-4">
          <li>
            <button
              type="button"
              onClick={() => onFeedSelect('all')}
              aria-current={activeFeed === 'all' ? 'page' : undefined}
              className={`w-full min-h-[44px] px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-between gap-2 ${
                activeFeed === 'all'
                  ? 'bg-pitch-800 text-amber-400'
                  : 'text-slate-300 hover:bg-pitch-900 hover:text-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
                All Matches
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onFeedSelect('value')}
              aria-current={activeFeed === 'value' ? 'page' : undefined}
              className={`w-full min-h-[44px] px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-between gap-2 ${
                activeFeed === 'value'
                  ? 'bg-pitch-800 text-amber-400'
                  : 'text-slate-300 hover:bg-pitch-900 hover:text-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
                +EV Opportunities
              </span>
              {valueCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 tabular-nums">
                  {valueCount}
                </span>
              )}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => onFeedSelect('watchlist')}
              aria-current={activeFeed === 'watchlist' ? 'page' : undefined}
              className={`w-full min-h-[44px] px-3 rounded-xl text-sm font-medium transition-all flex items-center justify-between gap-2 ${
                activeFeed === 'watchlist'
                  ? 'bg-pitch-800 text-amber-400'
                  : 'text-slate-300 hover:bg-pitch-900 hover:text-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Watchlist
              </span>
              {watchlistCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 tabular-nums">
                  {watchlistCount}
                </span>
              )}
            </button>
          </li>
        </ul>
      </nav>

      {/* ---- Track Record / Backtest ---- */}
      <button
        type="button"
        onClick={onOpenBacktest}
        className="w-full min-h-[44px] px-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2.5 mb-4 text-slate-300 hover:bg-pitch-900 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        Track Record &amp; Backtest
      </button>

      {/* ---- Competitions Section ---- */}
      <nav aria-label="Competitions">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-2 mb-1.5">
          Competitions
        </p>
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              onClick={() => onLeagueChange('all')}
              aria-current={activeLeague === 'all' ? 'true' : undefined}
              className={`w-full min-h-[40px] px-3 rounded-lg text-xs font-medium transition-all ${
                activeLeague === 'all'
                  ? 'bg-pitch-800 text-slate-100'
                  : 'text-slate-400 hover:bg-pitch-900 hover:text-slate-200'
              }`}
            >
              All Leagues
            </button>
          </li>
          {leagues.map((league) => {
            const isActive = activeLeague === league.id
            return (
              <li key={league.id}>
                <button
                  type="button"
                  onClick={() => onLeagueChange(league.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`w-full min-h-[40px] px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-between gap-2 ${
                    isActive
                      ? 'bg-pitch-800 text-amber-400'
                      : 'text-slate-400 hover:bg-pitch-900 hover:text-slate-200'
                  }`}
                >
                  <span className="truncate">{league.label}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" aria-hidden="true" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ---- System Status Footer ---- */}
      <div className="mt-auto pt-4">
        <div className="rounded-xl bg-pitch-900 border border-pitch-800 p-3 space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-400">
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            Realtime Active
          </div>
          {timeStr && (
            <p className="text-[11px] text-slate-500 tabular-nums">
              Last sync: {timeStr}
            </p>
          )}
          <button
            type="button"
            onClick={onEcosystemVisit}
            className="w-full min-h-[36px] flex items-center gap-1.5 px-2 rounded-lg text-[11px] font-mono text-slate-400 hover:text-amber-300 hover:bg-pitch-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            title="Open the Matchlytics landing surface"
          >
            <span aria-hidden="true">🌐</span>
            <span className="truncate">imortifex.me · Landing</span>
          </button>
          <button
            type="button"
            id="sidebar-install-btn"
            onClick={handleInstall}
            className={`w-full mt-2 min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
              deferredInstall
                ? 'bg-pitch-800 hover:bg-pitch-700 text-slate-300 hover:text-slate-100 border-pitch-700 hover:border-pitch-600'
                : 'bg-transparent border-transparent text-transparent pointer-events-none'
            }`}
            style={{ visibility: deferredInstall ? 'visible' : 'hidden' }}
            aria-label="Install application"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Install App
          </button>
        </div>
      </div>
    </aside>
  )
}
