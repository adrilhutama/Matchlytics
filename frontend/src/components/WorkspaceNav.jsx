// ---- WorkspaceNav.jsx ----
// Multi-Tab Workspace Navigation Bar
// Top sub-nav switching between Terminal Scanner, Quant Lab, Portfolio Tracker, and Model Ledger.
// Institutional pill cluster design with monospace counters & 44px touch targets (WCAG 2.1).
// Zero em dash characters (R-02 compliance).

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
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      count: activeFixtureCount,
      counterLabel: `${activeFixtureCount}`,
      highlightCounter: effectiveValueCount > 0 ? `+${effectiveValueCount} EV` : null,
    },
    {
      id: 'quant_lab',
      label: 'Quant Lab',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      ),
      fixtureLabel: selectedLabFixture
        ? `${(selectedLabFixture?.home_team?.name || selectedLabFixture?.home_team_name || 'Home').split(' ')[0]} v ${(selectedLabFixture?.away_team?.name || selectedLabFixture?.away_team_name || 'Away').split(' ')[0]}`
        : 'Single-Match Lab',
      showLockBadge: isTierLocked,
    },
    {
      id: 'portfolio',
      label: 'Bankroll Tracker',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      ),
      counterLabel: `${portfolioCount} Pos`,
      count: portfolioCount,
    },
    {
      id: 'ledger',
      label: 'Model Ledger',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      ),
      counterLabel: 'Verified',
    },
  ]

  return (
    <div className="w-full bg-pitch-950/90 border-b border-pitch-800 backdrop-blur-md sticky top-0 lg:top-0 z-20">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between gap-3 overflow-x-auto scrollbar-none py-2">
        {/* Workspace Pill Cluster */}
        <nav className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0" aria-label="Workspace switcher">
          {workspaces.map((ws) => {
            const isActive = activeWorkspace === ws.id
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => handleSwitch && handleSwitch(ws.id)}
                className={`min-h-[44px] px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 active:scale-98 ${
                  isActive
                    ? 'bg-pitch-800 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
                    : 'bg-pitch-900/60 text-slate-400 hover:text-slate-200 hover:bg-pitch-900 border-pitch-800'
                }`}
              >
                <span className="flex items-center justify-center text-slate-400">
                  {ws.icon}
                </span>
                <span>{ws.label}</span>

                {/* PRO Lock indicator */}
                {ws.id === 'quant_lab' && ws.showLockBadge && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-pitch-950 text-indigo-300 border border-indigo-500/30">
                    PRO
                  </span>
                )}

                {/* Fixture pill for Quant Lab */}
                {ws.id === 'quant_lab' && !ws.showLockBadge && (
                  <span className="hidden md:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono border text-indigo-300 bg-indigo-500/10 border-indigo-500/30">
                    {ws.fixtureLabel}
                  </span>
                )}

                {/* Monospace count / label */}
                {ws.counterLabel && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border bg-pitch-950 text-slate-400 border-pitch-700">
                    {ws.counterLabel}
                  </span>
                )}

                {/* High-priority +EV badge */}
                {ws.highlightCounter && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {ws.highlightCounter}
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
            className="min-h-[44px] px-3 rounded-xl border border-pitch-700 bg-pitch-900/90 text-slate-300 hover:text-slate-100 hover:border-slate-500 transition-colors flex items-center gap-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            title="Open institutional command palette (Ctrl+K or Cmd+K)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="hidden sm:inline">Palette</span>
            <kbd className="px-1.5 py-0.5 rounded bg-pitch-950 text-[10px] text-slate-400 border border-pitch-800">
              Ctrl+K
            </kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
