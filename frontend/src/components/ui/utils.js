// ---- utils.js ----
// Utility functions for components

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function formatEV(value) {
  if (value == null) return '0.0'
  const num = Number(value)
  if (isNaN(num)) return '0.0'
  return num.toFixed(1)
}

export function formatProbability(value) {
  if (value == null) return '0'
  const num = Number(value)
  if (isNaN(num)) return '0'
  return Math.round(num)
}

export function formatOdds(value) {
  if (value == null) return '-'
  const num = Number(value)
  if (isNaN(num) || num <= 0) return '-'
  return num.toFixed(2)
}

export function formatKelly(value) {
  if (value == null) return '0.0'
  const num = Number(value)
  if (isNaN(num)) return '0.0'
  return Math.min(num * 100, 2.5).toFixed(1)
}

export function getStatusColor(status) {
  switch (status) {
    case 'LIVE': return 'emerald'
    case 'FT': return 'slate'
    case 'POST': return 'rose'
    default: return 'slate'
  }
}

export function getEVVariant(ev) {
  if (ev == null) return 'slate'
  const num = Number(ev)
  if (num >= 5) return 'emerald'
  if (num >= 2) return 'amber'
  if (num > 0) return 'sky'
  return 'slate'
}
