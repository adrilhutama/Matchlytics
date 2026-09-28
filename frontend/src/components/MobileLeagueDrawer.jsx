// ---- MobileLeagueDrawer.jsx ----
// Bottom-sheet sheet triggered from the mobile nav "Leagues" tab.
// Lists each league as a comfortable thumb-tap row, closes on select.

export default function MobileLeagueDrawer({
  leagues,
  activeLeague,
  onSelect,
  isOpen,
  onClose,
}) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-pitch-950/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 bg-pitch-900 border-t border-pitch-700 rounded-t-2xl p-4 pb-6 max-h-[70vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Select competition"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4" aria-hidden="true" />

        <h2 className="text-sm font-bold text-slate-100 mb-3">Choose Competition</h2>

        <ul className="space-y-1">
          <li>
            <button
              type="button"
              onClick={() => { onSelect('all'); onClose() }}
              className={`w-full min-h-[52px] px-4 rounded-xl text-sm font-medium text-left transition-all flex items-center justify-between ${
                activeLeague === 'all'
                  ? 'bg-amber-500 text-pitch-950 font-bold'
                  : 'bg-pitch-800 text-slate-300 hover:bg-pitch-700'
              }`}
            >
              <span>All Leagues</span>
              {activeLeague === 'all' && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          </li>
          {leagues.map((league) => {
            const isActive = activeLeague === league.id
            return (
              <li key={league.id}>
                <button
                  type="button"
                  onClick={() => { onSelect(league.id); onClose() }}
                  className={`w-full min-h-[52px] px-4 rounded-xl text-sm font-medium text-left transition-all flex items-center justify-between ${
                    isActive
                      ? 'bg-amber-500 text-pitch-950 font-bold'
                      : 'bg-pitch-800 text-slate-300 hover:bg-pitch-700'
                  }`}
                >
                  <span>{league.label}</span>
                  {isActive && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
