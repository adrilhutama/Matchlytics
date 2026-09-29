// ---- LoginPage.jsx ----
// Authentication surface for the app.imortifex.me view.
//
// Two tabs (Sign In / Create Account) plus a passwordless magic-link
// path. Pitch-dark canvas, single glassmorphism card (dose-capped
// per src/index.css conventions), amber reserved for the primary
// actions only. Fully usable at 360px.
//
// The "Back to imortifex.me" link behaves like the other ecosystem
// links: in-place view switch on preview hosts, cross-domain jump
// in production.

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const LANDING_LIVE_URL = 'https://imortifex.me/'

export default function LoginPage({ onBackToLanding }) {
  const { signIn, signUp, requestMagicLink } = useAuth()

  const [tab, setTab] = useState('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  // One-shot notices for flows that require an out-of-band step.
  const [notice, setNotice] = useState(null)

  const isPreviewHost = () => {
    if (typeof window === 'undefined') return false
    const h = window.location.hostname
    return h === 'localhost' || h.startsWith('127.') || h.includes('vercel.app')
  }

  const handleBackToLanding = () => {
    if (isPreviewHost()) onBackToLanding()
    else window.location.assign(LANDING_LIVE_URL)
  }

  const clearFeedback = () => {
    setFormError(null)
    setNotice(null)
  }

  const switchTab = (next) => {
    setTab(next)
    clearFeedback()
  }

  const runAction = async (fn) => {
    setBusy(true)
    clearFeedback()
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  const handleSignIn = async () => {
    await runAction(async () => {
      const { error } = await signIn(email.trim(), password)
      if (error) setFormError(error.message.replace(/^Password sign-in failed:\s*/i, '') || 'Sign in failed.')
    })
  }

  const handleSignUp = async () => {
    await runAction(async () => {
      const { data, error } = await signUp(email.trim(), password, fullName.trim())
      if (error) {
        if (/\balready exists\b/i.test(error.message)) setFormError('An account with this email already exists. Use the Sign In tab.')
        else setFormError(error.message || 'Could not create the account.')
        return
      }
      // Confirmation enabled: no session until the user clicks the link.
      if (!data.session && data.user?.email_confirmed !== true) {
        setNotice(`We emailed ${email.trim()} a confirmation link. Open it to activate your account.`)
      }
      // Without email confirmation the session lands immediately:
      // nothing else to do here.
    })
  }

  const handleMagicLink = async () => {
    await runAction(async () => {
      const { error } = await requestMagicLink(email.trim())
      if (error) setFormError(error.message || 'Could not send the magic link.')
      else setNotice(`Secure sign-in link sent to ${email.trim()}. It expires shortly.`)
    })
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const passwordValid = password.length >= 6

  const inputClasses =
    'w-full min-h-[44px] px-3.5 rounded-lg bg-pitch-950 border border-pitch-700 text-sm text-slate-100 placeholder:text-slate-600 ' +
    'focus-visible:outline-none focus-visible:border-amber-500/60 focus-visible:ring-2 focus-visible:ring-amber-500/40 transition-colors'
  const labelClasses = 'block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5'
  const primaryBtn =
    'w-full min-h-[48px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed ' +
    'text-pitch-950 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400'

  return (
    <div className="w-full min-h-screen bg-pitch-950 text-slate-100 overflow-x-hidden flex flex-col items-center justify-center px-4 py-10">
      {/* ─── Brand header ─────────────────────────────────── */}
      <div className="flex flex-col items-center text-center animate-fade-in">
        <span
          className="inline-block w-10 h-10 rounded-lg bg-amber-500 flex-shrink-0 mb-4"
          aria-hidden="true"
          style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
        />
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-tight">
          Matchlytics
          <span className="ml-2 text-xs sm:text-sm font-mono font-normal text-slate-500 align-middle">by imortifex</span>
        </h1>
        <p className="mt-2 text-[13px] sm:text-sm text-slate-400 max-w-xs">
          Sign in to access quantitative intelligence and verified models.
        </p>
      </div>

      {/* ─── Auth card (single glassmorphism element) ──────── */}
      <div className="w-full max-w-[400px] mt-6 rounded-2xl bg-pitch-900/70 backdrop-blur-md border border-pitch-700 p-5 sm:p-6 animate-slide-up">
        <div role="tablist" aria-label="Authentication mode" className="grid grid-cols-2 gap-1.5 mb-5 p-1 rounded-xl bg-pitch-950 border border-pitch-800">
          {[
            { id: 'signin', label: 'Sign In' },
            { id: 'signup', label: 'Create Account' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => switchTab(t.id)}
              className={`min-h-[40px] rounded-lg text-[13px] font-semibold transition-colors ${
                tab === t.id ? 'bg-pitch-800 text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {notice ? (
          /* Out-of-band flow feedback: magic link sent, or email to confirm */
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
            <p className="text-[13px] font-medium text-emerald-400">Check your inbox</p>
            <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">{notice}</p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="mt-4 min-h-[36px] px-3.5 rounded-lg border border-pitch-600 bg-pitch-800 text-xs font-semibold text-slate-200 hover:text-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (tab === 'signin') handleSignIn()
              else handleSignUp()
            }}
            className="space-y-4"
          >
            {tab === 'signup' && (
              <div>
                <label htmlFor="lp-name" className={labelClasses}>Full name</label>
                <input
                  id="lp-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Optional"
                  className={inputClasses}
                />
              </div>
            )}

            <div>
              <label htmlFor="lp-email" className={labelClasses}>Email</label>
              <input
                id="lp-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="lp-password" className={labelClasses}>Password</label>
              <input
                id="lp-password"
                type="password"
                autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === 'signin' ? 'Your password' : 'At least 6 characters'}
                className={inputClasses}
              />
            </div>

            {formError && (
              <p role="alert" className="text-xs text-rose-400 leading-relaxed bg-rose-500/[0.07] border border-rose-500/25 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !emailValid || !passwordValid}
              className={primaryBtn}
            >
              {busy ? 'Please wait...' : tab === 'signin' ? 'Sign In' : 'Create Account'}
            </button>

            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-600">
              <span className="h-px bg-pitch-700 flex-1" aria-hidden="true" />
              OR
              <span className="h-px bg-pitch-700 flex-1" aria-hidden="true" />
            </div>

            <button
              type="button"
              onClick={handleMagicLink}
              disabled={busy || !emailValid}
              className="w-full min-h-[44px] px-5 rounded-xl border border-pitch-600 bg-pitch-800 hover:bg-pitch-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              ✉️ Email me a magic link instead
            </button>
          </form>
        )}
      </div>

      {/* ─── Ecosystem + compliance footers ───────────────── */}
      <button
        type="button"
        onClick={handleBackToLanding}
        className="mt-6 min-h-[44px] px-4 rounded-xl text-xs font-mono text-slate-400 hover:text-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        ← Back to imortifex.me
      </button>
      <p className="mt-4 text-[10px] font-mono text-slate-600">Educational &amp; research tool · Bet responsibly · 18+</p>
    </div>
  )
}
