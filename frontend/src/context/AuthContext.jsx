// ---- AuthContext.jsx ----
// Supabase authentication state for the app.imortifex.me surface.
//
// Responsibilities:
//   - restore + track the session via onAuthStateChange
//   - load the caller's public.profiles row (subscription tier/status)
//   - listen for live profile writes so a payment fulfilment or manual
//     admin activation unlocks the dashboard without a reload
//   - expose signIn / signUp / signOut / magic-link / refresh helpers
//
// Landing view consumes nothing from here: public reading stays open.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

function getInitialDemoState() {
  if (typeof window === 'undefined') return null
  const demoParam = new URLSearchParams(window.location.search).get('demo')
  if (demoParam) {
    localStorage.setItem('matchlytics_dev_auth', demoParam)
  }
  const activeDemo = demoParam || localStorage.getItem('matchlytics_dev_auth')
  if (!activeDemo) return null
  const isAdmin = activeDemo === 'admin'
  const isFree = activeDemo === 'free'
  const demoUser = {
    id: `demo-${activeDemo}-id`,
    email: isAdmin ? 'admin@imortifex.me' : isFree ? 'free@imortifex.me' : 'pro@imortifex.me',
    user_metadata: { full_name: isAdmin ? 'Principal Quant' : 'Quant Analyst' },
  }
  const demoProfile = {
    id: demoUser.id,
    email: demoUser.email,
    full_name: demoUser.user_metadata.full_name,
    subscription_tier: isAdmin ? 'institutional' : isFree ? 'free' : 'pro',
    subscription_status: isFree ? 'inactive' : 'active',
    is_admin: isAdmin,
    current_period_end: isFree ? null : '2028-12-31T23:59:59Z',
  }
  return { user: demoUser, profile: demoProfile }
}

export function AuthProvider({ children }) {
  const [initialDemo] = useState(getInitialDemoState)
  const [session, setSession] = useState(initialDemo ? { user: initialDemo.user } : null)
  const [user, setUser] = useState(initialDemo ? initialDemo.user : null)
  const [profile, setProfile] = useState(initialDemo ? initialDemo.profile : null)
  const [loading, setLoading] = useState(initialDemo ? false : true)

  // ---- Session tracking ------------------------------------
  useEffect(() => {
    if (initialDemo) return undefined
    let mounted = true

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!mounted) return
        setSession(data.session ?? null)
        setUser(data.session?.user ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false)
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null)
      setUser(nextSession?.user ?? null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // ---- Profile fetch (re-runs on user change) ----------------
  const fetchProfile = useCallback(async (userId) => {
    if (typeof userId === 'string' && userId.startsWith('demo-')) {
      return
    }
    const { data, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (pErr) {
      console.warn('Failed to load profile:', pErr.message)
      setProfile(null)
      return
    }
    setProfile(data)
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }
    fetchProfile(user.id)
  }, [user, fetchProfile])

  // ---- Live subscription state --------------------------------
  // Payment fulfilment updates this row under the service role; the
  // client re-reads it over realtime and the paywall lifts itself.
  useEffect(() => {
    if (!user || (typeof user.id === 'string' && user.id.startsWith('demo-'))) return undefined
    const channel = supabase
      .channel(`profile-subscription-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          if (payload.newType === 'DELETE') setProfile(null)
          else if (payload.new) setProfile(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  // ---- Auth actions --------------------------------------------

  const signIn = useCallback(async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password })
  }, [])

  const signUp = useCallback(async (email, password, fullName) => {
    const redirectUrl = typeof window !== 'undefined' && window.location.hostname.includes('localhost')
      ? `${window.location.origin}/?view=app`
      : 'https://app.imortifex.me/'
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName || '' },
        emailRedirectTo: redirectUrl,
      },
    })
  }, [])

  const requestMagicLink = useCallback(async (email) => {
    const redirectUrl = typeof window !== 'undefined' && window.location.hostname.includes('localhost')
      ? `${window.location.origin}/?view=app`
      : 'https://app.imortifex.me/'
    return supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    })
  }, [])

  const signOut = useCallback(async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('matchlytics_dev_auth')
    }
    const { error: outErr } = await supabase.auth.signOut()
    if (outErr) console.warn('Sign out failed:', outErr.message)
    setSession(null)
    setUser(null)
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(() => {
    const current = user
    if (current) fetchProfile(current.id)
  }, [user, fetchProfile])

  const hasActiveSubscription = profile?.subscription_status === 'active'

  // ---- Subscription expiry check ----------------------------------------
  // current_period_end is the hard deadline; once it passes the tier is
  // treated as expired even if status is still 'active'. This lets us
  // show a countdown without waiting for admin to flip the status column.
  const periodEnd = profile?.current_period_end
    ? new Date(profile.current_period_end)
    : null
  const isExpired = periodEnd && new Date() > periodEnd
  const subscriptionRemaining = periodEnd
    ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null
  const effectiveStatus = isExpired
    ? 'expired'
    : hasActiveSubscription ? 'active' : profile?.subscription_status || 'inactive'

  // ---- Tier model -----------------------------------------------
  // Three tiers: free (today window + basic 1X2 only), pro (monthly
  // pass, +7 day horizon, full feature set), annual (season pass,
  // 30 day horizon + backtest archives). 'institutional' behaves as
  // annual. Everything derives from the single row above.
  const tier = profile?.subscription_tier || 'free'
  const isSubscribed =
    hasActiveSubscription && ['pro', 'annual', 'institutional'].includes(tier)
  const isFree = !isSubscribed
  const isPro = isSubscribed && tier === 'pro'
  const isAnnual = isSubscribed && ['annual', 'institutional'].includes(tier)
  const canAccessWeekly = isPro || isAnnual
  const canAccessMonthly = isAnnual
  const canAccessQuantFeatures = isSubscribed

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      hasActiveSubscription,
      tier,
      isSubscribed,
      isFree,
      isPro,
      isAnnual,
      canAccessWeekly,
      canAccessMonthly,
      canAccessQuantFeatures,
      effectiveStatus,
      subscriptionRemaining,
      isExpired,
      signIn,
      signUp,
      requestMagicLink,
      signOut,
      refreshProfile,
    }),
    [session, user, profile, loading, hasActiveSubscription, tier, isSubscribed, isFree, isPro, isAnnual, canAccessWeekly, canAccessMonthly, canAccessQuantFeatures, effectiveStatus, subscriptionRemaining, isExpired, signIn, signUp, requestMagicLink, signOut, refreshProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Guarded hook: outside a provider the surface behaves as signed-out,
// so a misplaced import cannot crash the landing page.
export function useAuth() {
  const ctx = useContext(AuthContext)
  return ctx ?? {
    session: null,
    user: null,
    profile: null,
    loading: false,
    hasActiveSubscription: false,
    tier: 'free',
    isSubscribed: false,
    isFree: true,
    isPro: false,
    isAnnual: false,
    canAccessWeekly: false,
    canAccessMonthly: false,
    canAccessQuantFeatures: false,
    effectiveStatus: 'inactive',
    subscriptionRemaining: null,
    isExpired: false,
    signIn: async () => ({ data: null, error: new Error('Auth provider missing.') }),
    signUp: async () => ({ data: null, error: new Error('Auth provider missing.') }),
    requestMagicLink: async () => ({ data: null, error: new Error('Auth provider missing.') }),
    signOut: async () => {},
    refreshProfile: () => {},
  }
}
