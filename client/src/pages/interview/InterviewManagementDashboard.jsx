import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw, Search, Filter, X, ChevronDown, ChevronUp,
  Clock, CheckCircle2, AlertCircle, Play, Inbox, BarChart3,
  User, Briefcase, ArrowLeft, FileText, Star, ScrollText,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { PageHeader, Section, StatusPill, ScoreBar, EmptyState, LoadingBlock } from '../../components/ui'

/* ── Helpers ────────────────────────────────────────────────────────────────── */

const STATUS_CONFIG = {
  pending:   { label: 'Not Started', icon: Inbox,    tone: 'neutral' },
  active:    { label: 'In Progress', icon: Play,     tone: 'accent'  },
  completed: { label: 'Completed',   icon: CheckCircle2, tone: 'positive' },
  abandoned: { label: 'Abandoned',   icon: AlertCircle, tone: 'danger' },
}

const STATUS_FILTER = [
  { value: 'all',        label: 'All Interviews' },
  { value: 'completed',  label: 'Completed' },
  { value: 'active',     label: 'In Progress' },
  { value: 'pending',    label: 'Not Started' },
  { value: 'abandoned',  label: 'Abandoned' },
]

function formatDate(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDateShort(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDuration(min) {
  if (!min && min !== 0) return '—'
  if (min < 1) return '< 1 min'
  if (min === 1) return '1 min'
  return `${min} min`
}

function InterviewStatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status || 'Unknown', icon: Inbox, tone: 'neutral' }
  const Icon = cfg.icon
  return (
    <span className={`pill-${cfg.tone} capitalize inline-flex items-center gap-1.5`}>
      <Icon size={11} strokeWidth={1.8} />
      {cfg.label}
    </span>
  )
}

function CandidateCell({ candidate }) {
  if (!candidate) return <span className="text-ink-500 text-sm">Unknown</span>
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-8 h-8 rounded-full bg-ink-100 text-ink-700 flex items-center justify-center text-xs font-semibold flex-shrink-0 overflow-hidden">
        {candidate.avatar ? (
          <img src={candidate.avatar} alt={candidate.name} className="w-full h-full object-cover" />
        ) : (
          candidate.name?.[0]?.toUpperCase() || '?'
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900 truncate">{candidate.name || 'Candidate'}</p>
        {candidate.email && (
          <p className="text-xs text-ink-500 truncate">{candidate.email}</p>
        )}
      </div>
    </div>
  )
}

function JobCell({ job, jobTitle }) {
  const title = job?.title || jobTitle || '—'
  const company = job?.company || null
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-ink-900 truncate">{title}</p>
      {company && <p className="text-xs text-ink-500 truncate">{company}</p>}
    </div>
  )
}

function ProgressCell({ answered, total }) {
  const answeredCount = answered ?? 0
  const totalCount = total ?? 0
  const pct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0

  return (
    <div className="min-w-0 w-full">
      <div className="flex items-center gap-2 text-sm">
        <span className="num text-ink-700 font-medium tabular-nums">
          {answeredCount} / {totalCount}
        </span>
        <span className="text-ink-500 text-xs">Questions</span>
      </div>
      <div className="mt-1.5 h-1.5 bg-ink-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-600 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ScoreCell({ score, evaluationStatus }) {
  if (evaluationStatus === 'unavailable') {
    return <span className="text-ink-500 text-sm italic">Not Evaluated</span>
  }
  if (evaluationStatus === 'pending' || score === undefined || score === null) {
    return <span className="text-ink-500 text-sm">Pending</span>
  }
  const val = Math.max(0, Math.min(100, Number(score) || 0))
  const color = val >= 70 ? 'text-positive-600' : val >= 40 ? 'text-warn-600' : 'text-danger-600'
  return (
    <span className={`num text-sm font-semibold ${color} tabular-nums`}>
      {val}
    </span>
  )
}

/* ── Stat Card ──────────────────────────────────────────────────────────────── */

function StatCard({ label, value, icon: Icon, color = 'text-accent-600', note }) {
  return (
    <div className="card-pad flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl bg-${color === 'text-accent-600' ? 'accent' : color === 'text-positive-600' ? 'positive' : color === 'text-warn-600' ? 'warn' : 'danger'}-50 flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className={color} strokeWidth={1.7} />
      </div>
      <div>
        <p className="text-xs text-ink-500">{label}</p>
        <p className="num text-[28px] leading-[1.1] font-semibold text-ink-900 mt-0.5">
          {value}
        </p>
        {note && <p className="text-xs text-ink-500 mt-0.5">{note}</p>}
      </div>
    </div>
  )
}

/* ── Main Component ─────────────────────────────────────────────────────────── */

export default function InterviewManagementDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState(null)
  const [sessions, setSessions] = useState([])
  const [pagination, setPagination] = useState(null)
  const [error, setError] = useState(null)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [jobFilter, setJobFilter] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [page, setPage] = useState(1)
  const [jobs, setJobs] = useState([])

  const fetchJobs = useCallback(async () => {
    try {
      const { data } = await api.get('/jobs?status=active')
      setJobs(data.jobs || [])
    } catch { /* keep existing jobs */ }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/interview/recruiter/interviews/stats')
      setStats(data)
    } catch (err) {
      toast.error('Could not load statistics')
    }
  }, [])

  const fetchSessions = useCallback(async (pageNum = page, preserveFilters = true) => {
    setLoading(true)
    setError(null)
    try {
      const params = {
        page: pageNum,
        limit: 20,
        sortBy,
        sortOrder,
      }
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter
      if (search.trim()) params.search = search.trim()
      if (jobFilter) params.jobId = jobFilter

      const { data } = await api.get('/interview/recruiter/interviews', { params })
      setSessions(data.sessions || [])
      setPagination(data.pagination || null)
      setPage(data.pagination?.page || pageNum)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load interviews')
      setSessions([])
      setPagination(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [statusFilter, search, jobFilter, sortBy, sortOrder, page])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        await Promise.all([fetchStats(), fetchJobs()])
      } catch { /* individual errors handled inside */ }
      await fetchSessions(1)
    }
    load()
  }, [fetchStats, fetchJobs, fetchSessions])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchStats(), fetchJobs()])
    await fetchSessions(page, false)
  }

  // When filters change, reset to page 1
  const applyFilters = () => {
    setPage(1)
    fetchSessions(1)
  }

  const handleStatusChange = (value) => {
    setStatusFilter(value)
    setPage(1)
    fetchSessions(1)
  }

  const handleSearch = (value) => {
    setSearch(value)
    setPage(1)
    fetchSessions(1)
  }

  const handleJobChange = (value) => {
    setJobFilter(value)
    setPage(1)
    fetchSessions(1)
  }

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    fetchSessions(page)
  }

  const sortIndicator = (field) => {
    if (sortBy !== field) return null
    return sortOrder === 'asc' ? (
      <ChevronUp size={14} className="text-ink-500 inline ml-0.5" />
    ) : (
      <ChevronDown size={14} className="text-ink-500 inline ml-0.5" />
    )
  }

  const clearSearch = () => {
    setSearch('')
    setPage(1)
    fetchSessions(1)
  }

  const getAnsweredCount = (session) => {
    if (!session.answers) return session.questionCount || 0
    return session.answers.filter(a => (a.answerText || '').trim().length > 0).length
  }

  const getTotalQuestions = (session) => {
    if (!session.answers) return session.questionCount || 0
    return session.answers.length
  }

  if (loading && sessions.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="AI Interview Management"
          description="Monitor candidate interviews, review AI assessments, and track interview progress."
          actions={
            <RefreshCw size={15} className={`text-ink-500 animate-spin ${refreshing ? '' : 'opacity-0'}`} />
          }
        />
        <LoadingBlock label="Loading interviews..." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <PageHeader
        title="AI Interview Management"
        description="Monitor candidate interviews, review AI assessments, and track interview progress."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-secondary btn-sm"
              title="Refresh"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        }
      />

      {/* Statistics */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={15} className="text-accent-600" />
          <h2 className="text-[15px] font-semibold text-ink-900">Interview Overview</h2>
        </div>
        {stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard
              label="Total Interviews"
              value={stats.total}
              icon={Inbox}
              color="text-ink-600"
            />
            <StatCard
              label="Completed"
              value={stats.completed}
              icon={CheckCircle2}
              color="text-positive-600"
            />
            <StatCard
              label="In Progress"
              value={stats.inProgress}
              icon={Play}
              color="text-accent-600"
            />
            <StatCard
              label="Not Started"
              value={stats.notStarted}
              icon={Clock}
              color="text-warn-600"
            />
            <StatCard
              label="Abandoned"
              value={stats.abandoned}
              icon={AlertCircle}
              color="text-danger-600"
            />
          </div>
        ) : (
          <div className="card-pad py-8 text-center text-ink-500 text-sm">
            Loading statistics…
          </div>
        )}
      </section>

      {/* Filters */}
      <section className="card-pad">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              className="input pl-8"
              placeholder="Search candidates…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => { setSearch(''); handleSearch('') }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status filter */}
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <select
              className="input pl-8 pr-7 appearance-none cursor-pointer"
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              {STATUS_FILTER.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          </div>

          {/* Job filter */}
          <div className="relative">
            <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <select
              className="input pl-8 pr-7 appearance-none cursor-pointer"
              value={jobFilter}
              onChange={(e) => handleJobChange(e.target.value)}
            >
              <option value="">All Jobs</option>
              {jobs.map(j => (
                <option key={j._id} value={j._id}>{j.title}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 text-sm text-ink-500">
            <button
              onClick={() => handleSort('createdAt')}
              className="flex items-center gap-1 hover:text-ink-900 transition-colors"
            >
              Started {sortIndicator('createdAt')}
            </button>
            <span className="text-ink-300">|</span>
            <button
              onClick={() => handleSort('scores.overall')}
              className="flex items-center gap-1 hover:text-ink-900 transition-colors"
            >
              Score {sortIndicator('scores.overall')}
            </button>
            <span className="text-ink-300">|</span>
            <button
              onClick={() => handleSort('startedAt')}
              className="flex items-center gap-1 hover:text-ink-900 transition-colors"
            >
              Date {sortIndicator('startedAt')}
            </button>
          </div>
        </div>

        {/* Active filter labels */}
        {(statusFilter !== 'all' || jobFilter || search) && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent-50 text-accent-700 text-xs font-medium rounded-md">
                Status: {STATUS_FILTER.find(f => f.value === statusFilter)?.label}
                <button onClick={() => handleStatusChange('all')} className="ml-1 hover:text-accent-900">
                  <X size={12} />
                </button>
              </span>
            )}
            {jobFilter && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-ink-100 text-ink-700 text-xs font-medium rounded-md">
                Job: {jobs.find(j => j._id === jobFilter)?.title || 'Unknown'}
                <button onClick={() => { setJobFilter(''); handleJobChange('') }} className="ml-1 hover:text-ink-900">
                  <X size={12} />
                </button>
              </span>
            )}
            {search && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-ink-100 text-ink-700 text-xs font-medium rounded-md">
                Search: "{search}"
                <button onClick={clearSearch} className="ml-1 hover:text-ink-900">
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
        )}
      </section>

      {/* Table */}
      <section className="card overflow-hidden">
        {error && (
          <div className="px-5 py-3 bg-warn-50 text-warn-700 text-sm border-b border-warn-100">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
              <button onClick={() => fetchSessions(page)} className="ml-auto text-accent-700 hover:text-accent-800 font-medium">
                Retry
              </button>
            </div>
          </div>
        )}

        {sessions.length === 0 && !loading ? (
          <div className="p-8">
            <EmptyState
              icon={Inbox}
              title="No interviews found"
              description={
                search || statusFilter !== 'all' || jobFilter
                  ? 'Try adjusting your filters or search terms.'
                  : 'No candidate interviews have been recorded yet. Interviews appear here when candidates start their AI interviews or when you schedule one.'
              }
              action={
                <button onClick={() => { setStatusFilter('all'); setSearch(''); setJobFilter(''); fetchSessions(1) }} className="btn-secondary btn-sm">
                  Clear filters
                </button>
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th className="th w-[200px]">Candidate</th>
                    <th className="th w-[180px]">Job Position</th>
                    <th className="th">
                      <button onClick={() => handleSort('status')} className="flex items-center gap-1 hover:text-ink-900 w-full">
                        Interview Status {sortIndicator('status')}
                      </button>
                    </th>
                    <th className="th w-[130px]">Progress</th>
                    <th className="th w-[100px]">
                      <button onClick={() => handleSort('scores.overall')} className="flex items-center gap-1 hover:text-ink-900 w-full">
                        AI Score {sortIndicator('scores.overall')}
                      </button>
                    </th>
                    <th className="th w-[90px]">Duration</th>
                    <th className="th w-[140px]">
                      <button onClick={() => handleSort('startedAt')} className="flex items-center gap-1 hover:text-ink-900 w-full">
                        Started At {sortIndicator('startedAt')}
                      </button>
                    </th>
                    <th className="th w-[140px]">Completed At</th>
                    <th className="th w-[100px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(session => {
                    const candidate = session.candidate
                    const job = session.job
                    const answered = getAnsweredCount(session)
                    const total = getTotalQuestions(session)

                    return (
                      <tr
                        key={session._id}
                        className="cursor-pointer hover:bg-ink-50 transition-colors"
                        onClick={() => navigate(`/interviews/${session._id}`)}
                      >
                        <td className="td">
                          <CandidateCell candidate={candidate} />
                        </td>
                        <td className="td">
                          <JobCell job={job} jobTitle={session.jobTitle} />
                        </td>
                        <td className="td">
                          <InterviewStatusPill status={session.status} />
                          {session.initiatedBy && (
                            <span className="text-[10px] text-ink-400 ml-1.5 capitalize">
                              ({session.initiatedBy})
                            </span>
                          )}
                        </td>
                        <td className="td">
                          <ProgressCell answered={answered} total={total} />
                        </td>
                        <td className="td">
                          <ScoreCell
                            score={session.scores?.overall ?? session.finalScore}
                            evaluationStatus={session.evaluationStatus}
                          />
                        </td>
                        <td className="td">
                          <span className="num text-sm text-ink-700">
                            {formatDuration(session.durationMin)}
                          </span>
                        </td>
                        <td className="td text-sm text-ink-700">
                          <span className="num">{formatDateShort(session.startedAt)}</span>
                        </td>
                        <td className="td text-sm text-ink-700">
                          {session.completedAt ? (
                            <span className="num">{formatDateShort(session.completedAt)}</span>
                          ) : (
                            <span className="text-ink-400">—</span>
                          )}
                        </td>
                        <td className="td text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/interviews/${session._id}`) }}
                            className="btn-ghost btn-sm text-accent-700 hover:text-accent-800 hover:bg-accent-50"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-line bg-ink-50">
                <span className="num text-sm text-ink-500">
                  Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} interviews
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchSessions(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="btn-ghost btn-sm"
                  >
                    <ChevronLeft size={14} />
                    Previous
                  </button>
                  <span className="num text-sm text-ink-500">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => fetchSessions(pagination.page + 1)}
                    disabled={pagination.page >= pagination.pages}
                    className="btn-ghost btn-sm"
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
