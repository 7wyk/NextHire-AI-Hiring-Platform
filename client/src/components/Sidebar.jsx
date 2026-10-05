import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Users, Briefcase, FileText,
  Code2, MessageSquare, Trophy, LogOut, Zap,
  ClipboardList, Search, Wand2, Brain
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'

// ── Nav items per role ───────────────────────────────────────────────────────

const recruiterNav = [
  { icon: LayoutDashboard, label: 'Dashboard',        path: '/dashboard' },
  { icon: Briefcase,       label: 'My Jobs',          path: '/jobs' },
  { icon: Users,           label: 'Candidates',       path: '/candidates' },
  { icon: FileText,        label: 'Resume AI',        path: '/resume-ai' },
  { icon: Wand2,           label: 'Create Test',      path: '/create-coding-test' },
  { icon: Trophy,          label: 'Rankings',         path: '/ranking' },
  { icon: Brain,           label: 'Agent Monitor',    path: '/agent-monitor' },
]

const candidateNav = [
  { icon: LayoutDashboard, label: 'Dashboard',        path: '/dashboard' },
  { icon: Search,          label: 'Browse Jobs',      path: '/public-jobs' },
  { icon: ClipboardList,   label: 'My Applications',  path: '/my-applications' },
  { icon: MessageSquare,   label: 'AI Interview',     path: '/ai-interview' },
  { icon: Code2,           label: 'Coding Sandbox',   path: '/coding' },
]

const adminNav = recruiterNav // admin sees everything the recruiter sees

const roleColors = {
  recruiter: 'bg-blue-500/20 text-blue-300',
  candidate: 'bg-emerald-500/20 text-emerald-300',
  admin:     'bg-amber-500/20 text-amber-300',
}

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const role     = user?.role || 'candidate'
  const navItems = role === 'admin' ? adminNav
                 : role === 'recruiter' ? recruiterNav
                 : candidateNav

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <aside className="w-64 flex flex-col bg-surface-800 border-r border-white/[0.07] h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.07]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-900/50">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-none">NextHire</p>
          <p className="text-primary-400 text-xs font-medium">AI Platform</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
               ${isActive
                ? 'bg-primary-600/20 text-primary-300 border border-primary-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'}`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={`w-4.5 h-4.5 flex-shrink-0 transition-colors ${isActive ? 'text-primary-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                  size={18}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Profile + Logout */}
      <div className="p-3 border-t border-white/[0.07]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-700">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user?.name || 'User'}</p>
            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize mt-0.5 ${roleColors[role] || roleColors.candidate}`}>
              {role}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
            title="Logout"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
