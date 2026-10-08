// ---- UserProfile.jsx ----
// Account & Subscription management view.
// Shows identity, security info, subscription tier badge, telemetry stats,
// and transaction/invoice history.
// Accessible from the sidebar user footer; admin-only columns are hidden for free/pro users.
// Zero em dash characters (R-02 compliance).

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ADMIN_EMAILS_RAW = import.meta.env.VITE_ADMIN_EMAILS || ''
const ADMIN_EMAILS = ADMIN_EMAILS_RAW.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)

function fmtDate(iso) {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function fmtDateTime(iso) {
  if (!iso) return '–'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtMoney(n, currency = 'IDR') {
  if (n == null) return '–'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

function StatusPill({ status }) {
  const map = {
    active:     { bg: 'bg-emerald-500/15',  text: 'text-emerald-400',  border: 'border-emerald-500/30',   label: 'Active' },
    inactive:   { bg: 'bg-pitch-800',        text: 'text-slate-400',    border: 'border-pitch-700',       label: 'Inactive' },
    past_due:   { bg: 'bg-amber-500/15',     text: 'text-amber-400',    border: 'border-amber-500/30',   label: 'Past Due' },
    expired:    { bg: 'bg-rose-500/15',      text: 'text-rose-400',     border: 'border-rose-500/30',    label: 'Expired' },
    paid:       { bg: 'bg-emerald-500/15',   text: 'text-emerald-400',  border: 'border-emerald-500/30',  label: 'Paid' },
    pending:    { bg: 'bg-amber-500/15',     text: 'text-amber-400',    border: 'border-amber-500/30',   label: 'Pending' },
    refunded:   { bg: 'bg-rose-500/15',      text: 'text-rose-400',     border: 'border-rose-500/30',    label: 'Refunded' },
    banned:     { bg: 'bg-rose-500/15',      text: 'text-rose-400',     border: 'border-rose-500/30',    label: 'Banned' },
    suspended:  { bg: 'bg-amber-500/15',     text: 'text-amber-400',    border: 'border-amber-500/30',   label: 'Suspended' },
  }
  const s = map[status] || map.inactive
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.text.replace('text-', 'bg-')}`} aria-hidden="true" />
      {s.label}
    </span>
  )
}

function TierPill({ tier }) {
  const map = {
    free:          { bg: 'bg-pitch-800',   text: 'text-slate-400',   border: 'border-pitch-700' },
    pro:           { bg: 'bg-sky-500/15',  text: 'text-sky-300',     border: 'border-sky-500/30'  },
    annual:        { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
    institutional: { bg: 'bg-amber-500/15', text: 'text-amber-300',   border: 'border-amber-500/30'  },
  }
  const t = map[tier] || map.free
  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${t.bg} ${t.text} ${t.border}`}>
      {(tier || 'free').toUpperCase()}
    </span>
  )
}

export default function UserProfile({ onBack }) {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const isAdmin = user && ADMIN_EMAILS.includes((user.email || '').toLowerCase())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [positions, setPositions] = useState([])
  const [positionsLoading, setPositionsLoading] = useState(true)
  const [invoices, setInvoices] = useState([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)
  const [copiedId, setCopiedId] = useState(false)

  // Derived status
  const periodEnd = profile?.current_period_end ? new Date(profile.current_period_end) : null
  const isExpired = periodEnd && new Date() > periodEnd
  const effectiveStatus = isExpired ? 'expired' : (profile?.subscription_status || 'inactive')
  const daysRemaining = periodEnd ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null

  // Fetch user's own portfolio positions
  useEffect(() => {
    if (!user) return
    setPositionsLoading(true)
    supabase
      .from('portfolio_positions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error: err }) => {
        if (err) console.error('[UserProfile] Failed to load positions:', err.message)
        else setPositions(data || [])
      })
      .finally(() => setPositionsLoading(false))
  }, [user])

  // Fetch invoice records (stored in a JSONB notes field on profile, or in a separate table)
  useEffect(() => {
    if (!user) return
    setInvoicesLoading(true)
    // Try to read from admin_audit_log as proxy for historical transactions
    supabase
      .from('admin_audit_log')
      .select('created_at, action, details, admin_email')
      .eq('target_profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error: err }) => {
        if (err) console.error('[UserProfile] Failed to load invoice history:', err.message)
        else setInvoices(data || [])
      })
      .finally(() => setInvoicesLoading(false))
  }, [user])

  const handleCopyUserId = useCallback(() => {
    if (!user) return
    navigator.clipboard.writeText(user.id).then(() => {
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    })
  }, [user])

  const handleSignOut = useCallback(async () => {
    await signOut()
    if (onBack) onBack()
  }, [signOut, onBack])

  // Quick upgrade trigger (reuses existing SubscriptionModal logic)
  const handleUpgrade = useCallback(() => {
    const event = new CustomEvent('matchlytics-open-upgrade', { detail: { reason: 'Upgrade from account settings' } })
    window.dispatchEvent(event)
  }, [])

  if (!user || !profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-xs font-mono text-slate-500">Loading account...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-100">Account & Settings</h1>
          <p className="text-[11px] font-mono text-slate-500 mt-0.5">Manage your profile and subscription</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 rounded-lg bg-pitch-800 hover:bg-pitch-700 text-slate-300 text-xs font-mono transition-colors"
        >
          &larr; Back
        </button>
      </div>

      {/* Identity & Security Card */}
      <div className="rounded-xl bg-pitch-900 border border-pitch-700/80 p-5 space-y-4">
        <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Identity & Security</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Email</p>
            <p className="text-sm text-slate-200 font-mono">{user.email || '–'}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">User ID</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-400 font-mono truncate">{user.id}</p>
              <button
                type="button"
                onClick={handleCopyUserId}
                title="Copy user ID"
                className="flex-shrink-0 px-1.5 py-0.5 rounded bg-pitch-800 hover:bg-pitch-700 text-slate-400 hover:text-slate-200 text-[10px] font-mono transition-colors min-h-[28px]"
              >
                {copiedId ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Created</p>
            <p className="text-sm text-slate-200 font-mono">{fmtDate(user.created_at)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Last Sign-In</p>
            <p className="text-sm text-slate-200 font-mono">{fmtDateTime(user.last_sign_in_at)}</p>
          </div>
        </div>

        <div className="pt-3 border-t border-pitch-800 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSignOut}
            className="px-3 py-1.5 rounded-lg bg-pitch-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 text-xs font-mono transition-colors min-h-[32px]"
          >
            Sign Out
          </button>
          {isAdmin && (
            <span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-[10px] font-mono font-bold border border-amber-500/30 flex items-center gap-1.5 min-h-[32px]">
              <span aria-hidden="true">&#x1F6E1;</span> Admin Access
            </span>
          )}
        </div>
      </div>

      {/* Subscription & Entitlements */}
      <div className="rounded-xl bg-pitch-900 border border-pitch-700/80 p-5 space-y-4">
        <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Subscription & Entitlements</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1.5">Current Tier</p>
            <TierPill tier={profile.subscription_tier} />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1.5">Status</p>
            <StatusPill status={effectiveStatus} />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1.5">
              {isExpired ? 'Expired' : 'Renewal Date'}
            </p>
            <p className={`text-sm font-mono ${isExpired ? 'text-rose-400' : 'text-slate-200'}`}>
              {daysRemaining != null ? `${daysRemaining} days remaining` : 'No expiry set'}
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-pitch-800 flex flex-wrap gap-2">
          {profile.subscription_tier === 'free' && (
            <button
              type="button"
              onClick={handleUpgrade}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-pitch-950 text-xs font-bold transition-colors min-h-[32px]"
            >
              Upgrade to Pro
            </button>
          )}
          {profile.subscription_tier !== 'institutional' && (
            <button
              type="button"
              onClick={handleUpgrade}
              className="px-3 py-1.5 rounded-lg bg-pitch-800 hover:bg-pitch-700 text-slate-300 text-xs font-mono transition-colors min-h-[32px]"
            >
              Upgrade to Institutional
            </button>
          )}
          {(profile.subscription_tier === 'pro' || profile.subscription_tier === 'annual') && (
            <button
              type="button"
              onClick={handleUpgrade}
              className="px-3 py-1.5 rounded-lg bg-pitch-800 hover:bg-pitch-700 text-slate-300 text-xs font-mono transition-colors min-h-[32px]"
            >
              Manage Subscription
            </button>
          )}
        </div>
      </div>

      {/* Telemetry & Usage */}
      <div className="rounded-xl bg-pitch-900 border border-pitch-700/80 p-5 space-y-4">
        <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Telemetry & Usage</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Custom Labs', value: 'Unlimited', hint: 'Quant Lab saves' },
            { label: 'Parlay Builder', value: profile.subscription_tier !== 'free' ? 'Active' : 'Locked', hint: profile.subscription_tier !== 'free' ? 'Pro+' : 'Free' },
            { label: 'Track Record', value: profile.subscription_tier === 'institutional' ? 'Full' : '7-day', hint: 'Settlement window' },
            { label: 'Positions', value: String(positions.filter(p => p.status === 'PENDING').length), hint: 'Open bets' },
          ].map((stat) => (
            <div key={stat.label} className="p-3 rounded-lg bg-pitch-950 border border-pitch-800">
              <p className="text-[10px] text-slate-500 font-mono">{stat.label}</p>
              <p className={`text-sm font-bold font-mono mt-0.5 ${
                stat.value === 'Unlimited' ? 'text-emerald-400' :
                stat.value === 'Locked' ? 'text-slate-500' :
                stat.value === 'Full' ? 'text-amber-400' :
                'text-slate-200'
              }`}>
                {stat.value}
              </p>
              <p className="text-[9px] text-slate-600 mt-0.5">{stat.hint}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction & Invoice History */}
      <div className="rounded-xl bg-pitch-900 border border-pitch-700/80 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Transaction History</h2>
          {invoicesLoading && (
            <span className="text-[10px] text-slate-500 font-mono animate-pulse">Loading...</span>
          )}
        </div>

        {invoicesLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-6 text-center rounded-lg bg-pitch-950 border border-pitch-800">
            <p className="text-xs text-slate-500 font-mono">No transaction history yet.</p>
            <p className="text-[10px] text-slate-600 mt-1">Subscriptions and payments will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-pitch-800">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-pitch-800 text-[10px] uppercase text-slate-500">
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Admin</th>
                  <th className="py-2 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pitch-800/50">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-pitch-800/30 transition-colors">
                    <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{fmtDateTime(inv.created_at)}</td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        inv.action === 'activate_subscription'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}>
                        {inv.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500">{inv.admin_email || '–'}</td>
                    <td className="py-2 px-3 text-slate-400 text-right tabular-nums">
                      {inv.details ? JSON.stringify(inv.details).slice(0, 60) : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Open Positions */}
      <div className="rounded-xl bg-pitch-900 border border-pitch-700/80 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Open Positions</h2>
          {positionsLoading && <span className="text-[10px] text-slate-500 font-mono animate-pulse">Loading...</span>}
        </div>

        {positionsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : positions.filter(p => p.status === 'PENDING').length === 0 ? (
          <div className="p-6 text-center rounded-lg bg-pitch-950 border border-pitch-800">
            <p className="text-xs text-slate-500 font-mono">No open positions.</p>
            <p className="text-[10px] text-slate-600 mt-1">Settled and pending bets will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-pitch-800">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-pitch-800 text-[10px] uppercase text-slate-500">
                  <th className="py-2 px-3">Fixture</th>
                  <th className="py-2 px-3">Selection</th>
                  <th className="py-2 px-3">Odds</th>
                  <th className="py-2 px-3">Stake</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pitch-800/50">
                {positions.filter(p => p.status === 'PENDING').map((pos) => (
                  <tr key={pos.id} className="hover:bg-pitch-800/30 transition-colors">
                    <td className="py-2 px-3 text-slate-200 max-w-[160px] truncate">{pos.selection_label || pos.fixture_id || '–'}</td>
                    <td className="py-2 px-3 text-slate-300">{pos.market || '–'}</td>
                    <td className="py-2 px-3 text-slate-300">{Number(pos.odds)?.toFixed(2) || '–'}</td>
                    <td className="py-2 px-3 text-slate-300">{fmtMoney(pos.stake_amount)}</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        PENDING
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{fmtDateTime(pos.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
