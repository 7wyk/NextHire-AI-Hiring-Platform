import { useState, useEffect, useRef } from 'react'
import { Bell, X, Users, Code2, Briefcase, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getSocket } from '../services/socket'
import { useAuthStore } from '../store/authStore'

const EVENT_ICONS = {
  'new-application':  { icon: Users,       color: 'text-primary-400',  bg: 'bg-primary-500/10'  },
  'test-submitted':   { icon: Code2,       color: 'text-emerald-400',  bg: 'bg-emerald-500/10'  },
  'status-updated':   { icon: CheckCircle2, color: 'text-amber-400',   bg: 'bg-amber-500/10'    },
  'default':          { icon: Bell,        color: 'text-slate-400',    bg: 'bg-surface-700'      },
}

const MAX_NOTIFICATIONS = 20

export default function NotificationBell() {
  const { token } = useAuthStore()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen]                   = useState(false)
  const [unread, setUnread]               = useState(0)
  const panelRef  = useRef(null)
  const socketRef = useRef(null)

  // ── Connect socket + listen ──────────────────────────────────────────────
  useEffect(() => {
    if (!token) return

    const socket = getSocket(token)
    socketRef.current = socket

    const handleNotification = (event, data) => {
      const msg = buildMessage(event, data)
      setNotifications(prev => [
        { id: Date.now(), event, data, msg, ts: new Date() },
        ...prev.slice(0, MAX_NOTIFICATIONS - 1),
      ])
      setUnread(n => n + 1)
    }

    socket.on('new-application', d => handleNotification('new-application', d))
    socket.on('test-submitted',  d => handleNotification('test-submitted',  d))
    socket.on('status-updated',  d => handleNotification('status-updated',  d))

    return () => {
      socket.off('new-application')
      socket.off('test-submitted')
      socket.off('status-updated')
    }
  }, [token])

  // ── Click-outside to close ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    setOpen(o => !o)
    if (!open) setUnread(0)
  }

  const clearAll = () => setNotifications([])

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        id="notification-bell"
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl
          bg-surface-700 border border-white/[0.07] hover:bg-surface-600 transition-all"
        aria-label="Notifications"
      >
        <Bell size={16} className="text-slate-400" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full
            text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1     }}
            exit={{ opacity: 0,  y: -8,  scale: 0.95  }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-80 z-50
              bg-surface-800 border border-white/[0.08] rounded-2xl shadow-2xl
              overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3
              border-b border-white/[0.06]">
              <p className="text-white font-semibold text-sm">Notifications</p>
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                >
                  <X size={12} /> Clear all
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map(n => {
                  const cfg = EVENT_ICONS[n.event] || EVENT_ICONS.default
                  const Icon = cfg.icon
                  return (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3
                      hover:bg-white/[0.03] transition-colors">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                        <Icon size={14} className={cfg.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-xs leading-relaxed">{n.msg}</p>
                        <p className="text-slate-500 text-[10px] mt-0.5">
                          {formatTime(n.ts)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildMessage(event, data) {
  switch (event) {
    case 'new-application':
      return `${data.candidateName || 'A candidate'} applied to "${data.jobTitle || 'a job'}"`
    case 'test-submitted':
      return `${data.candidateName || 'A candidate'} submitted the coding test for "${data.jobTitle || 'a job'}" — Score: ${data.score ?? '?'}%`
    case 'status-updated':
      return `Application status updated to "${data.status}" for ${data.candidateName || 'a candidate'}`
    default:
      return 'New notification'
  }
}

function formatTime(date) {
  const now  = new Date()
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60)          return 'Just now'
  if (diff < 3600)        return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)       return `${Math.floor(diff / 3600)}h ago`
  return date.toLocaleDateString()
}
