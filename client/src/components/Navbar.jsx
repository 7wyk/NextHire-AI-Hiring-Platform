import { Search, LogOut } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useLocation, useNavigate } from 'react-router-dom'
import { disconnectSocket } from '../services/socket'
import NotificationBell from './NotificationBell'

const pageTitles = {
  '/dashboard':        'Dashboard',
  '/jobs':             'Job Listings',
  '/candidates':       'Candidates',
  '/resume-ai':        'Resume AI Screening',
  '/coding':           'Coding Assessment',
  '/ranking':          'Candidate Rankings',
  '/my-applications':  'My Applications',
  '/public-jobs':      'Browse Jobs',
  '/ai-interview':     'AI Interview',
}

export default function Navbar() {
  const { user, logout } = useAuthStore()
  const { pathname }     = useLocation()
  const navigate         = useNavigate()

  const handleLogout = () => {
    disconnectSocket()   // cleanly close Socket.IO connection
    logout()
    navigate('/login')
  }

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-surface-800/80 backdrop-blur-sm border-b border-white/[0.07] flex-shrink-0">
      <h1 className="text-lg font-semibold text-white">
        {pageTitles[pathname] || 'NextHire AI'}
      </h1>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-4 py-2 rounded-xl bg-surface-700 border border-white/10
              text-slate-300 placeholder-slate-500 text-sm focus:outline-none
              focus:border-primary-500/40 w-52 transition-all"
          />
        </div>

        {/* Notification Bell — recruiters only */}
        {(user?.role === 'recruiter' || user?.role === 'admin') && (
          <NotificationBell />
        )}

        {/* Avatar + name */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500
            flex items-center justify-center text-white text-sm font-bold cursor-pointer">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="hidden md:block text-slate-300 text-sm font-medium max-w-[100px] truncate">
            {user?.name}
          </span>
        </div>

        {/* Logout */}
        <button
          id="logout-btn"
          onClick={handleLogout}
          title="Logout"
          className="w-9 h-9 flex items-center justify-center rounded-xl
            bg-surface-700 border border-white/[0.07] text-slate-400
            hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 transition-all"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  )
}
