// ---- PWAInstallPrompt.jsx ----
// Polished PWA install prompt for Matchlytics.
// Captures the beforeinstallprompt event and surfaces a sleek, non-intrusive
// install banner. Dismissal persists in localStorage for 30 days.

import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_KEY = 'matchlytics_pwa_install_dismissed'
const DISMISS_DAYS = 30
const DISMISS_MS = DISMISS_DAYS * 24 * 60 * 60 * 1000
const SHOW_AFTER_MS = 8000 // Show after 8 seconds of usage

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || navigator.standalone === true
    || window.innerWidth < 600 && window.innerHeight < 800 // Heuristic for mobile webview
}

function isDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const ts = Number(raw)
    return !isNaN(ts) && Date.now() - ts < DISMISS_MS
  } catch {
    return false
  }
}

function dismissNow() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {}
}

function DiamondMark({ size = 24 }) {
  return (
    <span
      className="inline-block bg-amber-500 flex-shrink-0"
      style={{ width: size, height: size, clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
      aria-hidden="true"
    />
  )
}

export default function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const timerRef = useRef(null)
  const showTimerRef = useRef(null)

  // Mark as mounted after first render
  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-show after delay
  useEffect(() => {
    if (isStandalone() || isDismissed()) {
      setDismissed(true)
      return
    }

    showTimerRef.current = setTimeout(() => {
      if (!isStandalone() && !isDismissed()) {
        setVisible(true)
      }
    }, SHOW_AFTER_MS)

    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current)
    }
  }, [])

  // Listen for install prompt
  useEffect(() => {
    if (isStandalone() || isDismissed()) return

    function onBeforeInstall(e) {
      e.preventDefault()
      setPrompt(e)
      if (!visible && !dismissed) {
        setVisible(true)
      }
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [visible, dismissed])

  const handleDismiss = useCallback(() => {
    dismissNow()
    setDismissed(true)
    setVisible(false)
    setPrompt(null)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!prompt) {
      handleDismiss()
      return
    }

    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') {
        console.info('PWA install accepted')
      }
    } catch (err) {
      console.warn('PWA install failed:', err)
    } finally {
      handleDismiss()
    }
  }, [prompt, handleDismiss])

  if (!mounted || isStandalone() || dismissed) return null

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm animate-slide-up ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      role="alert"
      aria-live="polite"
      aria-label="Install application prompt"
    >
      <div className="bg-pitch-800/95 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-4 shadow-2xl shadow-amber-500/10">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 pt-0.5">
            <DiamondMark size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-100">Install Matchlytics</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Get instant +EV alerts, offline access, and a native app experience.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="flex-shrink-0 p-1.5 -mr-1 -mt-1 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-pitch-700 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Features */}
        <div className="mt-3 pt-3 border-t border-pitch-700/50 flex items-center gap-4 text-[10px] font-mono text-slate-500">
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Instant Alerts
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Offline Access
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Native App
          </span>
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-1 px-3 py-2 rounded-xl bg-pitch-900 hover:bg-pitch-800 text-slate-400 hover:text-slate-200 text-xs font-mono font-medium transition-colors border border-pitch-700"
          >
            Not Now
          </button>
          <button
            type="button"
            onClick={handleInstall}
            className="flex-1 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-pitch-950 text-xs font-bold font-mono transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 flex items-center justify-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Install App
          </button>
        </div>
      </div>
    </div>
  )
}
