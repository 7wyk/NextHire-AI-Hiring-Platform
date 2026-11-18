import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Briefcase, ScanText,
  Code2, MessageSquare, Trophy, LogOut, ClipboardList, Search, Activity
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { disconnectSocket } from '../services/socket'
import Logo from './Logo'

const recruiterNav = [
  {
    group: 'Hiring',
    items: [
      { icon: LayoutDashboard, label: 'Overview',   path: '/dashboard' },
      { icon: Briefcase,       label: 'Jobs',       path: '/jobs' },
      { icon: Users,           label: 'Candidates', path: '/candidates' },
    ],
  },
  {
    group: 'Assessment',
    items: [
      { icon: ScanText,        label: 'Resume screening', path: '/resume-ai' },
      { icon: Code2,           label: 'Coding tests',     path: '/create-coding-test' },
      { icon: MessageSquare,   label: 'Interviews',       path: '/interviews' },
      { icon: Trophy,          label: 'Rankings',         path: '/ranking' },
    ],
  },
  {
    group: 'System',
    items: [
      { icon: Activity,        label: 'Agent monitor',    path: '/agent-monitor' },
    ],
  },
]

const candidateNav = [
  {
    group: 'Jobs',
    items: [
      { icon: Search,          label: 'Browse jobs',       path: '/public-jobs' },
      { icon: ClipboardList,   label: 'My applications',   path: '/my-applications' },
    ],
  },
  {
    group: 'Practice',
    items: [
      { icon: MessageSquare,   label: 'AI interview',      path: '/ai-interview' },
      { icon: Code2,           label: 'Coding sandbox',    path: '/coding' },
    ],
  },
]

export default function Sidebar({ onNavigate }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const role = user?.role || 'candidate'
  const groups = role === 'candidate' ? candidateNav : recruiterNav
  const roleLabel = role === 'admin' ? 'Admin' : role === 'recruiter' ? 'Recruiter' : 'Candidate'

  const handleLogout = () => {
    disconnectSocket()
    logout()
    navigate('/')
  }

  return (
    <aside className="w-[244px] flex flex-col h-full bg-ink-950 text-white">
      <div className="px-4 h-14 flex items-center border-b border-white/[0.08]">
        <Logo to={role === 'candidate' ? '/public-jobs' : '/dashboard'} tone="light" />
      </div>

      <nav className="flex-1 px-2.5 py-3.5 overflow-y-auto" aria-label="Main">
        {groups.map((group, gi) => (
          <div key={group.group} className={gi === 0 ? '' : 'mt-5'}>
            <p className="px-2.5 pb-1.5 text-[11px] text-white/40">
              {group.group}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    [
                      'relative flex items-center gap-2.5 h-8 pl-3 pr-2 rounded-[7px] text-[13px] transition-colors',
                      isActive
                        ? 'bg-white/[0.09] text-white font-medium'
                        : 'text-white/60 hover:bg-white/[0.05] hover:text-white',
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-accent-500"
                          aria-hidden="true"
                        />
                      )}
                      <item.icon size={15} strokeWidth={1.6} className="flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-2.5 border-t border-white/[0.08]">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-7 h-7 rounded-[6px] bg-white/[0.1] text-white flex items-center justify-center text-[12px] font-medium flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-white font-medium truncate leading-4">
              {user?.name || 'User'}
            </p>
            <p className="text-[11px] text-white/45 truncate leading-4">
              {roleLabel}{user?.company ? ` · ${user.company}` : ''}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-white/45 hover:text-white p-1.5 rounded-[6px] hover:bg-white/[0.08] transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={14} strokeWidth={1.7} />
          </button>
        </div>
      </div>
    </aside>
  )
}
