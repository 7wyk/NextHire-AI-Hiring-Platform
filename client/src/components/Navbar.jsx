import { Menu, LogOut } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import { disconnectSocket } from '../services/socket'
import NotificationBell from './NotificationBell'

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const isRecruiter = user?.role === 'recruiter' || user?.role === 'admin'

  const handleLogout = () => {
    disconnectSocket()
    logout()
    navigate('/')
  }

  return (
    <header className="h-14 flex items-center justify-between gap-3 px-4 sm:px-6 bg-paper border-b border-line flex-shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden -ml-1 p-2 rounded-[7px] text-ink-600 hover:bg-ink-100 hover:text-ink-950"
          aria-label="Open navigation"
        >
          <Menu size={18} strokeWidth={1.7} />
        </button>
        <span className="text-[13px] text-ink-500 truncate">
          {isRecruiter ? 'Recruiter workspace' : 'Candidate workspace'}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {isRecruiter && <NotificationBell />}

        <div className="hidden sm:flex items-center gap-2 pl-3 ml-1.5 border-l border-line">
          <div className="w-7 h-7 rounded-[6px] bg-ink-100 text-ink-700 flex items-center justify-center text-[12px] font-medium">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="leading-tight">
            <p className="text-[12.5px] text-ink-950 max-w-[140px] truncate">{user?.name}</p>
            <p className="text-[11px] text-ink-500 capitalize">{user?.role}</p>
          </div>
        </div>

        <button
          id="logout-btn"
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
          className="ml-1 p-2 rounded-[7px] text-ink-500 hover:text-ink-950 hover:bg-ink-100 transition-colors"
        >
          <LogOut size={15} strokeWidth={1.7} />
        </button>
      </div>
    </header>
  )
}
