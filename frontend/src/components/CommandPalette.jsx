// ---- CommandPalette.jsx ----
// Institutional Command Palette (Ctrl+K / Cmd+K)
// Instant keyboard navigation across workspaces, leagues, +EV filters, and matches.

import { useState, useEffect, useRef, useMemo } from 'react'

export default function CommandPalette({
  isOpen,
  onClose,
  fixtures = [],
  leagues = [],
  onSelectFixture,
  onSelectWorkspace,
  onSelectLeague,
  onToggleValueOnly,
  onClearFilters,
}) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (isOpen) onClose()
        else {
          // Open palette
          const event = new CustomEvent('open-command-palette')
          window.dispatchEvent(event)
        }
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Build searchable items
  const items = useMemo(() => {
    const q = query.trim().toLowerCase()

    const workspaceActions = [
      {
        id: 'ws-terminal',
        category: 'Workspaces',
        title: 'Terminal Scanner',
        subtitle: 'Live fixtures feed, market odds, and +EV scanner',
        icon: '◈',
        action: () => {
          onSelectWorkspace('terminal')
          onClose()
        },
      },
      {
        id: 'ws-quant-lab',
        category: 'Workspaces',
        title: 'Quant Lab',
        subtitle: 'Bivariate Poisson matrix, Monte Carlo simulation, lambda overrides',
        icon: '⚅',
        action: () => {
          onSelectWorkspace('quant_lab')
          onClose()
        },
      },
      {
        id: 'ws-portfolio',
        category: 'Workspaces',
        title: 'Bankroll & Portfolio Journal',
        subtitle: 'Position tracker, Quarter-Kelly staking, capital equity curve',
        icon: '⊞',
        action: () => {
          onSelectWorkspace('portfolio')
          onClose()
        },
      },
      {
        id: 'ws-ledger',
        category: 'Workspaces',
        title: 'Track Record & Model Ledger',
        subtitle: 'Historical verified settlements and multi-class Brier calibration',
        icon: '📈',
        action: () => {
          onSelectWorkspace('ledger')
          onClose()
        },
      },
    ]

    const filterActions = [
      {
        id: 'act-val-only',
        category: 'Quick Filters',
        title: 'Filter: +EV Edges Only',
        subtitle: 'Show only fixtures with model-verified positive expected value',
        icon: '🎯',
        action: () => {
          onToggleValueOnly(true)
          onSelectWorkspace('terminal')
          onClose()
        },
      },
      {
        id: 'act-clear',
        category: 'Quick Filters',
        title: 'Clear All Active Filters',
        subtitle: 'Reset league, horizon, and search parameters',
        icon: '↺',
        action: () => {
          onClearFilters()
          onClose()
        },
      },
    ]

    const leagueActions = leagues
      .filter((l) => l.id !== 'all')
      .map((l) => ({
        id: `league-${l.id}`,
        category: 'Competitions',
        title: `Filter: ${l.label}`,
        subtitle: l.country ? `Top flight division in ${l.country}` : 'Continental European tournament',
        icon: '⚽',
        action: () => {
          onSelectLeague(l.id)
          onSelectWorkspace('terminal')
          onClose()
        },
      }))

    const matchItems = (fixtures || [])
      .filter(Boolean)
      .map((f) => {
        const home = f?.home_team?.name || f?.home_team_name || 'Home';
        const away = f?.away_team?.name || f?.away_team_name || 'Away';
        return {
          id: `fix-${f?.id}`,
          category: 'Fixtures',
          title: `${home} vs ${away}`,
          subtitle: `${f?.league_name || 'League'} : Kickoff ${f?.match_date ? new Date(f.match_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD'}${f?.value_pick ? ` : +EV ${f.value_pick} (+${f?.ev_percentage}%)` : ''}`,
          icon: f?.value_pick ? '★' : '⚽',
          isVal: Boolean(f?.value_pick),
          action: () => {
            onSelectFixture(f)
            onSelectWorkspace('quant_lab')
            onClose()
          },
        };
      })

    const all = [...workspaceActions, ...filterActions, ...leagueActions, ...matchItems]

    if (!q) {
      // Default view: workspaces + top filters + top 5 value matches
      const defaultMatches = matchItems.filter((m) => m.isVal).slice(0, 5)
      return [...workspaceActions, ...filterActions, ...defaultMatches]
    }

    return all.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    ).slice(0, 20)
  }, [query, fixtures, leagues, onSelectWorkspace, onSelectFixture, onSelectLeague, onToggleValueOnly, onClearFilters, onClose])

  // Handle arrow keys and Enter
  const handleKeyDownInput = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, items.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + items.length) % Math.max(1, items.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[selectedIndex]) {
        items[selectedIndex].action()
      }
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    const selectedEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-3 bg-pitch-950/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-2xl bg-pitch-900 border border-pitch-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-pitch-800 bg-pitch-950/70">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-400 flex-shrink-0"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDownInput}
            placeholder="Type a team, league, +EV filter, or workspace..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-sans"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-pitch-800 border border-pitch-700 rounded">
            ESC to close
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 divide-y divide-pitch-800/40">
          {items.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              No matching commands or fixtures found for "{query}"
            </div>
          ) : (
            items.map((item, idx) => {
              const isSelected = idx === selectedIndex
              return (
                <div
                  key={item.id}
                  data-index={idx}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected ? 'bg-amber-500/15 border border-amber-500/30' : 'hover:bg-pitch-800/60 border border-transparent'
                  }`}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-pitch-800 flex items-center justify-center text-xs text-amber-300 flex-shrink-0">
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold truncate ${isSelected ? 'text-amber-300' : 'text-slate-200'}`}>
                          {item.title}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider px-1.5 py-0.2 rounded bg-pitch-950 border border-pitch-800">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5 font-sans">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 text-slate-500">
                    {isSelected && (
                      <span className="text-[11px] font-mono text-amber-400">
                        Enter ↵
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer info strip */}
        <div className="px-4 py-2 border-t border-pitch-800/80 bg-pitch-950/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span className="text-slate-600">Matchlytics Terminal Command</span>
        </div>
      </div>
    </div>
  )
}
