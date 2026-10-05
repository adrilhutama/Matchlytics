// ---- NotificationPanel.jsx ----
// Slide-out panel showing user notifications with mark-as-read.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const TYPE_CONFIG = {
  bet_settled: { label: 'Bet Settled', icon: '⚽', color: 'text-emerald-400' },
  odds_drop: { label: 'Odds Moved', icon: '⬇️', color: 'text-rose-400' },
  subscription_renewal: { label: 'Subscription Renewed', icon: '✅', color: 'text-sky-400' },
  subscription_expiring: { label: 'Subscription Expiring', icon: '⏰', color: 'text-amber-400' },
  watchlist_trigger: { label: 'Watchlist Trigger', icon: '✨', color: 'text-violet-400' },
}

function formatRelativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function NotificationPanel({ onClose }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [markingId, setMarkingId] = useState(null)

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Failed to fetch notifications:', error.message)
      return
    }
    setNotifications(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`notif-panel-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}` },
        () => fetchNotifications()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, fetchNotifications])

  async function markAsRead(id) {
    if (markingId) return
    setMarkingId(id)
    const { error } = await supabase
      .from('user_notifications')
      .update({ read: true })
      .eq('id', id)
      .single()

    if (error) {
      console.error('Failed to mark notification as read:', error.message)
    } else {
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    }
    setMarkingId(null)
  }

  async function markAllAsRead() {
    if (!user || notifications.length === 0) return
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return

    const { error } = await supabase
      .from('user_notifications')
      .update({ read: true })
      .in_('id', unreadIds)

    if (error) {
      console.error('Failed to mark all as read:', error.message)
    } else {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    }
  }

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-pitch-950/80 backdrop-blur-sm">
        <div className="bg-pitch-900 border border-pitch-700 rounded-2xl p-6 max-w-sm text-center">
          <p className="text-sm text-slate-400">Sign in to view notifications.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 rounded-lg bg-pitch-800 text-slate-300 text-xs hover:bg-pitch-700 transition-colors">
            Close
          </button>
        </div>
      </div>
    )
  }

  const unread = notifications.filter((n) => !n.read).length
  const hasAny = notifications.length > 0

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Notifications">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-pitch-950/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-sm bg-pitch-900 border-l border-pitch-700 shadow-2xl flex flex-col animate-slide-left">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-pitch-800">
          <div>
            <h2 className="text-sm font-bold text-slate-100">Notifications</h2>
            {unread > 0 && (
              <p className="text-[11px] text-amber-400 font-mono mt-0.5">{unread} unread</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] text-slate-400 hover:text-sky-400 font-mono transition-colors"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-pitch-950 hover:bg-pitch-800 border border-pitch-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
              aria-label="Close notifications"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
            </div>
          ) : !hasAny ? (
            <div className="py-16 text-center">
              <p className="text-3xl mb-2">🔔</p>
              <p className="text-sm text-slate-500 font-mono">No notifications yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-pitch-800/60">
              {notifications.map((notif) => {
                const cfg = TYPE_CONFIG[notif.type] || { label: notif.type, icon: '🔔', color: 'text-slate-400' }
                const payload = notif.payload || {}
                return (
                  <div
                    key={notif.id}
                    className={`px-4 py-3 hover:bg-pitch-800/40 transition-colors cursor-pointer ${
                      notif.read ? 'opacity-60' : 'bg-pitch-800/20'
                    }`}
                    onClick={() => !notif.read && markAsRead(notif.id)}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`text-lg flex-shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                          {cfg.label}
                        </p>
                        <p className="text-xs text-slate-200 mt-0.5 break-words">
                          {payload.fixture_name
                            ? `${payload.fixture_name} - ${payload.pick || notif.type}`
                            : payload.message || 'Notification'}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-1">
                          {formatRelativeTime(notif.created_at)}
                        </p>
                      </div>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-pitch-800">
          <button
            type="button"
            onClick={() => { fetchNotifications(); onClose() }}
            className="w-full text-center text-[11px] text-slate-500 hover:text-slate-300 font-mono transition-colors py-1"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
