// ---- WorkspaceNav.jsx ----
// Multi-Tab Workspace Navigation Bar
// Top sub-nav switching between Terminal Scanner, Quant Lab, Portfolio Tracker, and Model Ledger.
// Zero em dash characters (R-02 compliance)

export default function WorkspaceNav({
  activeWorkspace = 'terminal',
  onWorkspaceChange,
  onSelectWorkspace,
  onOpenCommandPalette,
  activeFixtureCount = 0,
  valueBetCount = 0,
  valueCount = 0,
  portfolioCount = 0,
  selectedLabFixture = null,
  tier = 'free',
}) {
  const handleSwitch = onWorkspaceChange || onSelectWorkspace
  const effectiveValueCount = valueBetCount || valueCount || 0
  const isTierLocked = !tier || tier === 'free' || tier === 'inactive'

  const workspaces = [
    {
      id: 'terminal',
      label: 'Terminal Scanner',
      icon: '◈',
      badge: `${activeFixtureCount} Matches`,
      badgeColor: 'text-slate-400 bg-pitch-900 border-pitch-700',
      highlightBadge: effectiveValueCount > 0 ? `${effectiveValueCount} +EV` : null,
    },
    {
      id: 'quant_lab',
      label: 'Quant Lab',
      icon: '⚅',
      badge: selectedLabFixture
        ? `${(selectedLabFixture.home_team_name || 'Home').split(' ')[0]} v ${(selectedLabFixture.away_team_name || 'Away').split(' ')[0]}`
        : 'Single-Match Lab',
      badgeColor: selectedLabFixture
        ? 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30'
        : 'text-slate-500 bg-pitch-900 border-pitch-800',
      showLockBadge: isTierLocked,
    },
    {
      id: 'portfolio',
      label: 'Bankroll & Bet Tracker',
      icon: '⊞',
      badge: `${portfolioCount} Positions`,
      badgeColor: portfolioCount > 0 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-slate-500 bg-pitch-900 border-pitch-800',
    },
    {
      id: 'ledger',
      label: 'Track Record & Ledger',
      icon: '📈',
      badge: 'Verified Calibration',
      badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    },
  ]

  return (
    <div className="w-full bg-pitch-950/90 border-b border-pitch-800 backdrop-blur sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none py-1.5">
        {/* Workspace Tabs */}
        <nav className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0" aria-label="Workspace switcher">
          {workspaces.map((ws) => {
            const isActive = activeWorkspace === ws.id
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => handleSwitch && handleSwitch(ws.id)}
                className={`min-h-[40px] px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  isActive
                    ? 'bg-pitch-800/90 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/5'
                    : 'bg-transparent text-slate-400 hover:text-slate-200 hover:bg-pitch-900/80 border-transparent'
                }`}
              >
                <span className="text-sm">{ws.icon}</span>
                <span>{ws.label}</span>

                {/* Show PRO Lock badge ONLY when tier is free or inactive */}
                {ws.id === 'quant_lab' && ws.showLockBadge && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-pitch-900 text-indigo-300 border border-indigo-500/30">
                    🔒 PRO
                  </span>
                )}

                {/* Show fixture / status badge when not locked */}
                {(!ws.showLockBadge && ws.badge) && (
                  <span className={`hidden md:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono border ${ws.badgeColor}`}>
                    {ws.badge}
                  </span>
                )}

                {/* Highlight +EV opportunities */}
                {ws.highlightBadge && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {ws.highlightBadge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Command Palette Trigger */}
        <div className="flex items-center gap-2 flex-shrink-0 pl-2">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="min-h-[36px] px-2.5 sm:px-3 rounded-lg border border-pitch-700 bg-pitch-900/90 text-slate-400 hover:text-slate-100 hover:border-slate-600 transition-colors flex items-center gap-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            title="Open institutional command palette"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="hidden sm:inline">Commands</span>
            <kbd className="px-1.5 py-0.5 rounded bg-pitch-950 text-[10px] text-slate-400 border border-pitch-800">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
