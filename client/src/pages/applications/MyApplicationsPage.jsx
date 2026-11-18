import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, MapPin, Trash2, ChevronDown, Code2, ArrowRight,
  FileText, ExternalLink, Mic, CheckCircle2, Loader2,
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  PageHeader, StatusPill, EmptyState, LoadingBlock, Pagination,
} from '../../components/ui'

const STATUS_LABEL = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  shortlisted: 'Shortlisted',
  hired: 'Hired',
  rejected: 'Not selected',
}

export default function MyApplicationsPage() {
  const navigate = useNavigate()

  const [applications, setApplications] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [withdrawing, setWithdrawing] = useState(null)
  const [testJobIds, setTestJobIds] = useState(new Set())
  const [interviewStatuses, setInterviewStatuses] = useState({})

  const fetchApplications = async () => {
    setLoading(true)
    try {
      const params = { page, limit: 10 }
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/applications/mine', { params })
      setApplications(data.applications || [])
      setTotal(data.total || 0)
      setPages(data.pages || 1)

      const jobIds = [...new Set((data.applications || []).map(a => a.job?._id).filter(Boolean))]

      // Assessment availability now arrives with the applications payload.
      // This used to call GET /coding-test/:jobId per job, which STARTED the
      // assessment timer just by opening this page.
      setTestJobIds(new Set(
        (data.applications || [])
          .filter(a => a.assessment?.hasTest && a.job?._id)
          .map(a => a.job._id)
      ))

      const ivStatuses = {}
      await Promise.allSettled(
        jobIds.map(async id => {
          try {
            const { data: s } = await api.get(`/interview/candidate/status/${id}`)
            ivStatuses[id] = s
          } catch { /* no session yet */ }
        })
      )
      setInterviewStatuses(ivStatuses)
    } catch {
      toast.error('Could not load your applications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchApplications() }, [statusFilter, page])
  useEffect(() => { setPage(1) }, [statusFilter])

  const handleWithdraw = async (appId) => {
    if (!window.confirm('Withdraw this application? This cannot be undone.')) return
    setWithdrawing(appId)
    try {
      await api.delete(`/applications/${appId}`)
      setApplications(prev => prev.filter(a => a._id !== appId))
      setTotal(prev => Math.max(0, prev - 1))
      toast.success('Application withdrawn')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Withdraw failed')
    } finally {
      setWithdrawing(null)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="My applications"
        description={`${total} application${total === 1 ? '' : 's'} in your history`}
        actions={
          <div className="relative">
            <select
              className="input w-auto min-w-[150px] pr-8"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          </div>
        }
      />

      {loading ? (
        <div className="card"><LoadingBlock label="Loading applications" /></div>
      ) : applications.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title={statusFilter ? 'No applications with that status' : 'No applications yet'}
            description={statusFilter
              ? 'Clear the filter to see every application.'
              : 'Browse the open roles and apply with your resume.'}
            action={!statusFilter && (
              <button onClick={() => navigate('/public-jobs')} className="btn-primary btn-sm">
                Browse jobs
              </button>
            )}
          />
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-line">
          {applications.map(app => {
            const status = app.status || 'applied'
            const jobId = app.job?._id
            const hasTest = Boolean(jobId && testJobIds.has(jobId))
            const assessment = app.assessment || null
            const testSubmitted = Boolean(assessment?.alreadySubmitted)
            const interviewDone = Boolean(interviewStatuses[jobId]?.completed)

            return (
              <div key={app._id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-ink-900">
                      {app.job?.title || 'Job no longer available'}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-500 mt-1">
                      <span>{app.job?.company || '—'}</span>
                      {app.job?.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} strokeWidth={1.8} /> {app.job.location}
                        </span>
                      )}
                      <span className="num">
                        Applied {new Date(app.createdAt).toLocaleDateString()}
                      </span>
                      {app.resumeUrl ? (
                        <a
                          href={app.resumeUrl.startsWith('http')
                            ? app.resumeUrl
                            : `${import.meta.env.VITE_API_URL?.replace('/api', '')}${app.resumeUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-accent-600 hover:underline"
                        >
                          <FileText size={11} strokeWidth={1.8} /> Resume
                          <ExternalLink size={9} />
                        </a>
                      ) : (
                        <span className="text-ink-400">No resume attached</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusPill status={status} />
                    {status === 'applied' && (
                      <button
                        id={`withdraw-${app._id}`}
                        onClick={() => handleWithdraw(app._id)}
                        disabled={withdrawing === app._id}
                        className="p-1.5 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                        title="Withdraw application"
                        aria-label="Withdraw application"
                      >
                        {withdrawing === app._id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Trash2 size={13} strokeWidth={1.8} />
                        }
                      </button>
                    )}
                  </div>
                </div>

                {(hasTest || jobId) && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 pt-3 border-t border-line">
                    {hasTest && (
                      <div className="flex items-center gap-2">
                        <Code2 size={12} className="text-ink-400" strokeWidth={1.8} />
                        <span className="text-[12px] text-ink-500">Coding assessment</span>
                        {testSubmitted ? (
                          <span className="inline-flex items-center gap-1 text-[12px] text-positive-600">
                            <CheckCircle2 size={12} strokeWidth={1.8} />
                            Submitted{typeof assessment?.score === 'number' ? ` · ${assessment.score}%` : ''}
                          </span>
                        ) : assessment?.testAvailable === false ? (
                          <span className="text-[12px] text-warn-600">
                            Attempt expired — contact the recruiter
                          </span>
                        ) : (
                          <>
                            <button
                              id={`take-test-${jobId}`}
                              onClick={() => navigate(`/coding-test/${jobId}`)}
                              className="btn-secondary btn-sm"
                            >
                              {assessment?.attemptStatus === 'in_progress'
                                ? 'Resume test'
                                : assessment?.attemptStatus === 'expired'
                                  ? 'Restart test'
                                  : 'Open test'}
                              <ArrowRight size={12} />
                            </button>
                            {assessment?.attemptStatus === 'in_progress' && assessment?.remainingMs >= 0 && (
                              <span className="text-[11px] text-ink-400 num">
                                {Math.floor(assessment.remainingMs / 60000)} min left
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {jobId && (
                      <div className="flex items-center gap-2">
                        <Mic size={12} className="text-ink-400" strokeWidth={1.8} />
                        <span className="text-[12px] text-ink-500">AI interview</span>
                        {interviewDone ? (
                          <span className="inline-flex items-center gap-1 text-[12px] text-positive-600">
                            <CheckCircle2 size={12} strokeWidth={1.8} /> Completed
                          </span>
                        ) : (
                          <button
                            id={`take-interview-${jobId}`}
                            onClick={() => navigate(`/ai-interview?jobId=${jobId}`)}
                            className="btn-secondary btn-sm"
                          >
                            Start interview
                            <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4">
        <Pagination page={page} pages={pages} onChange={setPage} />
      </div>
    </div>
  )
}
