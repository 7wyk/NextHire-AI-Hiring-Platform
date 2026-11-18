import { useState, useEffect } from 'react'
import { ChevronDown, Search, Trophy, AlertCircle } from 'lucide-react'
import api from '../../services/api'
import {
  PageHeader, Stat, StatRow, EmptyState, LoadingBlock, ScoreBar, StatusPill,
} from '../../components/ui'
import InterviewCell from '../../components/InterviewCell'
import AssessmentCell from '../../components/AssessmentCell'

const tier = (score) => {
  if (score >= 85) return 'Top'
  if (score >= 65) return 'Strong'
  if (score >= 45) return 'Average'
  return 'Below average'
}

export default function RankingPage() {
  const [jobs, setJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState('')
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/jobs').then(r => {
      const list = r.data.jobs || r.data || []
      setJobs(list)
      if (list.length > 0) setSelectedJob(list[0]._id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedJob) return
    setLoading(true)
    setError('')
    api.get(`/candidates/rankings?jobId=${selectedJob}`)
      .then(r => setRankings(r.data.rankings || []))
      .catch(e => {
        setError(e.response?.data?.message || 'Could not load rankings for this job')
        setRankings([])
      })
      .finally(() => setLoading(false))
  }, [selectedJob])

  const filtered = rankings.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  const avgTotal = filtered.length
    ? Math.round(filtered.reduce((s, c) => s + (c.totalScore || 0), 0) / filtered.length)
    : 0
  const shortlisted = filtered.filter(c => c.status === 'shortlisted').length
  const withSubmission = filtered.filter(c => c.submission).length

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Rankings"
        description="Resume, coding and interview scores combined into one weighted figure."
      />

      <div className="flex flex-wrap items-center gap-2 pb-4">
        <div className="relative">
          <select
            value={selectedJob}
            onChange={e => setSelectedJob(e.target.value)}
            className="input w-auto min-w-[240px] pr-8"
            aria-label="Job"
          >
            {jobs.length === 0 && <option value="">No jobs yet</option>}
            {jobs.map(j => (
              <option key={j._id} value={j._id}>{j.title} — {j.company}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-[260px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search candidates"
            className="input pl-8"
            aria-label="Search candidates"
          />
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="mb-4">
          <StatRow>
            <Stat label="Ranked candidates" value={filtered.length} />
            <Stat label="Average score" value={avgTotal} />
            <Stat label="Shortlisted" value={shortlisted} />
            <Stat label="Coding submissions" value={withSubmission} />
          </StatRow>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 mb-4 rounded-lg bg-danger-50 border border-danger-100 text-[13px] text-danger-700">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <LoadingBlock label="Loading rankings" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No ranked candidates yet"
            description="Rankings appear once candidates have a resume, coding or interview score for this job."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="th w-12">Rank</th>
                  <th className="th">Candidate</th>
                  <th className="th w-[140px]">Resume</th>
                  <th className="th w-[140px]">Coding</th>
                  <th className="th w-[140px]">Interview</th>
                  <th className="th text-right">Total</th>
                  <th className="th">Standing</th>
                  <th className="th">Coding verdict</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => (
                  <tr key={c._id} className="hover:bg-ink-50/60 transition-colors">
                    <td className="td num text-ink-400 text-[12.5px]">
                      {/* Server-assigned rank: searching never renumbers it */}
                      {String(c.rank ?? idx + 1).padStart(2, '0')}
                    </td>
                    <td className="td">
                      <p className="text-ink-900">{c.name}</p>
                      <p className="text-[12px] text-ink-500 truncate max-w-[220px]">{c.email}</p>
                    </td>
                    <td className="td">
                      <AssessmentCell status={c.resumeStatus} score={c.resumeScore} />
                    </td>
                    <td className="td">
                      <AssessmentCell status={c.codingStatus} score={c.codeScore} />
                    </td>
                    <td className="td">
                      <InterviewCell status={c.interviewStatus} score={c.interviewScore} />
                    </td>
                    <td className="td text-right whitespace-nowrap">
                      <span className="num text-[15px] font-medium text-ink-900">{c.totalScore || 0}</span>
                      <span className="num text-[11px] text-ink-400">/100</span>
                    </td>
                    <td className="td text-[12.5px] text-ink-600">{tier(c.totalScore || 0)}</td>
                    <td className="td">
                      {c.submission ? (
                        <span className={`pill-${
                          c.submission.verdict === 'Accepted' ? 'positive'
                          : c.submission.verdict === 'Partial' ? 'warn' : 'danger'
                        }`}>
                          {c.submission.verdict}
                        </span>
                      ) : (
                        <span className="text-[12px] text-ink-400">No submission</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="num text-[11.5px] text-ink-500 mt-3">
        final = (resume × 0.30) + (code × 0.40) + (interview × 0.30)
      </p>
    </div>
  )
}
