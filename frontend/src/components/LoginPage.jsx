// ---- LoginPage.jsx ----
// Institutional Terminal Access Gate for Matchlytics by imortifex.
// High-converting fintech dark terminal design tokens.
// Dual behavior: Bottom sheet drawer on mobile (< 768px), centered floating card on desktop (>= 768px).
// Zero em dash characters used (R-02 compliance).
// Zero vendor disclosure: proprietary Matchlytics Auth Gate and Encrypted Session Token.

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const LANDING_LIVE_URL = 'https://imortifex.me/'

function DiamondMark({ size = 28 }) {
  return (
    <span
      className="inline-block bg-amber-500 flex-shrink-0 shadow-sm shadow-amber-500/30"
      style={{
        width: size,
        height: size,
        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
      }}
      aria-hidden="true"
    />
  )
}

export default function LoginPage({ onBackToLanding }) {
  const { signIn, signUp, requestMagicLink } = useAuth()

  const [tab, setTab] = useState('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const [notice, setNotice] = useState(null)

  const isPreviewHost = () => {
    if (typeof window === 'undefined') return false
    const h = window.location.hostname
    return h === 'localhost' || h.startsWith('127.') || h.includes('vercel.app')
  }

  const handleBackToLanding = () => {
    if (onBackToLanding) {
      onBackToLanding()
    } else {
      window.location.assign(LANDING_LIVE_URL)
    }
  }

  const clearFeedback = () => {
    setFormError(null)
    setNotice(null)
  }

  const switchTab = (nextTab) => {
    setTab(nextTab)
    clearFeedback()
  }

  const runAction = async (fn) => {
    setBusy(true)
    clearFeedback()
    try {
      await fn()
    } catch {
      setFormError('Authentication service encountered an error. Please retry.')
    } finally {
      setBusy(false)
    }
  }

  const handleSignIn = async () => {
    await runAction(async () => {
      const { error } = await signIn(email.trim(), password)
      if (error) {
        const msg = error.message || ''
        if (/invalid login credentials/i.test(msg) || /invalid grant/i.test(msg)) {
          setFormError('Invalid access credentials. Please verify your email and password.')
        } else if (/email not confirmed/i.test(msg)) {
          setFormError('Account not yet activated. Please check your inbox for the activation link.')
        } else if (/too many requests/i.test(msg) || /rate limit/i.test(msg)) {
          setFormError('Security threshold reached. Please wait a brief moment before retrying.')
        } else {
          setFormError(msg.replace(/^Password sign-in failed:\s*/i, '') || 'Matchlytics Auth Gate rejected authorization.')
        }
      }
    })
  }

  const handleSignUp = async () => {
    await runAction(async () => {
      const { data, error } = await signUp(email.trim(), password, fullName.trim())
      if (error) {
        const msg = error.message || ''
        if (/already exists/i.test(msg) || /user already registered/i.test(msg)) {
          setFormError('An entitlement with this email already exists. Switch to Sign In.')
        } else if (/password/i.test(msg) && (/short/i.test(msg) || /least 6/i.test(msg))) {
          setFormError('Security criteria not met: password must contain at least 6 characters.')
        } else {
          setFormError(msg || 'Unable to establish new terminal entitlement.')
        }
        return
      }
      if (!data?.session && data?.user?.email_confirmed !== true) {
        setNotice(`Terminal activation token dispatched to ${email.trim()}. Open the secure link to activate your access.`)
      }
    })
  }

  const handleMagicLink = async () => {
    await runAction(async () => {
      const { error } = await requestMagicLink(email.trim())
      if (error) {
        setFormError('Unable to dispatch one-time encrypted access token. Please verify email address.')
      } else {
        setNotice(`Encrypted Session Token dispatched to ${email.trim()}. Open the link to authorize terminal session.`)
      }
    })
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const passwordValid = password.length >= 6

  return (
    <div className="w-full min-h-screen bg-pitch-950 text-slate-100 flex flex-col justify-end md:justify-center items-center px-0 md:px-4 py-0 md:py-10 relative overflow-x-hidden selection:bg-amber-500/30 selection:text-amber-200">
      {/* Background ambient radial glow */}
      <div
        className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/[0.05] via-transparent to-transparent -z-10"
        aria-hidden="true"
      />

      {/* Terminal Access Card / Bottom Sheet Container */}
      <div className="w-full md:max-w-md bg-pitch-950/90 backdrop-blur-xl border-t md:border border-pitch-800 rounded-t-3xl md:rounded-3xl shadow-2xl shadow-black/90 p-6 md:p-8 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] md:pb-8 flex flex-col z-10 animate-slide-up">
        {/* Mobile drawer drag handle */}
        <div className="md:hidden flex justify-center mb-3">
          <div className="w-12 h-1.5 rounded-full bg-slate-700/80" aria-hidden="true" />
        </div>

        {/* Header: Diamond Logo + MATCHLYTICS + Sub-label */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center gap-2.5 mb-2">
            <DiamondMark size={28} />
            <span className="text-base sm:text-lg font-bold tracking-[0.2em] text-white">MATCHLYTICS</span>
          </div>
          <p className="text-xs font-mono font-medium text-amber-400 tracking-wider uppercase">
            Quantitative Terminal Access
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Institutional Access Gate &middot; Encrypted Session Token
          </p>
        </div>

        {/* Mode Switcher Pill Toggle */}
        <div
          role="tablist"
          aria-label="Authentication mode"
          className="grid grid-cols-2 gap-1 mb-5 p-1 rounded-xl bg-pitch-900 border border-pitch-800"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'signin'}
            onClick={() => switchTab('signin')}
            className={`min-h-[44px] rounded-lg text-xs font-mono font-semibold transition-all duration-150 flex items-center justify-center ${
              tab === 'signin'
                ? 'bg-pitch-800 text-amber-400 shadow-sm border border-pitch-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'signup'}
            onClick={() => switchTab('signup')}
            className={`min-h-[44px] rounded-lg text-xs font-mono font-semibold transition-all duration-150 flex items-center justify-center ${
              tab === 'signup'
                ? 'bg-pitch-800 text-amber-400 shadow-sm border border-pitch-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Activate Access
          </button>
        </div>

        {/* Notice feedback state (Token/Link sent) */}
        {notice ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] p-4 text-left animate-fade-in">
            <div className="flex items-center gap-2 text-emerald-400 font-medium text-xs">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Token Dispatched Successfully</span>
            </div>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed font-sans">{notice}</p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="mt-4 min-h-[44px] w-full px-4 rounded-xl border border-pitch-600 bg-pitch-900 text-xs font-semibold text-slate-200 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer"
            >
              Return to Authentication Gate
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
                <label htmlFor="lp-name" className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Institutional Identity / Name
                </label>
                <input
                  id="lp-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Desk Officer / Quantitative Analyst"
                  className="w-full min-h-[48px] px-3.5 rounded-xl bg-[#0d131f] border border-[#1d2536] text-sm text-slate-100 placeholder:text-slate-600 font-sans focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/40 transition-colors"
                />
              </div>
            )}

            <div>
              <label htmlFor="lp-email" className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                Authorized Terminal Email
              </label>
              <input
                id="lp-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@domain.com"
                className="w-full min-h-[48px] px-3.5 rounded-xl bg-[#0d131f] border border-[#1d2536] text-sm text-slate-100 placeholder:text-slate-600 font-mono focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/40 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="lp-password" className="block text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Access Key / Password
                </label>
                {tab === 'signin' && (
                  <button
                    type="button"
                    onClick={handleMagicLink}
                    disabled={busy || !emailValid}
                    className="text-[11px] font-mono text-amber-400/80 hover:text-amber-300 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    Send Token to Email
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="lp-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tab === 'signin' ? '••••••••' : 'Min 6 characters'}
                  className="w-full min-h-[48px] pl-3.5 pr-12 rounded-xl bg-[#0d131f] border border-[#1d2536] text-sm text-slate-100 placeholder:text-slate-600 font-mono focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* High-contrast error banner */}
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed animate-fade-in"
              >
                <svg className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{formError}</span>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={busy || !emailValid || !passwordValid}
              className="w-full min-h-[48px] px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-pitch-950 text-sm font-bold transition-all shadow-md shadow-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 flex items-center justify-center gap-2 cursor-pointer"
            >
              {busy ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-pitch-950" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Authenticating Credentials...</span>
                </>
              ) : tab === 'signin' ? (
                'Authorize Terminal Session'
              ) : (
                'Activate Terminal Entitlement'
              )}
            </button>

            {/* Alternative One-Time Access Token Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleMagicLink}
                disabled={busy || !emailValid}
                className="w-full min-h-[44px] px-4 rounded-xl border border-pitch-700 bg-pitch-900/80 hover:bg-pitch-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-mono text-slate-300 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Request Encrypted Session Token</span>
              </button>
            </div>
          </form>
        )}

        {/* Institutional Disclaimer & Security Seals */}
        <div className="mt-6 pt-5 border-t border-pitch-800/80 text-center space-y-2.5">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-slate-400">
            <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>256-bit Encrypted Session &middot; Zero-Knowledge Entitlements</span>
          </div>
          <p className="text-[10px] font-mono text-slate-600 leading-tight">
            Strictly 18+. Model outputs are mathematical estimates for informational and risk management purposes.
          </p>
        </div>
      </div>

      {/* Return to overview direct link */}
      <div className="p-4 md:mt-4 text-center z-10">
        <a
          href="https://imortifex.me/"
          onClick={(e) => {
            if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
              e.preventDefault()
              handleBackToLanding()
            }
          }}
          className="min-h-[44px] px-4 text-xs font-mono text-slate-400 hover:text-amber-400 transition-colors inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg cursor-pointer"
        >
          <span aria-hidden="true">&larr;</span> Return to Matchlytics Overview
        </a>
      </div>
    </div>
  )
}
