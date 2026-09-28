// ---- InstallPrompt.jsx ----
// Captures the beforeinstallprompt event and surfaces a non-intrusive
// install banner on Android/Chrome while offering an iOS tap-hint.
// Dismissal persists in localStorage for 7 days.
// Desktop Sidebar renders a compact "Install App" trigger when the prompt
// fires; mobile users see a floating pill anchored to the bottom nav area.

import { useState, useEffect, useRef, useCallback } from 'react'

const INSTALL_PROMPT_KEY = 'matchlytics_install_prompt_dismissed'
const DISMISS_DAYS = 7
const DISMISS_MS = DISMISS_DAYS * 24 * 60 * 60 * 1000

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || navigator.standalone === true
}

function isDismissed() {
  try {
    const raw = localStorage.getItem(INSTALL_PROMPT_KEY)
    if (!raw) return false
    const ts = Number(raw)
    return !isNaN(ts) && Date.now() - ts < DISMISS_MS
  } catch {
    return false
  }
}

function dismissNow() {
  try {
    localStorage.setItem(INSTALL_PROMPT_KEY, String(Date.now()))
  } catch {}
}

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const iosHintRef = useRef(false)
  const timerRef = useRef(null)

  const isIOSDevice = isIOS()
  const standalone = isStandalone()

  // On mount: if already dismissed or running standalone, do nothing.
  // Otherwise listen for the native beforeinstallprompt.
  useEffect(() => {
    if (standalone || isDismissed()) {
      setDismissed(true)
      return
    }

    function onBeforeInstall(e) {
      e.preventDefault()
      setPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // iOS standalone check refresh after a short delay
    timerRef.current = setTimeout(() => {
      if (!isStandalone() && !isDismissed() && isIOS()) {
        iosHintRef.current = true
      }
    }, 2000)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [standalone])

  const handleDismiss = useCallback(() => {
    dismissNow()
    setDismissed(true)
    setVisible(false)
    setPrompt(null)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setPrompt(null)
      setVisible(false)
    }
    // Dismiss regardless of choice
    dismissNow()
    setDismissed(true)
  }, [prompt])

  // Show the Android banner once the prompt arrives
  useEffect(() => {
    if (prompt && !dismissed) setVisible(true)
  }, [prompt, dismissed])

  // iOS hint visibility (shown only when prompt never fired AND not standalone)
  const showIOSHint = isIOSDevice && !standalone && !dismissed && !prompt

  if (dismissed && !showIOSHint) return null

  if (showIOSHint) {
    return (
      <div
        className="lg:hidden fixed bottom-16 inset-x-3 z-40 animate-slide-up"
        role="alert"
        aria-label="iOS install instruction"
      >
        <div className="bg-pitch-800 border border-pitch-700 rounded-2xl p-3 flex items-start gap-3 shadow-2xl">
          <span className="text-lg leading-none mt-0.5" aria-hidden="true">🍎</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200">Install Matchlytics</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tap Share <span className="text-amber-400 font-mono">↑</span> then{' '}
              <span className="text-amber-400 font-mono">Add to Home Screen</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install hint"
            className="p-1.5 -mr-1 -mt-1 text-slate-500 hover:text-slate-300 rounded-lg transition-colors min-h-[32px]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  if (!prompt || !visible) return null

  return (
    <div
      className="lg:hidden fixed bottom-16 inset-x-3 z-40 animate-slide-up"
      role="alert"
      aria-live="polite"
    >
      <div className="bg-pitch-800 border border-amber-500/40 rounded-2xl p-3.5 flex items-center gap-3 shadow-2xl">
        <span className="text-xl leading-none" aria-hidden="true">⚡</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-100">Install Matchlytics App</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Add to home screen for offline access and push notifications.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-2.5 py-1.5 min-h-[36px] text-xs text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
          >
            Later
          </button>
          <button
            type="button"
            onClick={handleInstall}
            className="px-3 py-1.5 min-h-[36px] rounded-xl bg-amber-500 hover:bg-amber-400 text-pitch-950 text-xs font-bold transition-all shadow"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  )
}
