// ---- SubscriptionModal.jsx ----
// Paywall shown on the app surface when the caller has a session but no
// active subscription. Access is blocked until a subscription goes
// active; paying lifts the lock live (AuthContext streams profile writes
// over realtime, no reload).
//
// Pricing: the official rates are built in as production defaults, so
// the cards never render an empty price. VITE_PRICE_PRO / VITE_PRICE_SEASON
// can override them for regional promos or currency changes.
//
// Checkout: when a gateway link is deployed (Midtrans/Sanberpay or Stripe
// payment link via VITE_CHECKOUT_URL_*), the CTA redirects there with the
// signed-in email attached as customer_email. Without one, a manual
// payment card guides the buyer through bank transfer or QRIS, with a
// pre-filled WhatsApp confirmation when the operator sets
// VITE_ADMIN_WHATSAPP, and a real GitHub contact route as the standing
// fallback. No dead admin numbers ship in the source.

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const PRICE_PRO = import.meta.env.VITE_PRICE_PRO || 'Rp 149.000 / bln'
const PRICE_SEASON = import.meta.env.VITE_PRICE_SEASON || 'Rp 999.000 / thn'
const SUBTEXT_PRO = 'Billing monthly · Cancel anytime'
// Season pass covers the same engine for a whole year:
// 12 x Rp 149.000 = Rp 1.788.000, so Rp 999.000 saves roughly 44%.
const SUBTEXT_SEASON = 'Save ~44% · Full season coverage'

// Operator-configured admin channel for manual activation confirmation.
// International format without "+" prefix, e.g. 6281234567890.
const ADMIN_WHATSAPP = import.meta.env.VITE_ADMIN_WHATSAPP
const GITHUB_CONTACT_URL = 'https://github.com/adrilhutama/Matchlytics'

const TIERS = [
  {
    id: 'pro',
    name: 'Pro Pass',
    cadence: 'Monthly',
    price: PRICE_PRO,
    subtext: SUBTEXT_PRO,
    checkoutUrl: import.meta.env.VITE_CHECKOUT_URL_PRO,
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
    price: PRICE_SEASON,
    subtext: SUBTEXT_SEASON,
    checkoutUrl: import.meta.env.VITE_CHECKOUT_URL_SEASON,
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

  // Gateway path: redirect with the buyer's email attached so the
  // provider can pre-bind the session.
  const handleGatewayCheckout = () => {
    if (!selected?.checkoutUrl) return
    setLeaving(true)
    try {
      const target = new URL(selected.checkoutUrl)
      if (user?.email) target.searchParams.set('customer_email', user.email)
      window.location.assign(target.toString())
    } catch {
      window.location.assign(selected.checkoutUrl)
    }
  }

  // Manual path: one pre-filled confirmation message to the operator,
  // which triggers the service-role activation on the caller's row.
  const handleWhatsappConfirmation = () => {
    if (!ADMIN_WHATSAPP) return
    setLeaving(true)
    const message = `Halo Admin Matchlytics, saya ingin aktivasi langganan ${selected.name} untuk akun ${user?.email ?? ''}`
    const url = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank', 'noopener')
  }

  const handleSignOut = async () => {
    setLeaving(true)
    await signOut()
  }

  const manualMode = !selected?.checkoutUrl

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
            Choose a pass to open every live feed, model, and simulator. Your
            access activates the moment payment is confirmed.
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

                <div className="mt-3">
                  <div className="text-2xl font-black text-amber-400 tracking-tight break-words">
                    {t.price}
                  </div>
                  <p className="mt-1 text-[11px] font-mono text-slate-500">{t.subtext}</p>
                </div>

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
          {!manualMode ? (
            <>
              <button
                type="button"
                onClick={handleGatewayCheckout}
                disabled={leaving}
                className="w-full min-h-[48px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-pitch-950 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {leaving ? 'Opening secure checkout...' : `Proceed to Checkout · ${selected.name}`}
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
                Complete your {selected.name} manually
              </p>
              <ol className="mt-3 space-y-1.5 text-[11px] text-slate-400 list-decimal list-inside leading-relaxed">
                <li>Transfer {selected.price} via QRIS or bank transfer to the operator.</li>
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
            <button
              type="button"
              onClick={handleSignOut}
              disabled={leaving}
              className="min-h-[36px] px-3 text-xs font-mono text-slate-500 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              Sign out instead
            </button>
            <p className="text-[10px] font-mono text-slate-600">Secure payment · 18+</p>
          </div>
        </div>
      </div>
    </div>
  )
}
