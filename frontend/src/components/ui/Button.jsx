// ---- Button.jsx ----
// Professional button component with variants
// R-02 Compliant: Zero em dashes

import { forwardRef } from 'react'

const VARIANTS = {
  primary: 'bg-gradient-to-r from-amber-500 to-amber-400 text-pitch-950 font-semibold shadow-[0_2px_8px_rgba(245,158,11,0.3)] hover:shadow-[0_4px_16px_rgba(245,158,11,0.4)] hover:-translate-y-0.5',
  secondary: 'bg-pitch-800 border border-pitch-600 text-slate-200 font-medium hover:bg-pitch-700 hover:border-pitch-500',
  ghost: 'text-slate-400 hover:text-slate-200 hover:bg-pitch-800',
  danger: 'bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500/30',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-md',
  lg: 'px-6 py-2.5 text-base rounded-lg',
  icon: 'p-2 rounded-md',
}

export const Button = forwardRef(({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled = false,
  loading = false,
  icon,
  ...props
}, ref) => {
  const baseClass = 'inline-flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
  const variantClass = VARIANTS[variant] || VARIANTS.primary
  const sizeClass = SIZES[size] || SIZES.md

  return (
    <button
      ref={ref}
      className={`${baseClass} ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  )
})

Button.displayName = 'Button'

// Preset buttons
export const ButtonPrimary = (props) => <Button variant="primary" {...props} />
export const ButtonSecondary = (props) => <Button variant="secondary" {...props} />
export const ButtonGhost = (props) => <Button variant="ghost" {...props} />
export const ButtonDanger = (props) => <Button variant="danger" {...props} />
