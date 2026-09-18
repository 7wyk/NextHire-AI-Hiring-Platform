import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, Briefcase, MapPin, Clock,
  AlertCircle, CheckCircle2, XCircle, Loader2,
  Trash2, ChevronDown, Code2, ArrowRight, FileText, ExternalLink, Mic
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const STATUS_CONFIG = {
  applied:     { label: 'Applied',      cls: 'badge',          icon: ClipboardList },
  screening:   { label: 'Screening',    cls: 'badge-warning',  icon: Loader2 },
  interview:   { label: 'Interview',    cls: 'badge-primary',  icon: Clock },
  shortlisted: { label: 'Shortlisted',  cls: 'badge-success',  icon: CheckCircle2 },
  hired:       { label: 'Hired 🎉',     cls: 'badge bg-teal-400/15 text-teal-200 border-teal-400/30', icon: CheckCircle2 },
  rejected:    { label: 'Not Selected', cls: 'badge-danger',   icon: XCircle },
}

export default function MyApplicationsPage() {
  const navigate = useNavigate()

  const [applications, setApplications] = useState([])
  const [total, setTotal]               = useState(0)
  const [loading, setLoading]           = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage]                 = useState(1)
  const [pages, setPages]               = useState(1)
  const [withdrawing, setWithdrawing]   = useState(null)
  // Set of jobIds that have a coding test available
  const [testJobIds, setTestJobIds]     = useState(new Set())
  // Set of jobIds that have a completed AI interview
  const [interviewStatuses, setInterviewStatuses] = useState({})

  const fetchApplications = async () => {
    setLoading(true)
    try {
      const params = { page, limit: 10 }
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/applications/mine', { params })
      setApplications(data.applications)
      setTotal(data.total)
      setPages(data.pages || 1)

      // For each unique job, silently check if a coding test exists
      const jobIds = [...new Set(data.applications.map(a => a.job?._id).filter(Boolean))]
      const checks = await Promise.allSettled(
        jobIds.map(id =>
          api.get(`/coding-test/${id}`).then(() => id).catch(() => null)
        )
      )
      const idsWithTests = checks
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value)
      setTestJobIds(new Set(idsWithTests))

      // Check AI interview status for each job
      const ivStatuses = {}
      await Promise.allSettled(
        jobIds.map(async id => {
          try {
            const { data: s } = await api.get(`/interview/candidate/status/${id}`)
            ivStatuses[id] = s
          } catch { /* ignore */ }
        })
      )
      setInterviewStatuses(ivStatuses)
    } catch {
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchApplications() }, [statusFilter, page])
  useEffect(() => { setPage(1) }, [statusFilter])

  const handleWithdraw = async (appId) => {
    if (!confirm('Withdraw this application? This cannot be undone.')) return
    setWithdrawing(appId)
    try {
      await api.delete(`/applications/${appId}`)
      setApplications(prev => prev.filter(a => a._id !== appId))
      setTotal(prev => prev - 1)
      toast.success('Application withdrawn')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Withdraw failed')
    } finally {
      setWithdrawing(null)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">My Applications</h1>
          <p className="text-slate-400 text-sm">{total} application{total !== 1 ? 's' : ''}</p>
        </div>

        <div className="relative">
          <select
            className="input pr-9 appearance-none cursor-pointer"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
              <option key={val} value={val}>{cfg.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-surface-700" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="card text-center py-16">
          <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-2">No applications yet.</p>
          <p className="text-slate-500 text-sm">
            Head to <strong className="text-primary-400">Browse Jobs</strong> to apply!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app, i) => {
            const status     = app.status || 'applied'
            const cfg        = STATUS_CONFIG[status] || STATUS_CONFIG.applied
            const StatusIcon = cfg.icon
            const canWithdraw = status === 'applied'
            const jobId      = app.job?._id
            const hasTest    = Boolean(jobId && testJobIds.has(jobId))

            return (
              <motion.div
                key={app._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card"
              >
                {/* Main row */}
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary-500/15 border border-primary-500/20 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-5 h-5 text-primary-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">
                      {app.job?.title || 'Job no longer available'}
                    </p>
                    <p className="text-slate-400 text-xs">{app.job?.company}</p>
                    <div className="flex items-center gap-3 mt-1 text-slate-500 text-xs">
                      {app.job?.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} /> {app.job.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        Applied {new Date(app.createdAt).toLocaleDateString()}
                      </span>
                      {app.resumeUrl ? (
                        <a
                          href={app.resumeUrl.startsWith('http') ? app.resumeUrl : `${import.meta.env.VITE_API_URL?.replace('/api', '')}${app.resumeUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary-400 hover:text-primary-300 transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          <FileText size={11} /> Resume <ExternalLink size={9} />
                        </a>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-600">
                          <FileText size={11} /> No resume
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`${cfg.cls} badge flex items-center gap-1.5 text-xs`}>
                      <StatusIcon size={11} />
                      {cfg.label}
                    </span>

                    {canWithdraw && (
                      <button
                        id={`withdraw-${app._id}`}
                        onClick={() => handleWithdraw(app._id)}
                        disabled={withdrawing === app._id}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10 disabled:opacity-50"
                        title="Withdraw application"
                      >
                        {withdrawing === app._id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />
                        }
                      </button>
                    )}
                  </div>
                </div>

                {/* Coding test CTA — only when test exists for this job */}
                {hasTest && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 text-amber-300 text-xs">
                      <AlertCircle size={13} className="flex-shrink-0 text-amber-400" />
                      <span>A coding assessment is available for this position</span>
                    </div>
                    <button
                      id={`take-test-${jobId}`}
                      onClick={() => navigate(`/coding-test/${jobId}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                        bg-gradient-to-r from-purple-600 to-pink-600 text-white
                        hover:opacity-90 transition-all shadow-md shadow-purple-900/30 flex-shrink-0"
                    >
                      <Code2 size={13} /> Take Test <ArrowRight size={12} />
                    </button>
                  </motion.div>
                )}

                {/* AI Interview CTA */}
                {jobId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 text-primary-300 text-xs">
                      <Mic size={13} className="flex-shrink-0 text-primary-400" />
                      <span>
                        {interviewStatuses[jobId]?.completed
                          ? 'AI Interview completed ✓'
                          : 'AI Interview available for this position'}
                      </span>
                    </div>
                    {!interviewStatuses[jobId]?.completed && (
                      <button
                        id={`take-interview-${jobId}`}
                        onClick={() => navigate(`/ai-interview?jobId=${jobId}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                          bg-gradient-to-r from-primary-600 to-blue-600 text-white
                          hover:opacity-90 transition-all shadow-md shadow-primary-900/30 flex-shrink-0"
                      >
                        <Mic size={13} /> Take Interview <ArrowRight size={12} />
                      </button>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost text-sm disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-slate-400 text-sm">Page {page} of {pages}</span>
          <button
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="btn-ghost text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
