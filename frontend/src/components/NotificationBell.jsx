// ---- NotificationBell.jsx ----
// Bell icon with unread count badge. Opens notification panel on click.

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function NotificationBell({ onOpenPanel }) {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      return
    }

    // Initial fetch
    fetchUnread()

    // Poll every 30 seconds
    intervalRef.current = setInterval(fetchUnread, 30000)

    // Realtime subscription for own notifications
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}` },
        () => {
          fetchUnread()
          setUnreadCount((c) => c + 1)
        }
      )
      .subscribe()

    return () => {
      clearInterval(intervalRef.current)
      supabase.removeChannel(channel)
    }
  }, [user])

  async function fetchUnread() {
    if (!user) return
    const { data, error } = await supabase
      .from('user_notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('read', false)

    if (error) {
      console.error('Failed to fetch unread notifications:', error.message)
      return
    }
    setUnreadCount(data?.length ?? 0)
  }

  return (
    <button
      type="button"
      onClick={() => onOpenPanel(user)}
      className="relative min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-pitch-900 hover:bg-pitch-800 border border-pitch-700 text-slate-400 hover:text-slate-200 transition-colors touch-manipulation"
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-pitch-950 text-[10px] font-bold flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}
