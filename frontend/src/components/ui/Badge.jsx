// ---- Badge.jsx ----
// Signal badge component for EV, status, tier indicators
// R-02 Compliant: Zero em dashes

import { cn } from './utils'

const VARIANTS = {
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  sky: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  slate: 'bg-pitch-700 text-slate-400 border-pitch-600',
  gradient: 'bg-gradient-to-r from-amber-500/20 to-emerald-500/20 text-amber-300 border-amber-500/30',
}

const SIZES = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-[11px]',
  lg: 'px-2.5 py-1 text-xs',
}

export const Badge = ({
  variant = 'slate',
  size = 'md',
  children,
  className = '',
  dot = false,
  glow = false,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-mono font-semibold transition-all',
        VARIANTS[variant] || VARIANTS.slate,
        SIZES[size] || SIZES.md,
        glow && variant === 'emerald' && 'shadow-[0_0_12px_rgba(16,185,129,0.3)]',
        glow && variant === 'amber' && 'shadow-[0_0_12px_rgba(245,158,11,0.3)]',
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full',
          variant === 'emerald' && 'bg-emerald-400',
          variant === 'amber' && 'bg-amber-400',
          variant === 'sky' && 'bg-sky-400',
          variant === 'rose' && 'bg-rose-400',
          variant === 'slate' && 'bg-slate-400'
        )} />
      )}
      {children}
    </span>
  )
}

// Preset badges
export const EvBadge = ({ value, size = 'md', ...props }) => {
  const absValue = Math.abs(value)
  let variant = 'slate'
  if (absValue >= 5) variant = 'emerald'
  else if (absValue >= 2) variant = 'amber'
  else if (absValue > 0) variant = 'sky'
  
  return (
    <Badge variant={variant} size={size} glow={absValue >= 5} {...props}>
      {value >= 0 ? '+' : ''}{value.toFixed(1)}%
    </Badge>
  )
}

export const StatusBadge = ({ status, ...props }) => {
  const config = {
    LIVE: { variant: 'emerald', label: 'Live', dot: true },
    SCHEDULED: { variant: 'slate', label: 'Scheduled' },
    FT: { variant: 'slate', label: 'FT' },
    POST: { variant: 'rose', label: 'Postponed' },
  }
  const { variant, label, dot } = config[status] || config.SCHEDULED
  return <Badge variant={variant} dot={dot} {...props}>{label}</Badge>
}

export const TierBadge = ({ tier, ...props }) => {
  const config = {
    free: { variant: 'slate', label: 'FREE' },
    pro: { variant: 'amber', label: 'PRO' },
    annual: { variant: 'gradient', label: 'SEASON' },
    institutional: { variant: 'emerald', label: 'INST' },
  }
  const { variant, label } = config[tier] || config.free
  return <Badge variant={variant} {...props}>{label}</Badge>
}
