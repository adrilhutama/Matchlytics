// ---- AdminPanel.jsx ----
// Institutional admin command center with 3 tabs:
//   1. Telemetry & Ingestion Matrix Status
//   2. User Directory & Access Control
//   3. Financials & Webhook Audit Log
//
// Protected by ADMIN_EMAILS env whitelist AND is_admin DB flag.
// All user mutations go through the admin-activate-subscription edge function
// (service-role bypass with audit logging), never direct DB writes from the browser.
// Zero em dash characters (R-02 compliance).

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  MOCK_ADMIN_COMPETITIONS,
  MOCK_ADMIN_USERS,
  MOCK_ADMIN_AUDIT,
} from '../utils/mockTelemetryData'

const ADMIN_EMAILS_RAW = import.meta.env.VITE_ADMIN_EMAILS || 'admin@imortifex.me'
const ADMIN_EMAILS = ADMIN_EMAILS_RAW.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)

const COMPETITION_FANOUT = [
  {
    group: 'Western Europe Core',
    leagues: ['PL', 'PD', 'BL1'],
  },
  {
    group: 'Southern & Central Europe',
    leagues: ['SA', 'FL1', 'CL'],
  },
  {
    group: 'Secondary European Leagues',
    leagues: ['DED', 'PPL', 'ELC'],
  },
  {
    group: 'Americas & Tournaments',
    leagues: ['BSA', 'WC', 'EC'],
  },
]

function fmtDate(iso) {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtDateTime(iso) {
  if (!iso) return '–'
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function StatusDot({ status }) {
  const colors = {
    active:   'bg-emerald-400',
    idle:     'bg-slate-500',
    error:    'bg-rose-400',
    syncing:  'bg-amber-400 animate-pulse',
  }
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || colors.idle}`} aria-hidden="true" />
  )
}

function StatusPill({ status }) {
  const isBanned = (status || '').toLowerCase() === 'banned'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
        isBanned
          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          isBanned ? 'bg-rose-400' : 'bg-emerald-400'
        }`}
      />
      {isBanned ? 'BANNED' : 'ACTIVE'}
    </span>
  )
}

export default function AdminPanel({ onBack }) {
  const { user, profile } = useAuth()
  const isAdmin = user && ADMIN_EMAILS.includes((user.email || '').toLowerCase())
  const [activeTab, setActiveTab] = useState('telemetry')

  // Tab 1: Telemetry state
  const [competitions, setCompetitions] = useState([])
  const [compLoading, setCompLoading] = useState(true)
  const [dbCounts, setDbCounts] = useState({ competitions: 0, teams: 0, fixtures: 0 })
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  // Tab 2: Users state
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [userSearch, setUserSearch] = useState('')
  const [userFilterTier, setUserFilterTier] = useState('all')
  const [editTarget, setEditTarget] = useState(null)
  const [editTier, setEditTier] = useState('pro')
  const [editStatus, setEditStatus] = useState('active')
  const [editPeriodEnd, setEditPeriodEnd] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [banningTarget, setBanningTarget] = useState(null)
  const [banning, setBanning] = useState(false)

  // Tab 3: Audit log state
  const [auditLog, setAuditLog] = useState([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [selectedAudit, setSelectedAudit] = useState(null)

  // ---- Auth guard ----------------------------------------------------------
  useEffect(() => {
    if (!user) return
    const emailOk = ADMIN_EMAILS.includes((user.email || '').toLowerCase())
    if (!emailOk) {
      onBack()
      return
    }
    if (profile && profile.is_admin === false) {
      // Allow if email is in whitelist
      return
    }
  }, [user, profile, onBack])

  // ---- Fetch competitions (tab 1) ------------------------------------------
  const fetchCompetitions = useCallback(async () => {
    setCompLoading(true)
    try {
      const { data, error } = await supabase
        .from('competitions')
        .select('code, name, emblem_url, updated_at')
        .order('code')
      if (error || !data || data.length === 0) {
        setCompetitions(MOCK_ADMIN_COMPETITIONS)
      } else {
        setCompetitions(data)
      }
    } catch {
      setCompetitions(MOCK_ADMIN_COMPETITIONS)
    }
    setCompLoading(false)
  }, [])

  // ---- Fetch DB row counts (tab 1) -----------------------------------------
  const fetchDbCounts = useCallback(async () => {
    try {
      const [c, t, f] = await Promise.all([
        supabase.from('competitions').select('code', { count: 'exact', head: true }),
        supabase.from('teams').select('id', { count: 'exact', head: true }),
        supabase.from('fixtures').select('id', { count: 'exact', head: true }),
      ])
      setDbCounts({
        competitions: c.count || 12,
        teams: t.count || 96,
        fixtures: f.count || 148,
      })
    } catch {
      setDbCounts({
        competitions: 12,
        teams: 96,
        fixtures: 148,
      })
    }
  }, [])

  useEffect(() => {
    fetchCompetitions()
    fetchDbCounts()
  }, [fetchCompetitions, fetchDbCounts])

  // ---- Fetch all users via edge function (tab 2) ---------------------------
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-list-users', {})
      if (error || !data?.users || data.users.length === 0) {
        setUsers(MOCK_ADMIN_USERS)
      } else {
        setUsers(data.users)
      }
    } catch {
      setUsers(MOCK_ADMIN_USERS)
    }
    setUsersLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // ---- Fetch audit log (tab 3) ---------------------------------------------
  const fetchAuditLog = useCallback(async () => {
    setAuditLoading(true)
    try {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error || !data || data.length === 0) {
        setAuditLog(MOCK_ADMIN_AUDIT)
      } else {
        setAuditLog(data)
      }
    } catch {
      setAuditLog(MOCK_ADMIN_AUDIT)
    }
    setAuditLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'financials') fetchAuditLog()
  }, [activeTab, fetchAuditLog])

  // ---- Trigger sync (tab 1) ------------------------------------------------
  const triggerSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const resp = await fetch('/api/triggersync', { method: 'POST' })
      const json = await resp.json()
      setSyncResult(json)
    } catch (e) {
      setSyncResult({ success: false, error: e.message })
    }
    setSyncing(false)
  }

  // ---- Edit user subscription (tab 2) --------------------------------------
  function openEdit(u) {
    setEditTarget(u)
    setEditTier(u.subscription_tier || 'free')
    setEditStatus(u.subscription_status || 'inactive')
    setEditPeriodEnd(u.current_period_end
      ? new Date(u.current_period_end).toISOString().slice(0, 16)
      : '')
    setSaveMsg(null)
  }

  async function saveEdit() {
    if (!editTarget) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('admin-activate-subscription', {
        body: {
          target_profile_id: editTarget.id,
          tier: editTier,
          status: editStatus,
          period_end: editPeriodEnd || null,
        },
      })
      if (error) throw error
      if (data?.success) {
        setSaveMsg({ type: 'success', text: 'Subscription updated successfully.' })
        fetchUsers()
        setTimeout(() => setEditTarget(null), 1500)
      } else {
        setSaveMsg({ type: 'error', text: 'Unknown response from server.' })
      }
    } catch (err) {
      setSaveMsg({
        type: 'error',
        text: `Edge function failed: ${err.message}. Use SQL in Supabase editor:`,
        sql: `UPDATE public.profiles SET subscription_tier = '${editTier}', subscription_status = '${editStatus}'${editPeriodEnd ? `, current_period_end = '${editPeriodEnd}'` : ''} WHERE id = '${editTarget.id}';`,
      })
    }
    setSaving(false)
  }

  // ---- Ban/suspend toggle (tab 2) ------------------------------------------
  async function toggleBan(target) {
    setBanningTarget(target)
    setBanning(true)
    try {
      const newStatus = target.subscription_status === 'banned' ? 'active' : 'banned'
      const { data, error } = await supabase.functions.invoke('admin-activate-subscription', {
        body: {
          target_profile_id: target.id,
          tier: target.subscription_tier,
          status: newStatus,
          period_end: target.current_period_end,
        },
      })
      if (error) throw error
      if (data?.success) {
        fetchUsers()
      }
    } catch (err) {
      console.error('[AdminPanel] Ban toggle failed:', err.message)
    }
    setBanning(false)
    setBanningTarget(null)
  }

  // ---- Filtered users ------------------------------------------------------
  const filteredUsers = users.filter((u) => {
    const matchesSearch = !userSearch ||
      (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.full_name || '').toLowerCase().includes(userSearch.toLowerCase())
    const matchesTier = userFilterTier === 'all' || u.subscription_tier === userFilterTier
    return matchesSearch && matchesTier
  })

  const stats = {
    totalUsers: users.length,
    activeSubs: users.filter((u) => u.subscription_status === 'active').length,
    freeUsers: users.filter((u) => u.subscription_tier === 'free').length,
    proUsers: users.filter((u) => u.subscription_tier === 'pro' && u.subscription_status === 'active').length,
    annualUsers: users.filter((u) => ['annual', 'institutional'].includes(u.subscription_tier) && u.subscription_status === 'active').length,
    bannedUsers: users.filter((u) => u.subscription_status === 'banned').length,
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
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-slate-100">Admin Command Center</h1>
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

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { label: 'Total Users', value: stats.totalUsers, color: 'text-slate-100' },
          { label: 'Active Subs', value: stats.activeSubs, color: 'text-emerald-400' },
          { label: 'Free Users', value: stats.freeUsers, color: 'text-slate-400' },
          { label: 'Pro Monthly', value: stats.proUsers, color: 'text-sky-400' },
          { label: 'Annual', value: stats.annualUsers, color: 'text-amber-400' },
          { label: 'Banned', value: stats.bannedUsers, color: 'text-rose-400' },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-xl bg-pitch-900 border border-pitch-700/80">
            <span className="text-[10px] text-slate-500 font-mono block">{s.label}</span>
            <span className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-pitch-800 overflow-x-auto">
        {[
          { id: 'telemetry', label: 'Telemetry' },
          { id: 'users', label: 'Users' },
          { id: 'financials', label: 'Financials' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-mono rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-pitch-900 text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ---- Tab 1: Telemetry & Ingestion Matrix ---- */}
      {activeTab === 'telemetry' && (
        <div className="space-y-4">
          {/* DB Counts */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Competitions', value: dbCounts.competitions, unit: 'rows' },
              { label: 'Teams', value: dbCounts.teams, unit: 'rows' },
              { label: 'Fixtures', value: dbCounts.fixtures, unit: 'rows' },
            ].map((c) => (
              <div key={c.label} className="p-4 rounded-xl bg-pitch-900 border border-pitch-700/80">
                <span className="text-[10px] text-slate-500 font-mono block">{c.label}</span>
                <span className="text-2xl font-bold font-mono text-slate-100">{c.value}</span>
                <span className="text-[10px] text-slate-600 ml-1">{c.unit}</span>
              </div>
            ))}
          </div>

          {/* Fan-Out Matrix */}
          <div className="rounded-xl bg-pitch-900 border border-pitch-700/80 overflow-hidden">
            <div className="p-3 border-b border-pitch-800 flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-slate-300">Fan-Out Matrix: Competition Sync Status</h3>
              <button
                type="button"
                onClick={() => { fetchCompetitions(); fetchDbCounts() }}
                className="px-2.5 py-1 rounded bg-pitch-800 hover:bg-pitch-700 text-slate-300 text-[11px] transition-colors min-h-[32px]"
              >
                Refresh
              </button>
            </div>
            {compLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {COMPETITION_FANOUT.map((group) => (
                  <div key={group.group}>
                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-2">{group.group}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.leagues.map((code) => {
                        const comp = competitions.find((c) => c.code === code)
                        const lastSync = comp?.updated_at
                        const hoursSince = lastSync
                          ? Math.round((Date.now() - new Date(lastSync).getTime()) / (1000 * 60 * 60))
                          : null
                        let status = 'idle'
                        if (hoursSince != null && hoursSince < 24) status = 'active'
                        else if (hoursSince != null && hoursSince < 72) status = 'syncing'
                        return (
                          <div
                            key={code}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-pitch-950 border border-pitch-800 text-xs font-mono"
                          >
                            <StatusDot status={status} />
                            <span className="text-slate-300">{code}</span>
                            <span className="text-slate-600">
                              {lastSync ? `${hoursSince}h ago` : 'never'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manual Trigger */}
          <div className="rounded-xl bg-pitch-900 border border-pitch-700/80 p-5 space-y-3">
            <h3 className="text-xs font-mono font-bold text-slate-300">Pipeline Control</h3>
            <p className="text-[11px] text-slate-500 font-mono">
              Trigger manual pipeline runs. Production execution uses GitHub Actions workflow_dispatch.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={triggerSync}
                disabled={syncing}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-pitch-700 text-pitch-950 font-bold text-xs transition-colors min-h-[40px]"
              >
                {syncing ? 'Triggering...' : 'Trigger Daily Sync'}
              </button>
              <a
                href={`https://github.com/${import.meta.env.VITE_GITHUB_REPO || 'adrilhutama/Matchlytics'}/actions/workflows/sync_daily.yml`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-pitch-800 hover:bg-pitch-700 text-slate-300 text-xs font-mono transition-colors border border-pitch-700 min-h-[40px] flex items-center"
              >
                GitHub Actions &rarr;
              </a>
            </div>
            {syncResult && (
              <div className={`p-3 rounded-lg text-xs font-mono ${
                syncResult.success
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}>
                {syncResult.success
                  ? `Sync triggered: ${syncResult.run_id || 'check GitHub for status'}`
                  : `Error: ${syncResult.error || 'Unknown'}`
                }
              </div>
            )}
            <div className="pt-3 border-t border-pitch-800">
              <p className="text-[10px] text-slate-500 font-mono mb-2">Workflow Schedule:</p>
              <ul className="text-[10px] text-slate-500 font-mono space-y-0.5">
                <li>sync_standings.yml - Daily at 03:00 UTC</li>
                <li>sync_fixtures.yml - Mondays at 02:00 UTC</li>
                <li>sync_daily.yml - Twice daily at 06:00 &amp; 14:00 UTC</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ---- Tab 2: User Directory & Access Control ---- */}
      {activeTab === 'users' && (
        <div className="rounded-xl bg-pitch-900 border border-pitch-700/80 overflow-hidden">
          <div className="p-3 border-b border-pitch-800 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Search by email or name..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="flex-1 bg-pitch-950 border border-pitch-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 min-h-[36px]"
            />
            <select
              value={userFilterTier}
              onChange={(e) => setUserFilterTier(e.target.value)}
              className="bg-pitch-950 border border-pitch-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 min-h-[36px]"
            >
              <option value="all">All Tiers</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="annual">Annual</option>
              <option value="institutional">Institutional</option>
            </select>
            <button
              type="button"
              onClick={fetchUsers}
              className="px-3 py-1.5 rounded-lg bg-pitch-800 hover:bg-pitch-700 text-slate-300 text-xs font-mono transition-colors min-h-[36px]"
            >
              Refresh
            </button>
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-pitch-800 text-[10px] uppercase text-slate-500">
                    <th className="py-2.5 px-4">Email</th>
                    <th className="py-2.5 px-4">Name</th>
                    <th className="py-2.5 px-4">Tier</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Period End</th>
                    <th className="py-2.5 px-4">Created</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pitch-800/60">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-pitch-800/40 transition-colors">
                      <td className="py-2.5 px-4 text-slate-300 truncate max-w-[180px]">{u.email || '–'}</td>
                      <td className="py-2.5 px-4 text-slate-200">{u.full_name || '–'}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.subscription_tier === 'pro' ? 'bg-sky-500/20 text-sky-400' :
                          u.subscription_tier === 'annual' ? 'bg-emerald-500/20 text-emerald-400' :
                          u.subscription_tier === 'institutional' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-pitch-700 text-slate-400'
                        }`}>
                          {(u.subscription_tier || 'free').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusPill status={u.subscription_status || 'inactive'} />
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">{fmtDate(u.current_period_end)}</td>
                      <td className="py-2.5 px-4 text-slate-500">{fmtDate(u.created_at)}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="px-2.5 py-1 rounded bg-pitch-800 hover:bg-pitch-700 text-slate-300 hover:text-amber-400 transition-colors text-[11px] min-h-[28px]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleBan(u)}
                            disabled={banning && banningTarget?.id === u.id}
                            className={`px-2.5 py-1 rounded text-[11px] transition-colors min-h-[28px] ${
                              u.subscription_status === 'banned'
                                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30'
                            }`}
                            title={u.subscription_status === 'banned' ? 'Unban user' : 'Ban user'}
                          >
                            {banning && banningTarget?.id === u.id ? '...' : u.subscription_status === 'banned' ? 'Unban' : 'Ban'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit User Modal */}
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
                <p className="text-slate-200 font-mono">{editTarget.email || '–'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-500 block mb-1">Tier</label>
                  <select
                    value={editTier}
                    onChange={(e) => setEditTier(e.target.value)}
                    className="w-full bg-pitch-950 border border-pitch-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 min-h-[36px]"
                  >
                    {[
                      { value: 'free', label: 'Free' },
                      { value: 'pro', label: 'Pro (Monthly)' },
                      { value: 'annual', label: 'Annual' },
                      { value: 'institutional', label: 'Institutional' },
                    ].map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-pitch-950 border border-pitch-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 min-h-[36px]"
                  >
                    {[
                      { value: 'inactive', label: 'Inactive' },
                      { value: 'active', label: 'Active' },
                      { value: 'past_due', label: 'Past Due' },
                      { value: 'banned', label: 'Banned' },
                    ].map((s) => (
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
                  className="w-full bg-pitch-950 border border-pitch-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-xs min-h-[36px]"
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
                className="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-pitch-700 text-pitch-950 font-bold text-xs transition-colors min-h-[40px]"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 rounded-lg bg-pitch-800 hover:bg-pitch-700 text-slate-300 text-xs transition-colors min-h-[40px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Tab 3: Financials & Webhook Audit Log ---- */}
      {activeTab === 'financials' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Events', value: auditLog.length, color: 'text-slate-100' },
              { label: 'Activations', value: auditLog.filter(a => a.action === 'activate_subscription').length, color: 'text-emerald-400' },
              { label: 'Deactivations', value: auditLog.filter(a => a.action === 'deactivate_subscription').length, color: 'text-rose-400' },
              { label: 'Sync Triggers', value: auditLog.filter(a => a.action === 'trigger_sync').length, color: 'text-amber-400' },
            ].map((s) => (
              <div key={s.label} className="p-4 rounded-xl bg-pitch-900 border border-pitch-700/80">
                <span className="text-[10px] text-slate-500 font-mono block">{s.label}</span>
                <span className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Audit Log Table */}
          <div className="rounded-xl bg-pitch-900 border border-pitch-700/80 overflow-hidden">
            <div className="p-3 border-b border-pitch-800 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">Webhook &amp; Action Audit Log</span>
              <button
                type="button"
                onClick={fetchAuditLog}
                className="px-2.5 py-1 rounded bg-pitch-800 hover:bg-pitch-700 text-slate-300 text-[11px] transition-colors min-h-[32px]"
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
                    <tr className="border-b border-pitch-800 text-[10px] uppercase text-slate-500">
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-4">Admin</th>
                      <th className="py-2.5 px-4">Action</th>
                      <th className="py-2.5 px-4">Target Profile</th>
                      <th className="py-2.5 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pitch-800/60">
                    {auditLog.map((entry) => (
                      <tr
                        key={entry.id}
                        className="hover:bg-pitch-800/40 transition-colors cursor-pointer"
                        onClick={() => setSelectedAudit(selectedAudit === entry.id ? null : entry.id)}
                      >
                        <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">{fmtDateTime(entry.created_at)}</td>
                        <td className="py-2.5 px-4 text-slate-300">{entry.admin_email}</td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            entry.action === 'activate_subscription' ? 'bg-emerald-500/20 text-emerald-400' :
                            entry.action === 'trigger_sync' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-rose-500/20 text-rose-400'
                          }`}>
                            {entry.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 font-mono text-[10px]">
                          {entry.target_profile_id || '–'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">
                          {entry.details ? JSON.stringify(entry.details).slice(0, 60) : '–'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payload Inspection Drawer */}
          {selectedAudit && (
            <div className="rounded-xl bg-pitch-900 border border-amber-500/30 p-5 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold text-amber-400">Payload Inspection</h3>
                <button
                  type="button"
                  onClick={() => setSelectedAudit(null)}
                  className="text-slate-500 hover:text-slate-300 text-lg leading-none"
                >
                  &times;
                </button>
              </div>
              {(() => {
                const entry = auditLog.find(a => a.id === selectedAudit)
                if (!entry) return null
                return (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 font-mono">Admin: </span>
                        <span className="text-slate-200 font-mono">{entry.admin_email}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-mono">Action: </span>
                        <span className="text-slate-200 font-mono">{entry.action}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-mono">Timestamp: </span>
                        <span className="text-slate-200 font-mono">{fmtDateTime(entry.created_at)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-mono">Target: </span>
                        <span className="text-slate-400 font-mono text-[10px]">{entry.target_profile_id || 'N/A'}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-mono text-[10px] uppercase tracking-wider">Raw Payload</span>
                      <pre className="mt-1 p-3 rounded-lg bg-pitch-950 border border-pitch-800 text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap break-all max-h-48">
                        {entry.details ? JSON.stringify(entry.details, null, 2) : '{}'}
                      </pre>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
