// ---- Sidebar.jsx ----
// Professional collapsible sidebar with improved UX
// Desktop: icon rail with hover expand
// Mobile: bottom navigation
// R-02 Compliant: Zero em dashes

import { useState } from 'react'

const WORKSPACES = [
  { id: 'terminal', label: 'Scanner', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  )},
  { id: 'quant_lab', label: 'Quant Lab', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  )},
  { id: 'portfolio', label: 'Portfolio', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  )},
  { id: 'ledger', label: 'Ledger', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )},
]

const FEEDS = [
  { id: 'all', label: 'All', icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  )},
  { id: 'value', label: '+EV', icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )},
  { id: 'watchlist', label: 'Stars', icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )},
]

const ADMIN_WORKSPACE = {
  id: 'admin',
  label: 'Admin',
  icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
}

export default function Sidebar({
  activeFeed,
  onFeedSelect,
  valueCount,
  watchlistCount,
  lastUpdated,
  deferredInstall,
  onOpenBacktest,
  onEcosystemVisit,
  userEmail,
  subscriptionTier,
  onSignOut,
  activeWorkspace = 'terminal',
  onSelectWorkspace,
  onOpenAdmin,
  onOpenProfile,
}) {
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : null

  const isTierLocked = !subscriptionTier || subscriptionTier === 'free' || subscriptionTier === 'inactive'

  const isAdmin = (() => {
    const raw = import.meta.env.VITE_ADMIN_EMAILS || ''
    const emails = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
    return emails.includes((userEmail || '').toLowerCase())
  })()

  const handleInstall = async () => {
    if (!deferredInstall) return
    deferredInstall.prompt()
    await deferredInstall.userChoice
  }

  const widthClass = pinned || hovered ? 'w-56' : 'w-16'

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-pitch-950 border-r border-pitch-800 z-30 transition-all duration-200 select-none ${widthClass}`}
        onMouseEnter={() => !pinned && setHovered(true)}
        onMouseLeave={() => !pinned && setHovered(false)}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-3 py-4 border-b border-pitch-800">
          <span
            className="inline-block w-7 h-7 rounded-md bg-gradient-to-br from-amber-400 to-amber-600 flex-shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
            aria-hidden="true"
            style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
          />
          {(pinned || hovered) && (
            <div className="min-w-0 animate-fade-in">
              <h1 className="text-sm font-bold text-slate-100 tracking-tight leading-none">
                Matchlytics
                <span className="ml-1 text-[9px] font-mono font-normal text-slate-500">by imortifex</span>
              </h1>
              <p className="text-[10px] text-slate-500 mt-0.5">Quant Terminal</p>
            </div>
          )}
        </div>

        {/* Workspace Nav */}
        <nav aria-label="Workspaces" className="px-2 py-3 space-y-1">
          {!pinned && !hovered && (
            <p className="text-[9px] uppercase tracking-wider text-slate-600 font-semibold text-center mb-2">Work</p>
          )}
          {WORKSPACES.map((ws) => {
            const active = activeWorkspace === ws.id
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => onSelectWorkspace?.(ws.id)}
                aria-current={active ? 'page' : undefined}
                title={!pinned && !hovered ? ws.label : undefined}
                className={`w-full min-h-[36px] rounded-xl transition-all duration-150 flex items-center gap-3 relative ${
                  active
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'text-slate-400 hover:bg-pitch-900 hover:text-slate-200'
                } ${!pinned && !hovered ? 'justify-center px-0' : 'px-3'}`}
              >
                {/* Active indicator */}
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-amber-400 rounded-full" />
                )}
                <span className="flex-shrink-0">{ws.icon}</span>
                {(pinned || hovered) && (
                  <span className="text-xs font-semibold truncate animate-fade-in">{ws.label}</span>
                )}
              </button>
            )
          })}
          {isAdmin && onOpenAdmin && (
            <button
              type="button"
              onClick={() => onOpenAdmin?.()}
              aria-current={activeWorkspace === 'admin' ? 'page' : undefined}
              title={!pinned && !hovered ? ADMIN_WORKSPACE.label : undefined}
              className={`w-full min-h-[36px] rounded-xl transition-all duration-150 flex items-center gap-3 relative ${
                activeWorkspace === 'admin'
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'text-slate-400 hover:bg-pitch-900 hover:text-slate-200'
              } ${!pinned && !hovered ? 'justify-center px-0' : 'px-3'}`}
            >
              {activeWorkspace === 'admin' && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-amber-400 rounded-full" />
              )}
              <span className="flex-shrink-0 text-amber-500">{ADMIN_WORKSPACE.icon}</span>
              {(pinned || hovered) && (
                <span className="text-xs font-semibold truncate animate-fade-in text-amber-400">{ADMIN_WORKSPACE.label}</span>
              )}
            </button>
          )}
        </nav>

        {/* Feed Nav */}
        <nav aria-label="Feeds" className="px-2 py-2 space-y-1">
          {!pinned && !hovered && (
            <p className="text-[9px] uppercase tracking-wider text-slate-600 font-semibold text-center mb-1">Feed</p>
          )}
          {FEEDS.map((feed) => {
            const active = activeFeed === feed.id
            return (
              <button
                key={feed.id}
                type="button"
                onClick={() => onFeedSelect?.(feed.id)}
                aria-current={active ? 'page' : undefined}
                title={!pinned && !hovered ? feed.label : undefined}
                className={`w-full min-h-[36px] rounded-xl transition-all duration-150 flex items-center gap-3 relative ${
                  active
                    ? 'bg-pitch-800 text-amber-400'
                    : 'text-slate-400 hover:bg-pitch-900 hover:text-slate-200'
                } ${!pinned && !hovered ? 'justify-center px-0' : 'px-3'}`}
              >
                <span className="flex-shrink-0">{feed.icon}</span>
                {(pinned || hovered) && (
                  <span className="text-xs font-medium truncate flex-1 text-left">{feed.label}</span>
                )}
                {feed.id === 'value' && valueCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 tabular-nums">
                    {valueCount}
                  </span>
                )}
                {feed.id === 'watchlist' && watchlistCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 tabular-nums">
                    {watchlistCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Backtest */}
        <div className="px-2 py-2">
          <button
            type="button"
            onClick={onOpenBacktest}
            title={!pinned && !hovered ? 'Track Record' : undefined}
            className="w-full min-h-[36px] rounded-xl text-slate-400 hover:bg-pitch-900 hover:text-slate-200 transition-all duration-150 flex items-center gap-3 px-3"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            {(pinned || hovered) && <span className="text-xs font-medium truncate">Track Record</span>}
          </button>
        </div>

        {/* Pin Toggle */}
        <div className="px-2 py-1">
          <button
            type="button"
            onClick={() => setPinned(!pinned)}
            title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            className={`w-full min-h-[32px] rounded-lg text-[10px] font-mono transition-all duration-150 flex items-center justify-center gap-1.5 ${
              pinned ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-pitch-900'
            }`}
          >
            <span>{pinned ? '📌' : '📍'}</span>
            {(pinned || hovered) && <span>{pinned ? 'Unpin' : 'Pin'}</span>}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-auto px-2 pb-3 space-y-2 border-t border-pitch-800 pt-3">
          {/* User Profile */}
          {userEmail && (
            <button
              type="button"
              onClick={onOpenProfile}
              title="User Profile & Settings"
              className={`w-full rounded-xl bg-pitch-900 border border-pitch-800 hover:border-amber-500/40 transition-all duration-150 text-left ${
                !pinned && !hovered ? 'flex items-center justify-center py-2' : 'p-2.5'
              }`}
            >
              {(!pinned && !hovered) ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-pitch-950 font-bold text-xs">
                    {userEmail.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono">Profile</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 flex-shrink-0 flex items-center justify-center text-pitch-950 font-bold text-xs">
                    {userEmail.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-slate-300 font-medium truncate">{userEmail}</p>
                    <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold tracking-wider ${
                      subscriptionTier === 'free'
                        ? 'bg-pitch-800 text-slate-500 border border-pitch-700'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}>
                      {(subscriptionTier || 'free').toUpperCase()}
                    </span>
                  </div>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-500 flex-shrink-0">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </div>
              )}
            </button>
          )}

          {/* Admin Button */}
          {isAdmin && onOpenAdmin && (pinned || hovered) && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="w-full px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[11px] font-mono transition-colors text-left"
            >
              Admin Dashboard
            </button>
          )}

          {/* Status */}
          {(pinned || hovered) && (
            <>
              <div className="flex items-center gap-2 text-[10px] font-medium text-emerald-400">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live
              </div>
              {timeStr && (
                <p className="text-[10px] text-slate-500 tabular-nums">Sync: {timeStr}</p>
              )}
            </>
          )}

          {/* Install */}
          <button
            type="button"
            onClick={handleInstall}
            disabled={!deferredInstall}
            title={!pinned && !hovered ? 'Install' : undefined}
            className={`w-full min-h-[36px] px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-150 flex items-center justify-center gap-2 ${
              deferredInstall
                ? 'bg-pitch-900 hover:bg-pitch-800 text-slate-300 border-pitch-700'
                : 'bg-transparent border-transparent text-transparent pointer-events-none'
            } ${!pinned && !hovered ? 'px-0' : ''}`}
            style={{ visibility: deferredInstall ? 'visible' : 'hidden' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {(pinned || hovered) && <span>Install App</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-pitch-950/95 backdrop-blur-lg border-t border-pitch-800 z-40 safe-bottom" aria-label="Mobile navigation">
        <div className="flex items-center justify-around py-2 px-4">
          {WORKSPACES.map((ws) => {
            const active = activeWorkspace === ws.id
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => onSelectWorkspace?.(ws.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={ws.label}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all duration-150 ${
                  active
                    ? 'text-amber-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <span className={`transition-transform ${active ? 'scale-110' : ''}`}>{ws.icon}</span>
                <span className="text-[10px] font-medium">{ws.label}</span>
                {active && <div className="w-1 h-1 rounded-full bg-amber-400" />}
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
