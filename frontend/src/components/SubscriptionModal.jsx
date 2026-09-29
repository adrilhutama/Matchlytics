// ---- SubscriptionModal.jsx ----
// Paywall shown on the app surface when the caller has a session but no
// active subscription. The dashboard stays mounted behind it in a
// blurred preview state; paying lifts the lock, no reload required
// (AuthContext streams profile writes over realtime).
//
// Checkout integration: the gateway redirect URL comes from env so the
// deployer can wire Midtrans (Sanberpay) or Stripe payment links later
// without touching this component. Until then the card is labelled
// honestly as "rate pending publication" rather than inventing a
// number.

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const TIERS = [
  {
    id: 'pro',
    name: 'Pro Pass',
    cadence: 'Monthly',
    priceEnv: import.meta.env.VITE_PRICE_PRO_MONTHLY,
    checkoutEnv: import.meta.env.VITE_CHECKOUT_URL_PRO,
    blurb: 'The full engine, refreshed on schedule.',
    perks: [
      '+EV value feeds across six leagues',
      '6×6 Scoreline Heatmaps per fixture',
      'Kelly Criterion staking calculator',
      'Monte Carlo bankroll simulations',
      'Daily Telegram SITREP delivery',
    ],
  },
  {
    id: 'season',
    name: 'Season Pass',
    cadence: 'Annual',
    priceEnv: import.meta.env.VITE_PRICE_SEASON_ANNUAL,
    checkoutEnv: import.meta.env.VITE_CHECKOUT_URL_SEASON,
    blurb: 'The whole season, at the discounted rate.',
    perks: [
      'Everything in Pro Pass',
      'Full-season backtest archives',
      'Priority support queue',
    ],
  },
]

export default function SubscriptionModal() {
  const { user, profile, signOut } = useAuth()
  const [tier, setTier] = useState('pro')
  const [leaving, setLeaving] = useState(false)

  const selected = TIERS.find((t) => t.id === tier)
  const statusLabel =
    profile?.subscription_status === 'past_due' ? 'PAST DUE' : 'INACTIVE'

  const handleCheckout = () => {
    if (!selected?.checkoutEnv) return
    setLeaving(true)
    window.location.assign(selected.checkoutEnv)
  }

  const handleSignOut = async () => {
    setLeaving(true)
    await signOut()
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-pitch-950/85 backdrop-blur-[3px] flex items-start sm:items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Unlock Matchlytics with a subscription"
    >
      <div className="w-full max-w-2xl my-4 rounded-2xl bg-pitch-900 border border-pitch-700 overflow-hidden animate-fade-in">
        {/* ── Header ── */}
        <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-pitch-800">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-block w-6 h-6 rounded bg-amber-500 flex-shrink-0"
              aria-hidden="true"
              style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
            />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-100 tracking-tight leading-tight">
                Unlock the quant engine
              </h2>
              <p className="mt-0.5 text-[11px] font-mono text-slate-500 truncate">
                Signed in as {user?.email ?? 'unknown'} · {statusLabel}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400 leading-relaxed max-w-md">
            Your account preview is active behind this screen. Choose a pass to open every
            live feed, model, and simulator.
          </p>
        </div>

        {/* ── Tier cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 sm:p-5">
          {TIERS.map((t) => {
            const isSelected = tier === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTier(t.id)}
                aria-pressed={isSelected}
                className={`min-h-[44px] w-full min-w-0 text-left rounded-xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  isSelected
                    ? 'border-amber-500/60 bg-amber-500/[0.06]'
                    : 'border-pitch-700 bg-pitch-950 hover:border-pitch-500'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-bold ${isSelected ? 'text-amber-300' : 'text-slate-100'}`}>
                    {t.name}
                  </p>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                      isSelected ? 'bg-amber-500/20 text-amber-300' : 'bg-pitch-800 text-slate-500'
                    }`}
                  >
                    {t.cadence}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">{t.blurb}</p>

                <p className="mt-3 text-lg font-mono text-slate-100 tabular-nums">
                  {t.priceEnv ? (
                    <>
                      {t.priceEnv}
                      <span className="text-[11px] text-slate-500">/{t.id === 'pro' ? 'mo' : 'yr'}</span>
                    </>
                  ) : (
                    <span className="text-xs font-normal text-slate-500">Rate pending publication</span>
                  )}
                </p>

                <ul className="mt-3 space-y-1.5">
                  {t.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2 text-[11px] text-slate-400 leading-snug">
                      <span className="mt-1 w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0" aria-hidden="true" />
                      <span className="min-w-0">{perk}</span>
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        {/* ── Checkout footer ── */}
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3">
          {selected?.checkoutEnv ? (
            <button
              type="button"
              onClick={handleCheckout}
              disabled={leaving}
              className="w-full min-h-[48px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-pitch-950 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {leaving ? 'Opening secure checkout...' : 'Proceed to Checkout'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCheckout}
              disabled
              className="w-full min-h-[48px] px-5 rounded-xl bg-pitch-800 border border-pitch-700 text-slate-500 text-sm font-semibold cursor-not-allowed"
            >
              Proceed to Checkout
            </button>
          )}
          {!selected?.checkoutEnv && (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              The payment gateway is not wired into this build yet. Deploying
              <span className="font-mono text-slate-400"> VITE_CHECKOUT_URL_PRO </span> /
              <span className="font-mono text-slate-400"> VITE_CHECKOUT_URL_SEASON </span>
              activates the button above (Midtrans or Stripe payment link).
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={leaving}
              className="min-h-[36px] px-3 text-xs font-mono text-slate-500 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              Sign out instead
            </button>
            <p className="text-[10px] font-mono text-slate-600">Secure checkout · 18+</p>
          </div>
        </div>
      </div>
    </div>
  )
}
