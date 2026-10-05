import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users, ArrowLeft, Briefcase, Mail, Clock,
  CheckCircle2, XCircle, ChevronDown, Trophy,
  Code2, Loader2, MapPin
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const STATUSES = ['applied', 'screening', 'interview', 'shortlisted', 'hired', 'rejected']

const statusColors = {
  applied:     'badge',
  screening:   'badge-warning',
  interview:   'badge-primary',
  shortlisted: 'badge-success',
  hired:       'badge bg-teal-400/15 text-teal-200 border-teal-400/30',
  rejected:    'badge-danger',
}

export default function JobApplicantsPage() {
  const { jobId } = useParams()
  const navigate  = useNavigate()

  const [job, setJob]               = useState(null)
  const [applicants, setApplicants] = useState([])
  const [testResults, setTestResults] = useState([])
  const [loading, setLoading]       = useState(true)
  const [updating, setUpdating]     = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [appRes, testRes] = await Promise.allSettled([
          api.get(`/applications/job/${jobId}`),
          api.get(`/coding-test/${jobId}/results`),
        ])

        if (appRes.status === 'fulfilled') {
          setApplicants(appRes.value.data.applications || [])
          // job info is usually embedded in the first application
          if (appRes.value.data.job) setJob(appRes.value.data.job)
        }
        if (testRes.status === 'fulfilled') {
          setJob(prev => prev || testRes.value.data.job)
          setTestResults(testRes.value.data.submissions || [])
        }
      } catch {
        toast.error('Failed to load applicants')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [jobId])

  const updateStatus = async (appId, status) => {
    setUpdating(appId)
    try {
      await api.patch(`/applications/${appId}/status`, { status })
      setApplicants(prev =>
        prev.map(a => a._id === appId ? { ...a, status } : a)
      )
      toast.success(`Moved to ${status}`)
    } catch {
      toast.error('Status update failed')
    } finally {
      setUpdating(null)
    }
  }

  // Build a quick lookup: candidateId → testScore
  const scoreMap = Object.fromEntries(
    testResults.map(r => [String(r.userId?._id || r.userId), r])
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-surface-700 hover:bg-surface-600 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="w-10 h-10 rounded-xl bg-primary-500/15 border border-primary-500/20 flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">
            {job?.title || 'Job'} — Applicants
          </h1>
          <p className="text-slate-400 text-sm">
            {applicants.length} applicant{applicants.length !== 1 ? 's' : ''}
            {testResults.length > 0 && ` · ${testResults.length} coding test submission${testResults.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Coding test results summary (if available) */}
      {testResults.length > 0 && (
        <div className="card bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
          <div className="flex items-center gap-2 mb-3">
            <Code2 className="w-4 h-4 text-purple-400" />
            <p className="text-white font-semibold text-sm">Coding Test Leaderboard</p>
          </div>
          <div className="space-y-2">
            {testResults.slice(0, 5).map((r, i) => (
              <div key={r._id} className="flex items-center gap-3">
                <span className="text-slate-500 text-xs w-4">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 text-xs truncate">
                    {r.userId?.name || 'Candidate'}
                    <span className="text-slate-500 ml-1">({r.userId?.email})</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-surface-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                      style={{ width: `${r.passRate || 0}%` }}
                    />
                  </div>
                  <span className="text-white font-bold text-xs w-8 text-right">{r.passRate || 0}%</span>
                  <span className={`badge text-xs ${r.verdict === 'Accepted' ? 'badge-success' : r.verdict === 'Partial' ? 'badge-warning' : 'badge-danger'}`}>
                    {r.verdict}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Applicants table */}
      {applicants.length === 0 ? (
        <div className="card text-center py-16">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No applicants yet for this job.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applicants.map((app, i) => {
            const candidate = app.candidate || app.user || {}
            const cid       = String(candidate._id || candidate)
            const testInfo  = scoreMap[cid]

            return (
              <motion.div
                key={app._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-600/30 to-accent-500/30 border border-primary-500/20 flex items-center justify-center text-primary-300 font-bold text-sm flex-shrink-0">
                    {(candidate.name || '?')[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{candidate.name || 'Unknown'}</p>
                    <div className="flex items-center gap-3 text-slate-500 text-xs mt-0.5">
                      <span className="flex items-center gap-1"><Mail size={11} /> {candidate.email}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(app.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {/* Test score badge */}
                    {testInfo && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Code2 size={11} className="text-purple-400" />
                        <span className="text-purple-300 text-xs font-medium">
                          Test: {testInfo.passRate}% — {testInfo.verdict}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status + change */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`${statusColors[app.status] || 'badge'} badge capitalize text-xs`}>
                      {app.status}
                    </span>

                    <div className="relative">
                      <select
                        className="input text-xs py-1.5 pr-7 cursor-pointer appearance-none"
                        value={app.status}
                        disabled={updating === app._id}
                        onChange={e => updateStatus(app._id, e.target.value)}
                      >
                        {STATUSES.map(s => (
                          <option key={s} value={s} className="capitalize">{s}</option>
                        ))}
                      </select>
                      {updating === app._id
                        ? <Loader2 size={13} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                        : <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      }
                    </div>
                  </div>
                </div>

                {/* Cover letter preview */}
                {app.coverLetter && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <p className="text-slate-500 text-xs mb-1 font-medium">Cover letter</p>
                    <p className="text-slate-400 text-xs line-clamp-2">{app.coverLetter}</p>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
