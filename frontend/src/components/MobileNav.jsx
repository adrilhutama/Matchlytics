// ---- MobileNav.jsx ----
// Mobile-only bottom navigation bar (visible below lg).
// Six thumb-friendly tabs with active amber glow.
// "Leagues" opens a slide-up sheet via onOpenLeagues.
// "Slip" toggles the parlay drawer via onOpenSlip.
// "Track" opens the performance backtest modal via onOpenBacktest.
// All touch targets are >= 44px minimum height.

export default function MobileNav({
  activeTab,
  onTabChange,
  valueOnly,
  onToggleValueOnly,
  watchlistCount,
  slipCount,
  onOpenLeagues,
  onOpenSlip,
  onOpenBacktest,
}) {
  const tabs = [
    { id: 'matches',       label: 'Matches', icon: '⚽' },
    { id: 'value',         label: '+EV Only', icon: '🎯' },
    { id: 'leagues',       label: 'Leagues',  icon: '🏆' },
    { id: 'track',         label: 'Track',    icon: '📈' },
    { id: 'watchlist',     label: 'Watchlist', icon: '⭐' },
    { id: 'slip',          label: 'Slip',     icon: '📋' },
  ]

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 bg-pitch-950/95 backdrop-blur-md border-t border-pitch-800 z-40 h-14 px-2 py-1.5"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 6px)' }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch justify-between h-full gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          let onClick = () => onTabChange(tab.id)
          if (tab.id === 'value')   onClick = () => onToggleValueOnly()
          if (tab.id === 'leagues') onClick = () => onOpenLeagues()
          if (tab.id === 'slip')    onClick = () => onOpenSlip()
          if (tab.id === 'track')   onClick = () => onOpenBacktest()
          // watchlist tab also toggles filter (same action as clicking the pill in sidebar)

          const badgeCount =
            tab.id === 'watchlist' ? watchlistCount
            : tab.id === 'slip'    ? slipCount
            : 0

          return (
            <button
              key={tab.id}
              type="button"
              onClick={onClick}
              aria-pressed={isActive || (tab.id === 'value' && valueOnly)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all min-h-[44px] ${
                isActive || (tab.id === 'value' && valueOnly)
                  ? 'text-amber-400 shadow-lg shadow-amber-500/15 bg-pitch-900/60'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span className="text-[10px] font-semibold truncate w-full text-center">
                {tab.label}
              </span>
              {badgeCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-4 flex items-center justify-center rounded-full px-1 text-[9px] font-bold bg-amber-500 text-pitch-950"
                  aria-hidden="true"
                >
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
