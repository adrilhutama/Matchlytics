// ---- Chip.jsx ----
// Filter chip component with active/locked states
// R-02 Compliant: Zero em dashes

import { cn } from './utils'

export const Chip = ({
  children,
  active = false,
  locked = false,
  removable = false,
  onRemove,
  onClick,
  className = '',
  count,
  ...props
}) => {
  const baseClass = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all duration-150 select-none'
  
  const stateClass = locked
    ? 'bg-pitch-900 text-slate-600 border-pitch-800 cursor-not-allowed opacity-60'
    : active
    ? 'bg-amber-500 text-pitch-950 border-amber-500 font-semibold shadow-[0_0_12px_rgba(245,158,11,0.3)]'
    : 'bg-pitch-800 text-slate-400 border-pitch-700 hover:text-slate-200 hover:border-pitch-600 cursor-pointer'
  
  return (
    <button
      type="button"
      className={cn(baseClass, stateClass, className)}
      disabled={locked}
      onClick={!locked ? onClick : undefined}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-pitch-950/50 text-[10px] font-mono font-bold">
          {count}
        </span>
      )}
      {removable && !locked && (
        <span
          className="ml-0.5 p-0.5 rounded hover:bg-pitch-700 transition-colors"
          onClick={(e) => { e.stopPropagation(); onRemove?.() }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </span>
      )}
    </button>
  )
}

// League Chip with team crest
export const LeagueChip = ({
  league,
  active = false,
  onClick,
  className = '',
}) => {
  return (
    <Chip
      active={active}
      onClick={onClick}
      className={className}
    >
      {league.logo && (
        <img
          src={league.logo}
          alt=""
          className="w-4 h-4 object-contain"
          loading="lazy"
        />
      )}
      <span className="hidden sm:inline">{league.label || league.code}</span>
      <span className="sm:hidden">{league.code || league.shortName}</span>
    </Chip>
  )
}

// Filter chip with remove
export const FilterChip = ({
  label,
  onRemove,
  className = '',
}) => {
  return (
    <Chip
      active
      removable
      onRemove={onRemove}
      className={className}
    >
      {label}
    </Chip>
  )
}
