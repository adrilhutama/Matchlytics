// ---- MobileNav.jsx ----
// Mobile-only bottom navigation bar (visible below lg).
// Multi-device responsive navigation:
// - Safe-area padding for iOS WebKit & Android home indicator
// - 44x44px minimum touch targets (WCAG 2.1 compliance)
// - Clean vector SVG icons (zero emoji slop)
// - 6 institutional tabs: Matches, +EV, Leagues, Track, Portfolio, Slip
// - Active tab amber glow & micro-badge counters

export default function MobileNav({
  activeTab = 'matches',
  onTabChange,
  valueOnly,
  onToggleValueOnly,
  activeFixtureCount = 0,
  valueCount = 0,
  portfolioCount = 0,
  slipCount = 0,
  onOpenLeagues,
  onOpenSlip,
  onOpenBacktest,
  onSelectWorkspace,
  onOpenAdmin,
}) {
  const tabs = [
    {
      id: 'matches',
      label: 'Matches',
      badge: activeFixtureCount > 0 ? (activeFixtureCount > 99 ? '99+' : activeFixtureCount) : null,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="m4.93 4.93 4.24 4.24" />
          <path d="m14.83 9.17 4.24-4.24" />
          <path d="m14.83 14.83 4.24 4.24" />
          <path d="m9.17 14.83-4.24 4.24" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      ),
    },
    {
      id: 'value',
      label: '+EV',
      badge: valueCount > 0 ? valueCount : null,
      badgeColor: 'bg-emerald-500 text-pitch-950 font-bold',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="22" y1="12" x2="18" y2="12" />
          <line x1="6" y1="12" x2="2" y2="12" />
          <line x1="12" y1="6" x2="12" y2="2" />
          <line x1="12" y1="22" x2="12" y2="18" />
        </svg>
      ),
    },
    {
      id: 'leagues',
      label: 'Leagues',
      badge: null,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.45 1-1 1H7v2h10v-2h-2c-.55 0-1-.45-1-1v-2.34" />
          <path d="M6 4h12v7a6 6 0 0 1-12 0V4Z" />
        </svg>
      ),
    },
    {
      id: 'track',
      label: 'Track',
      badge: null,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      ),
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      badge: portfolioCount > 0 ? portfolioCount : null,
      badgeColor: 'bg-amber-500 text-pitch-950 font-bold',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      ),
    },
    {
      id: 'slip',
      label: 'Slip',
      badge: slipCount > 0 ? slipCount : null,
      badgeColor: 'bg-amber-400 text-pitch-950 font-bold',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="M9 12h6" />
          <path d="M9 16h6" />
        </svg>
      ),
    },
    ...(onOpenAdmin ? [{
      id: 'admin',
      label: 'Admin',
      badge: null,
      badgeColor: 'bg-rose-500 text-white font-bold',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    }] : []),
  ]

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 bg-pitch-950/95 backdrop-blur-xl border-t border-pitch-800 z-40 px-2 pt-1 pb-safe"
      style={{ paddingBottom: 'max(0.6rem, env(safe-area-inset-bottom, 0px))' }}
      aria-label="Mobile navigation bar"
    >
      <div className="flex items-stretch justify-between gap-1 max-w-md mx-auto">
        {tabs.map((tab) => {
          const isValueActive = tab.id === 'value' && valueOnly
          const isActive = (activeTab === tab.id && !isValueActive) || isValueActive

          let onClick = () => onTabChange && onTabChange(tab.id)
          if (tab.id === 'value') {
            onClick = () => {
              if (onToggleValueOnly) onToggleValueOnly()
              else if (onTabChange) onTabChange('value')
            }
          } else if (tab.id === 'leagues') {
            onClick = () => onOpenLeagues && onOpenLeagues()
          } else if (tab.id === 'slip') {
            onClick = () => onOpenSlip && onOpenSlip()
          } else if (tab.id === 'track') {
            onClick = () => {
              if (onSelectWorkspace) onSelectWorkspace('ledger')
              else if (onOpenBacktest) onOpenBacktest()
              else if (onTabChange) onTabChange('track')
            }
          } else if (tab.id === 'portfolio') {
            onClick = () => {
              if (onSelectWorkspace) onSelectWorkspace('portfolio')
              else if (onTabChange) onTabChange('portfolio')
            }
          } else if (tab.id === 'admin' && onOpenAdmin) {
            onClick = () => onOpenAdmin()
          }

          return (
            <button
              key={tab.id}
              type="button"
              onClick={onClick}
              aria-label={`${tab.label}${tab.badge ? ` (${tab.badge})` : ''}`}
              aria-pressed={isActive}
              className={`relative flex-1 min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                isActive
                  ? 'text-amber-300 bg-amber-500/10 border border-amber-500/30 shadow-sm shadow-amber-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-pitch-900/60 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-center w-5 h-5 shrink-0">
                {tab.icon}
              </div>
              <span className="text-[10px] font-semibold tracking-tight truncate w-full text-center leading-none">
                {tab.label}
              </span>

              {tab.badge != null && (
                <span
                  className={`absolute -top-1 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 text-[9px] font-mono shadow-sm ${
                    tab.badgeColor || 'bg-pitch-800 text-slate-300 border border-pitch-700'
                  }`}
                  aria-hidden="true"
                >
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
