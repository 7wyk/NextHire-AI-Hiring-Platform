import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Code2, Mail, ChevronDown, Loader2 } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  PageHeader, StatusPill, EmptyState, Section, LoadingBlock, ScoreBar,
} from '../../components/ui'

const STAGES = ['applied', 'screening', 'interview', 'shortlisted', 'hired', 'rejected']

export default function JobApplicantsPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()

  const [job, setJob] = useState(null)
  const [applicants, setApplicants] = useState([])
  const [testResults, setTestResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [appRes, testRes] = await Promise.allSettled([
          api.get(`/applications/job/${jobId}`),
          api.get(`/coding-test/${jobId}/results`),
        ])

        if (appRes.status === 'fulfilled') {
          setApplicants(appRes.value.data.applications || [])
          if (appRes.value.data.job) setJob(appRes.value.data.job)
        }
        if (testRes.status === 'fulfilled') {
          setJob(prev => prev || testRes.value.data.job)
          setTestResults(testRes.value.data.submissions || [])
        }
      } catch {
        toast.error('Could not load applicants')
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
      setApplicants(prev => prev.map(a => a._id === appId ? { ...a, status } : a))
      toast.success(`Moved to ${status}`)
    } catch {
      toast.error('Status update failed')
    } finally {
      setUpdating(null)
    }
  }

  const scoreMap = Object.fromEntries(
    testResults.map(r => [String(r.userId?._id || r.userId), r])
  )

  if (loading) {
    return (
      <div className="card">
        <LoadingBlock label="Loading applicants" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={job?.title || 'Applicants'}
        description={[
          job?.company,
          `${applicants.length} applicant${applicants.length === 1 ? '' : 's'}`,
          testResults.length > 0
            ? `${testResults.length} coding submission${testResults.length === 1 ? '' : 's'}`
            : null,
        ].filter(Boolean).join(' · ')}
        actions={
          <button onClick={() => navigate(-1)} className="btn-secondary btn-sm sm:h-9 sm:px-3.5">
            <ArrowLeft size={14} strokeWidth={1.8} />
            Back
          </button>
        }
      />

      {testResults.length > 0 && (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-4 mb-4">
          <Section title="Coding submissions" padded={false}>
            <table className="table">
              <thead>
                <tr>
                  <th className="th w-10">#</th>
                  <th className="th">Candidate</th>
                  <th className="th">Pass rate</th>
                  <th className="th">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {testResults.map((r, i) => (
                  <tr key={r._id} className="hover:bg-ink-50/60">
                    <td className="td num text-ink-400 text-[12.5px]">{i + 1}</td>
                    <td className="td">
                      <p className="text-ink-900">{r.userId?.name || 'Candidate'}</p>
                      <p className="text-[12px] text-ink-500 truncate">{r.userId?.email}</p>
                    </td>
                    <td className="td w-[150px]">
                      <ScoreBar value={r.passRate || 0} />
                    </td>
                    <td className="td">
                      <span className={`pill-${
                        r.verdict === 'Accepted' ? 'positive'
                        : r.verdict === 'Partial' ? 'warn' : 'danger'
                      }`}>
                        {r.verdict}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Stage counts">
            <dl className="space-y-2.5">
              {STAGES.map(stage => (
                <div key={stage} className="flex items-center justify-between">
                  <dt><StatusPill status={stage} /></dt>
                  <dd className="num text-[13px] text-ink-800">
                    {applicants.filter(a => a.status === stage).length}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      )}

      <div className="card overflow-hidden">
        {applicants.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No applicants yet"
            description="Applications for this role appear here as candidates apply."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Candidate</th>
                  <th className="th">Applied</th>
                  <th className="th">Coding test</th>
                  <th className="th">Stage</th>
                  <th className="th w-[150px]">Move to</th>
                </tr>
              </thead>
              <tbody>
                {applicants.map(app => {
                  const candidate = app.candidate || app.user || {}
                  const cid = String(candidate._id || candidate)
                  const testInfo = scoreMap[cid]

                  return (
                    <tr key={app._id} className="hover:bg-ink-50/60 transition-colors">
                      <td className="td">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-md bg-ink-100 text-ink-600 text-[11.5px] font-medium flex items-center justify-center flex-shrink-0">
                            {(candidate.name || '?')[0]?.toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="text-ink-900 truncate">{candidate.name || 'Unknown'}</p>
                            <p className="text-[12px] text-ink-500 flex items-center gap-1 truncate">
                              <Mail size={10} strokeWidth={1.8} />
                              {candidate.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="td num text-[12.5px] text-ink-500 whitespace-nowrap">
                        {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="td">
                        {testInfo ? (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-700">
                            <Code2 size={12} className="text-ink-400" strokeWidth={1.8} />
                            <span className="num">{testInfo.passRate}%</span>
                            <span className="text-ink-400">·</span>
                            {testInfo.verdict}
                          </span>
                        ) : (
                          <span className="text-[12.5px] text-ink-400">Not taken</span>
                        )}
                      </td>
                      <td className="td"><StatusPill status={app.status} /></td>
                      <td className="td">
                        <div className="relative">
                          <select
                            className="input h-8 text-[12.5px] pr-7"
                            value={app.status}
                            disabled={updating === app._id}
                            onChange={e => updateStatus(app._id, e.target.value)}
                            aria-label={`Stage for ${candidate.name || 'candidate'}`}
                          >
                            {STAGES.map(s => (
                              <option key={s} value={s} className="capitalize">{s}</option>
                            ))}
                          </select>
                          {updating === app._id
                            ? <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-ink-400" />
                            : <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                          }
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {applicants.some(a => a.coverLetter) && (
        <div className="mt-4">
          <Section title="Cover letters" padded={false}>
            <ul className="divide-y divide-line">
              {applicants.filter(a => a.coverLetter).map(app => (
                <li key={app._id} className="px-5 py-3.5">
                  <p className="text-[12.5px] text-ink-900 font-medium">
                    {app.candidate?.name || 'Candidate'}
                  </p>
                  <p className="text-[12.5px] text-ink-600 mt-1 leading-6 whitespace-pre-line">
                    {app.coverLetter}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}
    </div>
  )
}
