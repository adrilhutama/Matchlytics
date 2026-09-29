// ---- SubscriptionModal.jsx ----
// Three-tier plan picker, surfaced from any locked control in the
// dashboard. Free callers reach it while the full dashboard keeps
// running underneath, so the modal doubles as their plan status
// screen: it ships with a clean close path, not just a checkout.
//
// Tiers:
//   Free    Rp 0           Today window, basic 1X2 probabilities
//   Pro     Monthly pass   Next 7 days horizon, full feature set
//   Annual  Season pass   Full 30 day horizon, everything in Pro
//                          plus the complete backtest archives
//
// Pricing falls back to the production defaults built into the app
// (Rp 149.000 / bln and Rp 999.000 / thn); VITE_PRICE_PRO /
// VITE_PRICE_SEASON override them for promos or currency changes.
//
// Checkout: when a gateway link is deployed (VITE_CHECKOUT_URL_*),
// the upgrade CTA redirects there with the signed-in email attached
// as customer_email. Without one, a manual payment card guides the
// buyer through bank transfer or QRIS, with a pre-filled WhatsApp
// confirmation once the operator ships VITE_ADMIN_WHATSAPP, and a
// real GitHub contact route as the standing fallback. No dead admin
// numbers ship in the source.

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const PRICE_PRO = import.meta.env.VITE_PRICE_PRO || 'Rp 149.000 / bln'
const PRICE_ANNUAL = import.meta.env.VITE_PRICE_ANNUAL || import.meta.env.VITE_PRICE_SEASON || 'Rp 999.000 / thn'

// Operator-configured admin channel for manual activation confirmation.
// International format without "+" prefix, e.g. 6281234567890.
const ADMIN_WHATSAPP = import.meta.env.VITE_ADMIN_WHATSAPP
const GITHUB_CONTACT_URL = 'https://github.com/adrilhutama/Matchlytics'

const PAID_PLANS = [
  {
    id: 'pro',
    name: 'Pro Pass',
    cadence: 'Monthly',
    price: PRICE_PRO,
    subtext: 'Billing monthly · Cancel anytime',
    cta: 'Upgrade to Pro',
    checkoutUrl: import.meta.env.VITE_CHECKOUT_URL_PRO,
    blurb: 'Everything except the season window.',
    perks: [
      'Next 7 days match horizon',
      'Full +EV value scanner',
      '6×6 Scoreline Heatmaps',
      'Kelly Criterion staking',
      'Parlay builder across six leagues',
    ],
  },
  {
    id: 'annual',
    name: 'Season Pass',
    cadence: 'Annual',
    price: PRICE_ANNUAL,
    subtext: 'Save ~44% · One season, one rate',
    cta: 'Upgrade to Annual',
    checkoutUrl: import.meta.env.VITE_CHECKOUT_URL_SEASON,
    blurb: 'The whole season at a discounted rate.',
    perks: [
      'Full 30 day match horizon',
      'Everything in Pro Pass',
      'Complete backtest archives',
      'Priority support queue',
    ],
  },
]

const FREE_PERKS = [
  'Today match window only',
  'Basic 1X2 probabilities',
  'Watchlist and league filters',
  '+EV, Matrix, Kelly and Parlay locked',
]

export default function SubscriptionModal({ onClose }) {
  const { user, profile, signOut } = useAuth()
  const [selected, setSelected] = useState('pro')
  const [leaving, setLeaving] = useState(false)

  const currentPlan = profile?.subscription_tier || 'free'
  const statusLabel =
    profile?.subscription_status === 'active'
      ? 'ACTIVE'
      : profile?.subscription_status === 'past_due'
      ? 'PAST DUE'
      : 'INACTIVE'

  const chosen = PAID_PLANS.find((p) => p.id === selected)

  // Gateway path: redirect with the buyer's email attached so the
  // provider can pre-bind the session.
  const handleGatewayCheckout = () => {
    if (!chosen?.checkoutUrl) return
    setLeaving(true)
    try {
      const target = new URL(chosen.checkoutUrl)
      if (user?.email) target.searchParams.set('customer_email', user.email)
      window.location.assign(target.toString())
    } catch {
      window.location.assign(chosen.checkoutUrl)
    }
  }

  // Manual path: one pre-filled confirmation message to the operator,
  // which triggers the service-role activation on the caller's row.
  const handleWhatsappConfirmation = () => {
    if (!ADMIN_WHATSAPP) return
    setLeaving(true)
    const message = `Halo Admin Matchlytics, saya ingin aktivasi langganan ${chosen.name} untuk akun ${user?.email ?? ''}`
    const url = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank', 'noopener')
  }

  const handleSignOut = async () => {
    setLeaving(true)
    await signOut()
  }

  const manualMode = !chosen?.checkoutUrl
  const closeAction = onClose
    ? () => {
        if (!leaving) onClose()
      }
    : null

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-pitch-950/85 backdrop-blur-[3px] flex items-start sm:items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Choose your Matchlytics plan"
    >
      <div className="w-full max-w-4xl my-4 rounded-2xl bg-pitch-900 border border-pitch-700 overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-pitch-800">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-block w-6 h-6 rounded bg-amber-500 flex-shrink-0"
              aria-hidden="true"
              style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
            />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-100 tracking-tight leading-tight">
                Choose your pass
              </h2>
              <p className="mt-0.5 text-[11px] font-mono text-slate-500 truncate">
                Signed in as {user?.email ?? 'unknown'} · {currentPlan.toUpperCase()} · {statusLabel}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400 leading-relaxed max-w-md">
            Free covers today and the core model reads. Paid passes unlock
            longer horizons and the full quant engine. Activation lands the
            moment payment confirms, no reload.
          </p>
        </div>

        {/* Tier cards: three across on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 sm:p-5">
          {/* Free */}
          <div className={`rounded-xl border p-4 ${
            currentPlan === 'free'
              ? 'border-amber-500/40 bg-amber-500/[0.05]'
              : 'border-pitch-700 bg-pitch-950'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-100">Free</p>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-pitch-800 text-slate-400">
                Included
              </span>
            </div>
            {currentPlan === 'free' && (
              <span className="mt-2 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300">
                CURRENT PLAN
              </span>
            )}
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-200 tracking-tight">Rp 0</div>
              <p className="mt-1 text-[11px] font-mono text-slate-500">No card required</p>
            </div>
            <ul className="mt-3 space-y-1.5">
              {FREE_PERKS.map((perk) => (
                <li key={perk} className="flex items-start gap-2 text-[11px] text-slate-400 leading-snug">
                  <span className={`mt-1 w-1 h-1 rounded-full flex-shrink-0 ${perk.includes('locked') ? 'bg-rose-400/70' : 'bg-emerald-400'}`} aria-hidden="true" />
                  <span className="min-w-0">{perk}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Paid passes */}
          {PAID_PLANS.map((plan) => {
            const isSelected = selected === plan.id
            const isCurrent = currentPlan === plan.id
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelected(plan.id)}
                aria-pressed={isSelected}
                className={`min-h-[44px] w-full min-w-0 text-left rounded-xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  isSelected
                    ? 'border-amber-500/60 bg-amber-500/[0.06]'
                    : isCurrent
                    ? 'border-amber-500/40 bg-amber-500/[0.04] hover:border-amber-400'
                    : 'border-pitch-700 bg-pitch-950 hover:border-pitch-500'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-bold ${isSelected ? 'text-amber-300' : 'text-slate-100'}`}>
                    {plan.name}
                  </p>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                      isSelected ? 'bg-amber-500/20 text-amber-300' : 'bg-pitch-800 text-slate-500'
                    }`}
                  >
                    {plan.cadence}
                  </span>
                </div>

                {(isCurrent || plan.id === 'annual') && (
                  <span
                    className={`mt-2 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      isCurrent ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'
                    }`}
                  >
                    {isCurrent ? 'CURRENT PLAN' : 'BEST VALUE'}
                  </span>
                )}

                <p className="mt-2 text-xs text-slate-500">{plan.blurb}</p>
                <div className="mt-3">
                  <div className="text-2xl font-black text-amber-400 tracking-tight break-words">
                    {plan.price}
                  </div>
                  <p className="mt-1 text-[11px] font-mono text-slate-500">{plan.subtext}</p>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2 text-[11px] text-slate-400 leading-snug">
                      <span className="mt-1 w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0" aria-hidden="true" />
                      <span className="min-w-0">{perk}</span>
                    </li>
                  ))}
                </ul>
                <span
                  className={`mt-4 inline-flex w-full min-h-[44px] items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-bold transition-colors ${
                    isSelected
                      ? 'bg-amber-500 text-pitch-950'
                      : isCurrent
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-pitch-800 text-slate-300 hover:bg-pitch-700 border border-pitch-700'
                  }`}
                >
                  {isCurrent ? '✓ Your active pass' : `✦ ${plan.cta}`}
                </span>
              </button>
            )
          })}
        </div>

        {/* Checkout footer: gateway redirect or manual payment card */}
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3">
          {!manualMode ? (
            <>
              <button
                type="button"
                onClick={handleGatewayCheckout}
                disabled={leaving}
                className="w-full min-h-[48px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-pitch-950 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {leaving ? 'Opening secure checkout...' : `${chosen.cta} · Proceed to Checkout`}
              </button>
              <p className="text-[11px] text-slate-500">
                Secure payment window. Your account email is attached so the charge binds to
                <span className="font-mono text-slate-400"> {user?.email} </span>
                and activation applies immediately on success.
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-pitch-700 bg-pitch-950 p-4">
              <p className="text-xs font-bold text-slate-100">
                Complete your {chosen.name} manually
              </p>
              <ol className="mt-3 space-y-1.5 text-[11px] text-slate-400 list-decimal list-inside leading-relaxed">
                <li>Transfer {chosen.price} via QRIS or bank transfer to the operator.</li>
                <li>Send your account email and receipt with the confirmation below.</li>
                <li>Activation lands on this screen automatically. No reload.</li>
              </ol>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleWhatsappConfirmation}
                  disabled={!ADMIN_WHATSAPP || leaving}
                  className={`min-h-[44px] flex-1 px-4 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                    ADMIN_WHATSAPP
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-pitch-950'
                      : 'bg-pitch-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {ADMIN_WHATSAPP ? 'Confirm via WhatsApp' : 'WhatsApp confirmation unavailable'}
                </button>
                <a
                  href={GITHUB_CONTACT_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="min-h-[44px] flex-1 px-4 rounded-xl border border-pitch-600 bg-pitch-800 hover:bg-pitch-700 text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  Get help on GitHub
                </a>
              </div>
              {!ADMIN_WHATSAPP && (
                <p className="mt-2 text-[10px] font-mono text-slate-600">
                  The WhatsApp confirmation line lights up once the operator ships
                  <span className="text-slate-400"> VITE_ADMIN_WHATSAPP</span>. Until then, use GitHub.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            {closeAction ? (
              <button
                type="button"
                onClick={closeAction}
                disabled={leaving}
                className="min-h-[36px] px-3 text-xs font-semibold text-slate-300 hover:text-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                Close · keep exploring
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={leaving}
                className="min-h-[36px] px-3 text-xs font-mono text-slate-500 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                Sign out instead
              </button>
              <p className="text-[10px] font-mono text-slate-600 hidden sm:block">Secure payment · 18+</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
