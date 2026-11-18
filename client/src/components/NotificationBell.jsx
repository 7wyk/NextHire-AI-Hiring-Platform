import { useState, useEffect, useRef } from 'react'
import { Bell, X, Users, Code2, CheckCircle2 } from 'lucide-react'
import { getSocket } from '../services/socket'
import { useAuthStore } from '../store/authStore'

const EVENT_ICONS = {
  'new-application': Users,
  'test-submitted':  Code2,
  'status-updated':  CheckCircle2,
}

const MAX_NOTIFICATIONS = 20

export default function NotificationBell() {
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!user) return

    // Auth rides on the HttpOnly session cookie, not a token in JS.
    const socket = getSocket()

    const handleNotification = (event, data) => {
      const msg = buildMessage(event, data)
      setNotifications(prev => [
        { id: `${Date.now()}-${Math.random()}`, event, data, msg, ts: new Date() },
        ...prev.slice(0, MAX_NOTIFICATIONS - 1),
      ])
      setUnread(n => n + 1)
    }

    const onApplication = d => handleNotification('new-application', d)
    const onTest = d => handleNotification('test-submitted', d)
    const onStatus = d => handleNotification('status-updated', d)

    socket.on('new-application', onApplication)
    socket.on('test-submitted', onTest)
    socket.on('status-updated', onStatus)

    return () => {
      socket.off('new-application', onApplication)
      socket.off('test-submitted', onTest)
      socket.off('status-updated', onStatus)
    }
  }, [user])

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    setOpen(o => !o)
    if (!open) setUnread(0)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        id="notification-bell"
        onClick={handleOpen}
        className="relative p-2 rounded-md text-ink-600 hover:text-ink-900 hover:bg-ink-100 transition-colors"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <Bell size={16} strokeWidth={1.7} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-[3px] bg-danger-600 rounded-full text-[9px] font-semibold text-white flex items-center justify-center num">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-[min(320px,calc(100vw-32px))] z-50 bg-paper border border-line rounded-card shadow-float overflow-hidden animate-rise-in">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
            <p className="text-[13px] font-semibold text-ink-900">Notifications</p>
            {notifications.length > 0 && (
              <button
                onClick={() => setNotifications([])}
                className="text-xs text-ink-500 hover:text-ink-800 flex items-center gap-1"
              >
                <X size={11} /> Clear
              </button>
            )}
          </div>

          <div className="max-h-[336px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-9 px-4 text-center">
                <Bell size={16} className="text-ink-300 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-[13px] text-ink-500">No notifications yet</p>
                <p className="text-[11.5px] text-ink-400 mt-0.5">
                  Applications, submissions and status changes appear here
                </p>
              </div>
            ) : (
              notifications.map(n => {
                const Icon = EVENT_ICONS[n.event] || Bell
                return (
                  <div key={n.id} className="flex items-start gap-2.5 px-4 py-2.5 border-b border-line last:border-0">
                    <Icon size={13} className="text-ink-400 mt-0.5 flex-shrink-0" strokeWidth={1.7} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] text-ink-800 leading-5">{n.msg}</p>
                      <p className="text-[11px] text-ink-400 num mt-0.5">{formatTime(n.ts)}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function buildMessage(event, data) {
  switch (event) {
    case 'new-application':
      return `${data.candidateName || 'A candidate'} applied to "${data.jobTitle || 'a job'}"`
    case 'test-submitted':
      return `${data.candidateName || 'A candidate'} submitted a coding test for "${data.jobTitle || 'a job'}" · ${data.score ?? '?'}%`
    case 'status-updated':
      return `Status moved to ${data.status} for ${data.candidateName || 'a candidate'}`
    default:
      return 'New notification'
  }
}

function formatTime(date) {
  const diff = Math.floor((Date.now() - date) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return date.toLocaleDateString()
}
