import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Users, Briefcase, FileText, Trophy, TrendingUp,
  Clock, ArrowRight, Zap, Code2, MessageSquare,
  BarChart3, Search, ClipboardList, Wand2
} from 'lucide-react'
import api from '../../services/api'
import { useAuthStore } from '../../store/authStore'

// ── Sub-components ──────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, change, color, bg, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="card"
  >
    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-4`}>
      <Icon className={`w-5 h-5 ${color}`} />
    </div>
    <p className="text-2xl font-bold text-white mb-0.5">{value}</p>
    <p className="text-xs text-slate-400">{label}</p>
    {change && (
      <div className="flex items-center gap-1 mt-2">
        <TrendingUp size={11} className="text-accent-400" />
        <span className="text-xs text-accent-400">{change}</span>
      </div>
    )}
  </motion.div>
)

const PipelineBar = ({ label, count, total, color }) => (
  <div className="flex items-center gap-3">
    <span className="text-slate-400 text-xs w-20 capitalize">{label}</span>
    <div className="flex-1 h-2 bg-surface-600 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={`h-full ${color} rounded-full`}
      />
    </div>
    <span className="text-white text-xs font-semibold w-5 text-right">{count}</span>
  </div>
)

// ── Candidate Dashboard ──────────────────────────────────────────────────────

function CandidateDashboard({ user }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
        <h2 className="text-xl font-bold text-white mb-1">Welcome back, {user.name}! 👋</h2>
        <p className="text-slate-400 text-sm">Explore open positions and track your applications below.</p>
      </motion.div>

      {/* Primary actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link to="/public-jobs"
          className="card group flex items-center gap-4 bg-gradient-to-br from-primary-600 to-indigo-700 border-0 hover:scale-[1.02] transition-transform duration-200">
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Search className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold">Browse Jobs</p>
            <p className="text-white/70 text-xs">Find and apply to open positions</p>
          </div>
          <ArrowRight size={16} className="text-white/60 ml-auto group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link to="/my-applications"
          className="card group flex items-center gap-4 bg-gradient-to-br from-emerald-600 to-teal-700 border-0 hover:scale-[1.02] transition-transform duration-200">
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold">My Applications</p>
            <p className="text-white/70 text-xs">Track your application statuses</p>
          </div>
          <ArrowRight size={16} className="text-white/60 ml-auto group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Secondary actions */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Link to="/ai-interview"
          className="card group flex items-center gap-3 bg-gradient-to-br from-indigo-600 to-blue-700 border-0 hover:scale-[1.02] transition-transform duration-200">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">AI Interview</p>
            <p className="text-white/60 text-xs">Voice-powered mock interview</p>
          </div>
          <ArrowRight size={15} className="text-white/60 ml-auto group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link to="/coding"
          className="card group flex items-center gap-3 bg-gradient-to-br from-purple-600 to-pink-700 border-0 hover:scale-[1.02] transition-transform duration-200">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Coding Sandbox</p>
            <p className="text-white/60 text-xs">Practice coding problems</p>
          </div>
          <ArrowRight size={15} className="text-white/60 ml-auto group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  )
}


// ── Recruiter Dashboard ──────────────────────────────────────────────────────

function RecruiterDashboard() {
  const [stats, setStats] = useState({
    applications: 0, candidates: 0, interviews: 0, resumesScreened: 0, jobs: 0,
    pipeline: { applied: 0, screening: 0, interview: 0, shortlisted: 0, hired: 0, rejected: 0 },
  })
  const [recentApplications, setRecentApplications] = useState([])
  const [recentJobs, setRecentJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const { data } = await api.get('/dashboard')
        console.log('[Dashboard] Stats received:', data)

        setStats({
          applications:    data.applications    ?? 0,
          candidates:      data.candidates      ?? 0,
          interviews:      data.interviews      ?? 0,
          resumesScreened: data.resumesScreened  ?? 0,
          jobs:            data.jobs             ?? 0,
          pipeline: {
            applied:     data.pipeline?.applied     ?? 0,
            screening:   data.pipeline?.screening   ?? 0,
            interview:   data.pipeline?.interview   ?? 0,
            shortlisted: data.pipeline?.shortlisted ?? 0,
            hired:       data.pipeline?.hired       ?? 0,
            rejected:    data.pipeline?.rejected    ?? 0,
          },
        })
        setRecentApplications(data.recentApplications || [])
        setRecentJobs(data.recentJobs || [])
      } catch (err) {
        console.error('[Dashboard] Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  const statCards = [
    { icon: Briefcase,       label: 'Active Jobs',       value: stats.jobs,            change: 'Live postings',    color: 'text-blue-400',    bg: 'bg-blue-500/10',    delay: 0 },
    { icon: Users,           label: 'Applications',      value: stats.applications,    change: `${stats.candidates} unique`,  color: 'text-purple-400',  bg: 'bg-purple-500/10',  delay: 0.08 },
    { icon: FileText,        label: 'Resumes Screened',  value: stats.resumesScreened, change: 'AI screened',      color: 'text-emerald-400', bg: 'bg-emerald-500/10', delay: 0.16 },
    { icon: MessageSquare,   label: 'Interviews Done',   value: stats.interviews,      change: 'Completed',        color: 'text-amber-400',   bg: 'bg-amber-500/10',   delay: 0.24 },
  ]

  const pipelineConfig = [
    { label: 'Applied',      key: 'applied',     color: 'bg-slate-500' },
    { label: 'Screening',    key: 'screening',   color: 'bg-amber-500' },
    { label: 'Interview',    key: 'interview',   color: 'bg-primary-500' },
    { label: 'Shortlisted',  key: 'shortlisted', color: 'bg-emerald-500' },
    { label: 'Hired',        key: 'hired',       color: 'bg-teal-400' },
  ]
  const totalPipeline = Object.values(stats.pipeline).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Pipeline */}
        <div className="card lg:col-span-1">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-primary-400" /> Application Pipeline
          </h3>
          <div className="space-y-3">
            {pipelineConfig.map(p => (
              <PipelineBar key={p.key}
                label={p.label}
                count={stats.pipeline[p.key] || 0}
                total={totalPipeline}
                color={p.color}
              />
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/[0.07]">
            <p className="text-slate-500 text-xs">
              {stats.pipeline.rejected > 0 && `${stats.pipeline.rejected} rejected · `}{totalPipeline} total applications
            </p>
          </div>
        </div>

        {/* Recent Applications */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Clock size={16} className="text-primary-400" /> Recent Applications
            </h3>
            <Link to="/candidates" className="btn-ghost text-xs gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-surface-700 rounded-xl animate-pulse" />)}
            </div>
          ) : recentApplications.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No applications yet. <Link to="/jobs" className="text-primary-400">Create a job</Link> to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {recentApplications.map((app, i) => (
                <motion.div key={app._id}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/30 border border-primary-500/20 flex items-center justify-center text-primary-300 font-semibold text-xs flex-shrink-0">
                      {(app.candidate?.name || '?')[0]}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{app.candidate?.name || 'Candidate'}</p>
                      <p className="text-slate-500 text-xs">{app.job?.title || 'Position'}</p>
                    </div>
                  </div>
                  <span className={`badge capitalize text-xs ${
                    app.status === 'interview' ? 'badge-primary' :
                    app.status === 'screening' ? 'badge-warning' :
                    'bg-slate-500/15 text-slate-300 border-slate-500/25'
                  }`}>
                    {app.status}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { icon: Zap,    label: 'Screen Resume', link: '/resume-ai',          cls: 'from-primary-600 to-indigo-700' },
          { icon: Wand2,  label: 'Create Test',   link: '/create-coding-test', cls: 'from-purple-600 to-pink-700'   },
          { icon: Trophy, label: 'Rankings',      link: '/ranking',            cls: 'from-amber-600 to-orange-700'  },
        ].map(a => (
          <Link key={a.label} to={a.link}
            className={`card group flex items-center gap-3 bg-gradient-to-br ${a.cls} border-0 hover:scale-[1.02] transition-transform duration-200`}>
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <a.icon className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold text-sm">{a.label}</span>
            <ArrowRight size={15} className="text-white/60 ml-auto group-hover:translate-x-1 transition-transform" />
          </Link>
        ))}
      </div>

      {/* Recent Jobs */}
      {recentJobs.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Briefcase size={16} className="text-primary-400" /> Active Job Postings
            </h3>
            <Link to="/jobs" className="btn-ghost text-xs gap-1">
              Manage <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentJobs.map(j => (
              <div key={j._id} className="bg-surface-700 rounded-xl p-3 border border-white/[0.06]">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-white text-sm font-medium line-clamp-1">{j.title}</p>
                  <span className={`${j.status === 'active' ? 'badge-success' : 'badge-warning'} badge text-[10px] ml-2 flex-shrink-0`}>
                    {j.status}
                  </span>
                </div>
                <p className="text-slate-400 text-xs mb-2">{j.company}</p>
                <div className="flex items-center gap-2 text-slate-500 text-xs">
                  <Users size={11} /> {j.applicantCount || 0} applicants
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main export — picks correct dashboard by role ────────────────────────────

export default function Dashboard() {
  const { user } = useAuthStore()

  if (user?.role === 'candidate') {
    return <CandidateDashboard user={user} />
  }

  return <RecruiterDashboard />
}
