// ---- SubscriptionBanner.jsx ----
// Shows a compact banner when subscription is expiring soon or has expired.
// Uses real-time countdown derived from current_period_end.

import { useAuth } from '../context/AuthContext'

const EXPIRY_WARNING_DAYS = 7

export default function SubscriptionBanner() {
  const { effectiveStatus, subscriptionRemaining, isExpired, tier } = useAuth()

  if (effectiveStatus === 'active' && (!subscriptionRemaining || subscriptionRemaining > EXPIRY_WARNING_DAYS)) {
    return null
  }

  let message
  let colorClass
  let icon

  if (isExpired) {
    message = `Subscription expired. Upgrade to restore full access.`
    colorClass = 'border-rose-500/40 bg-rose-500/5 text-rose-300'
    icon = '⚠'
  } else if (subscriptionRemaining !== null && subscriptionRemaining <= EXPIRY_WARNING_DAYS) {
    message = `${subscriptionRemaining} day${subscriptionRemaining > 1 ? 's' : ''} remaining on ${tier} plan. `
    if (subscriptionRemaining === 1) {
      message += 'Expires tomorrow.'
    } else {
      message += 'Upgrade now to avoid interruption.'
    }
    colorClass = 'border-amber-500/40 bg-amber-500/5 text-amber-300'
    icon = '⏳'
  } else {
    return null
  }

  return (
    <div className={`mx-4 sm:mx-6 mt-2 px-4 py-2.5 rounded-xl border text-xs font-mono flex items-center gap-2.5 ${colorClass}`}
      role="alert"
    >
      <span className="text-base flex-shrink-0" aria-hidden="true">{icon}</span>
      <span className="flex-1">{message}</span>
    </div>
  )
}
