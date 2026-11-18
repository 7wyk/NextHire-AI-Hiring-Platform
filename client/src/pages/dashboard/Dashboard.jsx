import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, ClipboardList, Code2, MessageSquare, ScanText,
  Trophy, Users, Plus, Search,
} from 'lucide-react'
import api from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import {
  PageHeader, Section, Stat, StatRow, StatusPill, EmptyState, LoadingBlock,
} from '../../components/ui'

/* ── Pipeline: one stacked bar, one accent ──────────────────────────────── */

const STAGES = [
  { key: 'applied',     label: 'Applied',     color: '#d8d2c8' },
  { key: 'screening',   label: 'Screening',   color: '#b5aea3' },
  { key: 'interview',   label: 'Interview',   color: '#1d4b6e' },
  { key: 'shortlisted', label: 'Shortlisted', color: '#57534c' },
  { key: 'hired',       label: 'Hired',       color: '#1c1a17' },
]

function Pipeline({ pipeline, rejected }) {
  const total = STAGES.reduce((sum, s) => sum + (pipeline[s.key] || 0), 0)

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="num text-[24px] font-medium text-ink-900">{total}</p>
        <p className="text-[12px] text-ink-500">applications in pipeline</p>
      </div>

      <div className="flex h-2 rounded-full overflow-hidden bg-ink-100 mt-3">
        {STAGES.map(s => {
          const share = total > 0 ? ((pipeline[s.key] || 0) / total) * 100 : 0
          if (share === 0) return null
          return (
            <div
              key={s.key}
              title={`${s.label}: ${pipeline[s.key]}`}
              style={{ width: `${share}%`, backgroundColor: s.color }}
            />
          )
        })}
      </div>

      <dl className="mt-5 space-y-2.5">
        {STAGES.map(s => {
          const count = pipeline[s.key] || 0
          const share = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div key={s.key} className="flex items-center gap-2.5">
              <span
                className="w-2 h-2 rounded-[2px] flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <dt className="text-[13px] text-ink-700 flex-1">{s.label}</dt>
              <dd className="num text-[13px] text-ink-900 w-6 text-right">{count}</dd>
              <dd className="num text-[11.5px] text-ink-400 w-9 text-right">{share}%</dd>
            </div>
          )
        })}
      </dl>

      {rejected > 0 && (
        <p className="text-[12px] text-ink-500 mt-4 pt-3 border-t border-line">
          <span className="num text-ink-700">{rejected}</span> rejected and out of the pipeline
        </p>
      )}
    </div>
  )
}

/* ── Recruiter ──────────────────────────────────────────────────────────── */

function RecruiterDashboard() {
  const EMPTY = {
    applications: 0, candidates: 0, interviews: 0, resumesScreened: 0, jobs: 0,
    pipeline: { applied: 0, screening: 0, interview: 0, shortlisted: 0, hired: 0, rejected: 0 },
  }
  const [stats, setStats] = useState(EMPTY)
  const [recentApplications, setRecentApplications] = useState([])
  const [recentJobs, setRecentJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const fetchDashboard = async () => {
      try {
        const { data } = await api.get('/dashboard', {
          headers: { 'Cache-Control': 'no-cache' },
          params: { _ts: Date.now() },
        })
        if (!active) return

        setStats({
          applications: data.applications ?? 0,
          candidates: data.candidates ?? 0,
          interviews: data.interviews ?? 0,
          resumesScreened: data.resumesScreened ?? 0,
          jobs: data.jobs ?? 0,
          pipeline: {
            applied: data.pipeline?.applied ?? 0,
            screening: data.pipeline?.screening ?? 0,
            interview: data.pipeline?.interview ?? 0,
            shortlisted: data.pipeline?.shortlisted ?? 0,
            hired: data.pipeline?.hired ?? 0,
            rejected: data.pipeline?.rejected ?? 0,
          },
        })
        setRecentApplications(data.recentApplications || [])
        setRecentJobs(data.recentJobs || [])
      } catch {
        /* the empty state carries the message */
      } finally {
        if (active) setLoading(false)
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') fetchDashboard()
    }

    fetchDashboard()
    window.addEventListener('focus', fetchDashboard)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    const timer = window.setInterval(fetchDashboard, 30000)

    return () => {
      active = false
      window.removeEventListener('focus', fetchDashboard)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Overview"
        description="Live application pipeline across your open roles."
        actions={
          <>
            <Link to="/resume-ai" className="btn-secondary btn-sm sm:h-9 sm:px-3.5">
              <ScanText size={14} strokeWidth={1.7} />
              Screen a resume
            </Link>
            <Link to="/jobs" className="btn-primary btn-sm sm:h-9 sm:px-3.5">
              <Plus size={14} strokeWidth={1.9} />
              New job
            </Link>
          </>
        }
      />

      <StatRow>
        <Stat label="Open roles" value={stats.jobs} />
        <Stat
          label="Applications"
          value={stats.applications}
          note={`${stats.candidates} unique candidate${stats.candidates === 1 ? '' : 's'}`}
        />
        <Stat label="Resumes screened" value={stats.resumesScreened} />
        <Stat label="Interviews completed" value={stats.interviews} />
      </StatRow>

      <div className="grid lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-4 mt-4">
        <Section
          title="Recent applications"
          padded={false}
          action={
            <Link to="/candidates" className="text-[12.5px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1">
              All candidates <ArrowRight size={12} />
            </Link>
          }
        >
          {loading ? (
            <LoadingBlock label="Loading applications" />
          ) : recentApplications.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No applications yet"
              description="Applications appear here as soon as a candidate applies to one of your roles."
              action={<Link to="/jobs" className="btn-secondary btn-sm">Create a job</Link>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="th">Candidate</th>
                    <th className="th">Role</th>
                    <th className="th">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {recentApplications.map(app => (
                    <tr key={app._id} className="hover:bg-ink-50/60 transition-colors">
                      <td className="td">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-md bg-ink-100 text-ink-600 text-[11px] font-medium flex items-center justify-center flex-shrink-0">
                            {(app.candidate?.name || '?')[0]?.toUpperCase()}
                          </span>
                          <span className="text-ink-900 truncate">
                            {app.candidate?.name || 'Candidate'}
                          </span>
                        </div>
                      </td>
                      <td className="td text-ink-600 max-w-[220px] truncate">
                        {app.job?.title || 'Position'}
                      </td>
                      <td className="td">
                        <StatusPill status={app.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Pipeline">
          <Pipeline pipeline={stats.pipeline} rejected={stats.pipeline.rejected} />
        </Section>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-4 mt-4">
        <Section
          title="Open roles"
          padded={false}
          action={
            <Link to="/jobs" className="text-[12.5px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1">
              Manage jobs <ArrowRight size={12} />
            </Link>
          }
        >
          {recentJobs.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No roles published"
              description="Publish a role to start collecting applications."
            />
          ) : (
            <ul className="divide-y divide-line">
              {recentJobs.map(job => (
                <li key={job._id}>
                  <Link
                    to={`/jobs/${job._id}/applicants`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] text-ink-900 truncate">{job.title}</p>
                      <p className="text-[12px] text-ink-500 truncate">
                        {job.company}
                        {job.location ? ` · ${job.location}` : ''}
                      </p>
                    </div>
                    <span className="num text-[12px] text-ink-600 flex-shrink-0">
                      {job.applicantCount || 0} applied
                    </span>
                    <StatusPill status={job.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Next steps">
          <ul className="space-y-1 -mx-2">
            {[
              { to: '/resume-ai', icon: ScanText, label: 'Screen resumes', note: 'Score a resume against a job' },
              { to: '/create-coding-test', icon: Code2, label: 'Create a coding test', note: 'Generate questions for a role' },
              { to: '/ranking', icon: Trophy, label: 'Open rankings', note: 'Compare candidates by score' },
              { to: '/agent-monitor', icon: MessageSquare, label: 'Agent monitor', note: 'Check the agent system' },
            ].map(item => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-ink-50 transition-colors group"
                >
                  <item.icon size={15} strokeWidth={1.6} className="text-ink-400" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] text-ink-800">{item.label}</span>
                    <span className="block text-[11.5px] text-ink-500">{item.note}</span>
                  </span>
                  <ArrowRight size={13} className="text-ink-300 group-hover:text-ink-600" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  )
}

/* ── Candidate ──────────────────────────────────────────────────────────── */

function CandidateDashboard({ user }) {
  const [applications, setApplications] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.get('/applications/mine', { params: { limit: 5 } })
      .then(({ data }) => {
        if (!active) return
        setApplications(data.applications || [])
        setTotal(data.total ?? (data.applications || []).length)
      })
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Your workspace"
        description={`Signed in as ${user?.name || 'candidate'}. Applications, assessments and interviews.`}
        actions={
          <Link to="/public-jobs" className="btn-primary btn-sm sm:h-9 sm:px-3.5">
            <Search size={14} strokeWidth={1.8} />
            Browse jobs
          </Link>
        }
      />

      <StatRow>
        <Stat label="Applications" value={loading ? '—' : total} />
        <Stat
          label="In interview"
          value={loading ? '—' : applications.filter(a => a.status === 'interview').length}
        />
        <Stat
          label="Shortlisted"
          value={loading ? '—' : applications.filter(a => a.status === 'shortlisted' || a.status === 'hired').length}
        />
        <Stat
          label="Not selected"
          value={loading ? '—' : applications.filter(a => a.status === 'rejected').length}
        />
      </StatRow>

      <div className="grid lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-4 mt-4">
        <Section
          title="Recent applications"
          padded={false}
          action={
            <Link to="/my-applications" className="text-[12.5px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          }
        >
          {loading ? (
            <LoadingBlock label="Loading applications" />
          ) : applications.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No applications yet"
              description="Browse open roles and apply with your resume."
              action={<Link to="/public-jobs" className="btn-secondary btn-sm">Browse jobs</Link>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {applications.map(app => (
                <li key={app._id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] text-ink-900 truncate">
                      {app.job?.title || 'Job no longer available'}
                    </p>
                    <p className="text-[12px] text-ink-500 truncate">
                      {app.job?.company || '—'}
                    </p>
                  </div>
                  <StatusPill status={app.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Assessments">
          <ul className="space-y-1 -mx-2">
            {[
              { to: '/ai-interview', icon: MessageSquare, label: 'AI interview', note: 'Five questions, voice or text' },
              { to: '/coding', icon: Code2, label: 'Coding sandbox', note: 'Practise in the editor' },
              { to: '/my-applications', icon: ClipboardList, label: 'Application status', note: 'Tests and interviews per role' },
            ].map(item => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-ink-50 transition-colors group"
                >
                  <item.icon size={15} strokeWidth={1.6} className="text-ink-400" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] text-ink-800">{item.label}</span>
                    <span className="block text-[11.5px] text-ink-500">{item.note}</span>
                  </span>
                  <ArrowRight size={13} className="text-ink-300 group-hover:text-ink-600" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuthStore()
  if (user?.role === 'candidate') return <CandidateDashboard user={user} />
  return <RecruiterDashboard />
}
