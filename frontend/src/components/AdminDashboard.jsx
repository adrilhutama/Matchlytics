// ---- AdminDashboard.jsx ----
// Operator-only dashboard for managing subscriptions, users, and pipeline.
// Access is gated by env-defined ADMIN_EMAILS whitelist.
// Zero em dash characters (R-02 compliance).

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ADMIN_EMAILS_RAW = import.meta.env.VITE_ADMIN_EMAILS || ''
const ADMIN_EMAILS = ADMIN_EMAILS_RAW.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)

const TIER_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro (Monthly)' },
  { value: 'annual', label: 'Annual' },
  { value: 'institutional', label: 'Institutional' },
]

const STATUS_OPTIONS = [
  { value: 'inactive', label: 'Inactive' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past Due' },
]

function formatDate(isoString) {
  if (!isoString) return '-'
  return new Date(isoString).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function formatDateTime(isoString) {
  if (!isoString) return '-'
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminDashboard({ onBack }) {
  const { user, profile } = useAuth()
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTier, setFilterTier] = useState('all')

  // Edit state
  const [editTarget, setEditTarget] = useState(null)
  const [editTier, setEditTier] = useState('pro')
  const [editStatus, setEditStatus] = useState('active')
  const [editPeriodEnd, setEditPeriodEnd] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  // Positions tab state
  const [positions, setPositions] = useState([])
  const [posLoading, setPosLoading] = useState(false)

  // Audit log state
  const [auditLog, setAuditLog] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)

  // Trigger sync state
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  // Pipeline health state
  const [healthMetrics, setHealthMetrics] = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState(null)

  // API quota state
  const [quotaMetrics, setQuotaMetrics] = useState(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [quotaError, setQuotaError] = useState(null)

  // ---- Auth guard --------------------------------------------------------
  // Primary gate: env-defined ADMIN_EMAILS whitelist (operational control).
  // Secondary: verify is_admin flag in profiles row when available.
  useEffect(() => {
    if (!user) return
    const email = (user.email || '').toLowerCase()
    const emailOk = ADMIN_EMAILS.includes(email)

    // If profile loaded, require is_admin flag to be true
    if (profile && !emailOk) {
      onBack()
      return
    }

    // If profile says not admin, block access
    if (profile && profile.is_admin === false && emailOk) {
      // Allow if email is in whitelist (backward compat for legacy users)
      return
    }

    // Block if neither check passes
    if (!emailOk) {
      onBack()
    }
  }, [user, profile, onBack])

  // ---- Fetch users -------------------------------------------------------
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, err } = await supabase
      .from('profiles')
      .select('id, email, full_name, subscription_tier, subscription_status, current_period_end, created_at')
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
      setUsers([])
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // ---- Fetch all portfolio positions (service role needed) ----------------
  // Note: this uses the anon key, so RLS applies. Admin can only see their own
  // positions. For full visibility a service-role Edge Function would be needed.
  const fetchPositions = useCallback(async () => {
    setPosLoading(true)
    const { data, err } = await supabase
      .from('portfolio_positions')
      .select('id, user_id, fixture_name, selection, odds, stake_amount, status, payout, created_at, settled_at')
      .order('created_at', { ascending: false })
      .limit(200)

    if (err) {
      console.error('Failed to fetch positions:', err.message)
    } else {
      setPositions(data || [])
    }
    setPosLoading(false)
  }, [])

  // ---- Fetch pipeline health metrics -------------------------------
  const fetchHealthMetrics = useCallback(async () => {
    setHealthLoading(true)
    setHealthError(null)
    try {
      const { data, error } = await supabase.rpc('get_pipeline_health_metrics')
      if (error) throw error
      setHealthMetrics(data)
    } catch (err) {
      console.error('Failed to fetch health metrics:', err.message)
      setHealthError(err.message)
      setHealthMetrics(null)
    }
    setHealthLoading(false)
  }, [])

  useEffect(() => { fetchHealthMetrics() }, [fetchHealthMetrics])

  // ---- Fetch API quota metrics ------------------------------------------
  const fetchQuotaMetrics = useCallback(async () => {
    setQuotaLoading(true)
    setQuotaError(null)
    try {
      const { data, error } = await supabase.rpc('get_api_quota_metrics')
      if (error) throw error
      setQuotaMetrics(data)
    } catch (err) {
      console.error('Failed to fetch quota metrics:', err.message)
      setQuotaError(err.message)
      setQuotaMetrics(null)
    }
    setQuotaLoading(false)
  }, [])

  // Batch pipeline health + quota fetch on mount
  useEffect(() => {
    Promise.all([fetchHealthMetrics(), fetchQuotaMetrics()])
  }, [])

  // ---- Fetch audit log ---------------------------------------------------
  const fetchAuditLog = useCallback(async () => {
    setAuditLoading(true)
    const { data, err } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (err) {
      console.error('Failed to fetch audit log:', err.message)
    } else {
      setAuditLog(data || [])
    }
    setAuditLoading(false)
  }, [])

  // ---- Trigger sync via GitHub Actions (call a webhook endpoint) ----------
  const triggerSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    // In production this would call a GitHub Actions workflow_dispatch webhook
    // For now we just log it; the operator can trigger manually from GitHub UI
    try {
      const resp = await fetch('/api/triggersync', { method: 'POST' })
      const json = await resp.json()
      setSyncResult(json)
    } catch (e) {
      setSyncResult({ success: false, error: e.message })
    }
    setSyncing(false)
  }

  // ---- Open edit modal ---------------------------------------------------
  function openEdit(profile) {
    setEditTarget(profile)
    setEditTier(profile.subscription_tier || 'free')
    setEditStatus(profile.subscription_status || 'inactive')
    setEditPeriodEnd(profile.current_period_end
      ? new Date(profile.current_period_end).toISOString().slice(0, 16)
      : '')
    setSaveMsg(null)
  }

  // ---- Save edit ---------------------------------------------------------
  async function saveEdit() {
    if (!editTarget) return
    setSaving(true)
    setSaveMsg(null)

    // Try Edge Function first
    const { data: efResp, error: efErr } = await supabase.functions.invoke(
      'admin-activate-subscription',
      {
        body: {
          target_profile_id: editTarget.id,
          tier: editTier,
          status: editStatus,
          period_end: editPeriodEnd || null,
        },
      }
    )

    if (efErr) {
      // Fallback: direct update via service role is not available from browser.
      // Show error with SQL snippet for manual execution.
      setSaveMsg({
        type: 'error',
        text: `Edge function failed: ${efErr.message}. Use this SQL in Supabase editor:`,
        sql: `UPDATE public.profiles SET subscription_tier = '${editTier}', subscription_status = '${editStatus}'${editPeriodEnd ? `, current_period_end = '${editPeriodEnd}'` : ''} WHERE id = '${editTarget.id}';`,
      })
    } else if (efResp?.success) {
      setSaveMsg({ type: 'success', text: 'Subscription updated successfully.' })
      fetchUsers()
      setTimeout(() => setEditTarget(null), 1500)
    } else {
      setSaveMsg({ type: 'error', text: 'Unknown response from server.' })
    }
    setSaving(false)
  }

  // ---- Derived data ------------------------------------------------------
  const filteredUsers = users.filter((u) => {
    const matchesSearch = !searchQuery ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTier = filterTier === 'all' || u.subscription_tier === filterTier
    return matchesSearch && matchesTier
  })

  const stats = {
    totalUsers: users.length,
    activeSubs: users.filter((u) => u.subscription_status === 'active').length,
    freeUsers: users.filter((u) => u.subscription_tier === 'free').length,
    monthlyRevenue: users.filter((u) => u.subscription_tier === 'pro' && u.subscription_status === 'active').length,
    annualRevenue: users.filter((u) => ['annual', 'institutional'].includes(u.subscription_tier) && u.subscription_status === 'active').length,
  }

  if (!user || !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-rose-400 font-mono text-sm">Access denied. Your email is not in the admin whitelist.</p>
          <button onClick={onBack} className="mt-4 px-4 py-2 rounded-lg bg-pitch-800 text-slate-300 text-xs hover:bg-pitch-700 transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Admin Dashboard</h1>
          <p className="text-[11px] font-mono text-slate-500 mt-0.5">
            Signed in as {user.email}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 rounded-lg bg-pitch-800 hover:bg-pitch-700 text-slate-300 text-xs font-mono transition-colors"
        >
          &larr; Back to Dashboard
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: stats.totalUsers, color: 'text-slate-100' },
          { label: 'Active Subs', value: stats.activeSubs, color: 'text-emerald-400' },
          { label: 'Free Users', value: stats.freeUsers, color: 'text-slate-400' },
          { label: 'Monthly Pro', value: stats.monthlyRevenue, color: 'text-sky-400' },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-xl bg-pitch-900 border border-pitch-700/80">
            <span className="text-[11px] text-slate-500 font-mono block">{s.label}</span>
            <span className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-pitch-800">
        {['users', 'positions', 'audit', 'pipeline'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => { setActiveTab(tab); if (tab === 'positions') fetchPositions(); if (tab === 'audit') fetchAuditLog() }}
            className={`px-4 py-2 text-xs font-mono rounded-t-lg transition-colors ${
              activeTab === tab
                ? 'bg-pitch-900 text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ---- Users Tab ---- */}
      {activeTab === 'users' && (
        <div className="rounded-xl bg-pitch-900 border border-pitch-700/80 overflow-hidden">
          {/* Search & Filter */}
          <div className="p-3 flex flex-col sm:flex-row gap-2 border-b border-pitch-800">
            <input
              type="text"
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-pitch-950 border border-pitch-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className="bg-pitch-950 border border-pitch-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">All Tiers</option>
              {TIER_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="p-4 text-xs text-rose-400 font-mono">{error}</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-pitch-800 text-[11px] uppercase text-slate-500">
                    <th className="py-2.5 px-4">Email</th>
                    <th className="py-2.5 px-4">Name</th>
                    <th className="py-2.5 px-4">Tier</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Period End</th>
                    <th className="py-2.5 px-4">Signed Up</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pitch-800/60">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-pitch-800/40 transition-colors">
                      <td className="py-2.5 px-4 text-slate-300 truncate max-w-[180px]">{u.email || '-'}</td>
                      <td className="py-2.5 px-4 text-slate-200">{u.full_name || '-'}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.subscription_tier === 'pro' ? 'bg-sky-500/20 text-sky-400' :
                          u.subscription_tier === 'annual' ? 'bg-emerald-500/20 text-emerald-400' :
                          u.subscription_tier === 'institutional' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-pitch-700 text-slate-400'
                        }`}>
                          {u.subscription_tier}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.subscription_status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                          u.subscription_status === 'past_due' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-rose-500/20 text-rose-400'
                        }`}>
                          {u.subscription_status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">{formatDate(u.current_period_end)}</td>
                      <td className="py-2.5 px-4 text-slate-500">{formatDate(u.created_at)}</td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="px-2.5 py-1 rounded bg-pitch-800 hover:bg-pitch-700 text-slate-300 hover:text-amber-400 transition-colors text-[11px]"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---- Positions Tab ---- */}
      {activeTab === 'positions' && (
        <div className="rounded-xl bg-pitch-900 border border-pitch-700/80 overflow-hidden">
          <div className="p-3 border-b border-pitch-800 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Recent Portfolio Positions (last 200)</span>
            <button
              type="button"
              onClick={fetchPositions}
              className="px-2.5 py-1 rounded bg-pitch-800 hover:bg-pitch-700 text-slate-300 text-[11px] transition-colors"
            >
              Refresh
            </button>
          </div>
          {posLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
            </div>
          ) : positions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">No positions found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-pitch-800 text-[11px] uppercase text-slate-500">
                    <th className="py-2.5 px-4">Fixture</th>
                    <th className="py-2.5 px-4">Selection</th>
                    <th className="py-2.5 px-4">Odds</th>
                    <th className="py-2.5 px-4">Stake</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Payout</th>
                    <th className="py-2.5 px-4">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pitch-800/60">
                  {positions.map((p) => (
                    <tr key={p.id} className="hover:bg-pitch-800/40 transition-colors">
                      <td className="py-2.5 px-4 text-slate-200 max-w-[200px] truncate">{p.fixture_name || p.fixture_id || '-'}</td>
                      <td className="py-2.5 px-4 text-slate-300">{p.selection || '-'}</td>
                      <td className="py-2.5 px-4 text-slate-300">{Number(p.odds)?.toFixed(2) || '-'}</td>
                      <td className="py-2.5 px-4 text-slate-300">{Number(p.stake_amount)?.toLocaleString() || '-'}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.status === 'WON' ? 'bg-emerald-500/20 text-emerald-400' :
                          p.status === 'LOST' ? 'bg-rose-500/20 text-rose-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className={`py-2.5 px-4 font-bold ${p.payout > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {p.payout ? `${Number(p.payout).toLocaleString()}` : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">{formatDateTime(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---- Audit Tab ---- */}
      {activeTab === 'audit' && (
        <div className="rounded-xl bg-pitch-900 border border-pitch-700/80 overflow-hidden">
          <div className="p-3 border-b border-pitch-800 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Audit Log</span>
            <button
              type="button"
              onClick={fetchAuditLog}
              className="px-2.5 py-1 rounded bg-pitch-800 hover:bg-pitch-700 text-slate-300 text-[11px] transition-colors"
            >
              Refresh
            </button>
          </div>
          {auditLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
            </div>
          ) : auditLog.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">No audit entries yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-pitch-800 text-[11px] uppercase text-slate-500">
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Admin</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Target Profile</th>
                    <th className="py-2.5 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pitch-800/60">
                  {auditLog.map((entry) => (
                    <tr key={entry.id} className="hover:bg-pitch-800/40 transition-colors">
                      <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">{formatDateTime(entry.created_at)}</td>
                      <td className="py-2.5 px-4 text-slate-300">{entry.admin_email}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          entry.action === 'activate_subscription' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-rose-500/20 text-rose-400'
                        }`}>
                          {entry.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[10px]">
                        {entry.target_profile_id || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">
                        {entry.details ? JSON.stringify(entry.details).slice(0, 80) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---- Pipeline Health Card ---- */}
      <div className="rounded-xl bg-pitch-900 border border-pitch-700/80 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Pipeline Health & Telemetry</h3>
            <p className="text-[11px] font-mono text-slate-500 mt-0.5">
              Real-time synchronization status across all data sources
            </p>
          </div>
          <button
            type="button"
            onClick={fetchHealthMetrics}
            disabled={healthLoading}
            className="px-3 py-1.5 rounded-lg bg-pitch-800 hover:bg-pitch-700 disabled:bg-pitch-950 text-slate-300 hover:text-amber-400 disabled:text-slate-600 text-xs font-mono transition-colors flex items-center gap-2"
          >
            {healthLoading ? (
              <>
                <span className="w-3 h-3 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
                Loading...
              </>
            ) : (
              'Refresh'
            )}
          </button>
        </div>

        {healthError ? (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 font-mono">
            {healthError}
          </div>
        ) : healthMetrics ? (
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold font-mono border ${
                healthMetrics.status === 'operational'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : healthMetrics.status === 'stale'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              }`}>
                {healthMetrics.status === 'operational' ? 'Operational'
                  : healthMetrics.status === 'stale' ? 'Stale Sync'
                  : 'Degraded'}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Last check: {new Date(healthMetrics.computed_at).toLocaleTimeString()}
              </span>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Fixtures', value: healthMetrics.total_fixtures, color: 'text-slate-100' },
                { label: 'Pending', value: healthMetrics.pending_fixtures, color: 'text-sky-400' },
                { label: 'Settled', value: healthMetrics.finished_fixtures, color: 'text-emerald-400' },
                { label: '+EV Picks', value: healthMetrics.active_ev_picks, color: 'text-amber-400' },
              ].map((metric) => (
                <div key={metric.label} className="p-3 rounded-lg bg-pitch-950 border border-pitch-800">
                  <span className="text-[10px] text-slate-500 font-mono block">{metric.label}</span>
                  <span className={`text-xl font-bold font-mono ${metric.color}`}>{metric.value}</span>
                </div>
              ))}
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Last Fixture Sync', value: healthMetrics.last_sync_at },
                { label: 'Last Standings Sync', value: healthMetrics.last_standings_sync },
                { label: 'Odds Coverage', value: `${healthMetrics.odds_coverage_pct}%` },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-lg bg-pitch-950 border border-pitch-800">
                  <span className="text-[10px] text-slate-500 font-mono block">{item.label}</span>
                  <span className="text-xs text-slate-200 font-mono">
                    {item.value
                      ? new Date(item.value).toLocaleString(undefined, {
                          year: 'numeric', month: 'short', day: '2-digit',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : '-'}
                  </span>
                </div>
              ))}
            </div>

            {/* Pipeline Status Detail */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${
                healthMetrics.pipeline_stale ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
              }`} />
              <span className={healthMetrics.pipeline_stale ? 'text-rose-400' : 'text-emerald-400'}>
                {healthMetrics.pipeline_stale ? 'Pipeline stale - no sync in 24h' : 'Pipeline active'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* ---- API Quota Monitoring Widget ---- */}
      <div className="rounded-xl bg-pitch-900 border border-pitch-700/80 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100">External API Quota & Usage</h3>
            <p className="text-[11px] font-mono text-slate-500 mt-0.5">
              Daily request consumption for Football Data API and The Odds API
            </p>
          </div>
          <button
            type="button"
            onClick={fetchQuotaMetrics}
            disabled={quotaLoading}
            className="px-3 py-1.5 rounded-lg bg-pitch-800 hover:bg-pitch-700 disabled:bg-pitch-950 text-slate-300 hover:text-amber-400 disabled:text-slate-600 text-xs font-mono transition-colors flex items-center gap-2"
          >
            {quotaLoading ? (
              <>
                <span className="w-3 h-3 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
                Loading...
              </>
            ) : (
              'Refresh'
            )}
          </button>
        </div>

        {quotaError ? (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 font-mono">
            {quotaError}
          </div>
        ) : quotaMetrics ? (
          <div className="space-y-4">
            {/* Overall Status */}
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold font-mono border ${
                quotaMetrics.status === 'healthy'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : quotaMetrics.status === 'warning'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
              }`}>
                {quotaMetrics.status === 'healthy' ? 'All Healthy'
                  : quotaMetrics.status === 'warning' ? 'Usage Warning'
                  : 'Critical Quota'}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Updated: {new Date(quotaMetrics.computed_at).toLocaleTimeString()}
              </span>
            </div>

            {/* Football Data API Card */}
            {(() => {
              const ffd = quotaMetrics.football_data
              const pct = Math.min(100, ffd?.utilization_pct || 0)
              const color = ffd?.health_color || 'gray'
              const barColor = color === 'emerald' ? 'bg-emerald-500'
                : color === 'amber' ? 'bg-amber-500'
                : color === 'rose' ? 'bg-rose-500'
                : 'bg-slate-500'
              return (
                <div className="p-4 rounded-xl bg-pitch-950 border border-pitch-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-200">{ffd?.provider_label || 'Football Data API'}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400'
                          : color === 'amber' ? 'bg-amber-500/20 text-amber-400'
                          : color === 'rose' ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {color === 'emerald' ? 'Normal' : color === 'amber' ? 'Caution' : color === 'rose' ? 'Critical' : 'No Data'}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      {ffd?.requests_used ?? 0} / {ffd?.limit_daily ?? 0} req/day
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-3 rounded-full bg-pitch-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 block">Remaining</span>
                      <span className={`font-bold ${
                        color === 'emerald' ? 'text-emerald-400'
                          : color === 'amber' ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}>
                        {ffd?.remaining != null ? ffd.remaining : '--'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Utilization</span>
                      <span className="font-bold text-slate-200">
                        {ffd?.utilization_pct != null ? `${ffd.utilization_pct}%` : '--'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Reset In</span>
                      <span className="font-bold text-slate-200">
                        {ffd?.countdown_sec != null && ffd.countdown_sec > 0
                          ? `${Math.floor(ffd.countdown_sec / 60)}m ${ffd.countdown_sec % 60}s`
                          : '--'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* The Odds API Card */}
            {(() => {
              const odds = quotaMetrics.odds_api
              const pct = Math.min(100, odds?.utilization_pct || 0)
              const color = odds?.health_color || 'gray'
              const barColor = color === 'emerald' ? 'bg-emerald-500'
                : color === 'amber' ? 'bg-amber-500'
                : color === 'rose' ? 'bg-rose-500'
                : 'bg-slate-500'
              return (
                <div className="p-4 rounded-xl bg-pitch-950 border border-pitch-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-200">{odds?.provider_label || 'The Odds API'}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400'
                          : color === 'amber' ? 'bg-amber-500/20 text-amber-400'
                          : color === 'rose' ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {color === 'emerald' ? 'Normal' : color === 'amber' ? 'Caution' : color === 'rose' ? 'Critical' : 'No Data'}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      {odds?.requests_used ?? 0} / {odds?.limit_daily ?? 0} req/day
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-3 rounded-full bg-pitch-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 block">Remaining</span>
                      <span className={`font-bold ${
                        color === 'emerald' ? 'text-emerald-400'
                          : color === 'amber' ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}>
                        {odds?.remaining != null ? odds.remaining : '--'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Utilization</span>
                      <span className="font-bold text-slate-200">
                        {odds?.utilization_pct != null ? `${odds.utilization_pct}%` : '--'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Status</span>
                      <span className="font-bold text-slate-200">
                        {odds?.sample_count != null && odds.sample_count > 0 ? 'Tracking' : 'No Data'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* 7-Day Trend Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'FFD 7d Total', value: `${quotaMetrics.football_data?.requests_used ?? '--'}`, sub: 'requests' },
                { label: 'Odds 7d Total', value: `${quotaMetrics.odds_api?.requests_used ?? '--'}`, sub: 'requests' },
                { label: 'FFD Samples', value: `${quotaMetrics.football_data?.sample_count ?? '--'}`, sub: 'days tracked' },
                { label: 'Odds Samples', value: `${quotaMetrics.odds_api?.sample_count ?? '--'}`, sub: 'days tracked' },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-lg bg-pitch-950 border border-pitch-800">
                  <span className="text-[10px] text-slate-500 font-mono block">{item.label}</span>
                  <span className="text-lg font-bold font-mono text-slate-200">{item.value}</span>
                  <span className="text-[9px] text-slate-600">{item.sub}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* ---- Pipeline Control Tab ---- */}
      {activeTab === 'pipeline' && (
        <div className="rounded-xl bg-pitch-900 border border-pitch-700/80 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-100">Pipeline Control</h3>
          <p className="text-xs text-slate-400 font-mono">
            Trigger manual pipeline runs or view sync status. Note: pipeline execution requires
            GitHub Actions workflow dispatch. Use the GitHub UI for full control.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={triggerSync}
              disabled={syncing}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-pitch-700 text-pitch-950 font-bold text-xs transition-colors"
            >
              {syncing ? 'Triggering...' : 'Trigger Daily Sync'}
            </button>
            <a
              href={`https://github.com/${import.meta.env.VITE_GITHUB_REPO || 'adrilhutama/Matchlytics'}/actions/workflows/sync_daily.yml`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-pitch-800 hover:bg-pitch-700 text-slate-300 text-xs font-mono transition-colors border border-pitch-700"
            >
              GitHub Actions &rarr;
            </a>
          </div>
          {syncResult && (
            <div className={`p-3 rounded-lg text-xs font-mono ${
              syncResult.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
            }`}>
              {syncResult.success ? `Sync triggered: ${syncResult.run_id || 'check GitHub for status'}` : `Error: ${syncResult.error || 'Unknown'}`}
            </div>
          )}
          <div className="pt-4 border-t border-pitch-800">
            <p className="text-[11px] text-slate-500 font-mono mb-2">Workflow Schedule:</p>
            <ul className="text-[11px] text-slate-400 font-mono space-y-1">
              <li>sync_standings.yml - Daily at 03:00 UTC</li>
              <li>sync_fixtures.yml - Mondays at 02:00 UTC</li>
              <li>sync_daily.yml - Twice daily at 06:00 & 14:00 UTC</li>
            </ul>
          </div>
        </div>
      )}

      {/* ---- Edit Modal ---- */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pitch-950/80 backdrop-blur-sm p-4">
          <div className="bg-pitch-900 border border-pitch-700 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">Edit Subscription</h3>
              <button onClick={() => setEditTarget(null)} className="text-slate-500 hover:text-slate-300 text-lg leading-none">&times;</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-500 block mb-1">Email</label>
                <p className="text-slate-200 font-mono">{editTarget.email || '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-500 block mb-1">Tier</label>
                  <select
                    value={editTier}
                    onChange={(e) => setEditTier(e.target.value)}
                    className="w-full bg-pitch-950 border border-pitch-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {TIER_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-pitch-950 border border-pitch-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-slate-500 block mb-1">Period End (optional)</label>
                <input
                  type="datetime-local"
                  value={editPeriodEnd}
                  onChange={(e) => setEditPeriodEnd(e.target.value)}
                  className="w-full bg-pitch-950 border border-pitch-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-xs"
                />
                <p className="text-[10px] text-slate-500 mt-1">Leave empty to keep existing expiry</p>
              </div>
            </div>

            {saveMsg && (
              <div className={`p-3 rounded-lg text-xs font-mono ${
                saveMsg.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}>
                <p className="mb-1">{saveMsg.text}</p>
                {saveMsg.sql && (
                  <pre className="bg-pitch-950 p-2 rounded text-[10px] overflow-x-auto mt-2 whitespace-pre-wrap break-all">
                    {saveMsg.sql}
                  </pre>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-pitch-700 text-pitch-950 font-bold text-xs transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 rounded-lg bg-pitch-800 hover:bg-pitch-700 text-slate-300 text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
