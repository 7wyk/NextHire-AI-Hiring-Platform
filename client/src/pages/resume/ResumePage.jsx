import { useState, useEffect, useRef } from 'react'
import {
  Upload, FileText, X, ChevronDown, RefreshCw, ScanText, Users, Zap,
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  PageHeader, Section, Field, EmptyState, Alert, Spinner, ScoreBar, StatusPill,
} from '../../components/ui'

const recConfig = {
  hire:      { tone: 'positive', label: 'Strong hire' },
  interview: { tone: 'accent',   label: 'Interview' },
  reject:    { tone: 'danger',   label: 'Not a fit' },
}

export default function ResumePage() {
  const [jobs, setJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState('')
  const [file, setFile] = useState(null)
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [applicants, setApplicants] = useState([])
  const [screeningId, setScreeningId] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    api.get('/jobs?status=active').then(r => setJobs(r.data.jobs || [])).catch(() => {})
    api.get('/resume/history').then(r => setHistory(r.data.candidates || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedJob) { setApplicants([]); return }
    api.get(`/applications/job/${selectedJob}?limit=50`)
      .then(r => setApplicants(r.data.applications || []))
      .catch(() => setApplicants([]))
  }, [selectedJob])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const refreshHistory = () => {
    api.get('/resume/history')
      .then(r => setHistory(r.data.candidates || []))
      .catch(() => {})
  }

  const handleScreen = async (e) => {
    e.preventDefault()
    if (!file) return toast.error('Choose a resume file first')
    if (!selectedJob) return toast.error('Select the job to screen against')

    setLoading(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('resume', file)
      fd.append('jobId', selectedJob)
      fd.append('candidateName', candidateName)
      fd.append('candidateEmail', candidateEmail)

      const { data } = await api.post('/resume/screen', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
      toast.success(`Screened · ${data.aiResult.score}/100`)
      refreshHistory()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Screening failed')
    } finally {
      setLoading(false)
    }
  }

  const handleAutoScreen = async (applicationId) => {
    setScreeningId(applicationId)
    setResult(null)
    try {
      const { data } = await api.post('/resume/screen-application', { applicationId })
      setResult(data)
      toast.success(`Screened · ${data.aiResult.score}/100`)
      refreshHistory()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Screening failed')
    } finally {
      setScreeningId(null)
    }
  }

  const ai = result?.aiResult
  const rec = ai && recConfig[ai.recommendation]

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Resume screening"
        description="Score a resume against a job description, or screen an applicant who already applied."
      />

      <div className="grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-4 items-start">
        {/* Form */}
        <Section title="Screen a resume">
          <form onSubmit={handleScreen} className="space-y-4">
            <Field label="Job" required>
              <div className="relative">
                <select
                  className="input pr-8"
                  value={selectedJob}
                  onChange={e => setSelectedJob(e.target.value)}
                  required
                >
                  <option value="">Select a job posting</option>
                  {jobs.map(j => (
                    <option key={j._id} value={j._id}>{j.title} — {j.company}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              </div>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Candidate name">
                <input
                  className="input"
                  placeholder="Full name"
                  value={candidateName}
                  onChange={e => setCandidateName(e.target.value)}
                />
              </Field>
              <Field label="Candidate email">
                <input
                  className="input"
                  type="email"
                  placeholder="name@example.com"
                  value={candidateEmail}
                  onChange={e => setCandidateEmail(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Resume file" hint="PDF, DOC or TXT, up to 5 MB." required>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
                className={`rounded-lg border border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
                  dragging
                    ? 'border-accent-500 bg-accent-50'
                    : file
                      ? 'border-ink-300 bg-ink-50'
                      : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50/60'
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={e => setFile(e.target.files[0])}
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2.5">
                    <FileText size={16} className="text-ink-500" strokeWidth={1.7} />
                    <div className="text-left min-w-0">
                      <p className="text-[13px] text-ink-900 truncate">{file.name}</p>
                      <p className="num text-[11px] text-ink-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setFile(null) }}
                      className="ml-1 p-1 text-ink-400 hover:text-ink-800"
                      aria-label="Remove file"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={17} className="text-ink-400 mx-auto mb-2" strokeWidth={1.6} />
                    <p className="text-[13px] text-ink-700">Drop a resume here, or choose a file</p>
                    <p className="text-[11.5px] text-ink-400 mt-0.5">PDF, DOC, DOCX or TXT</p>
                  </>
                )}
              </div>
            </Field>

            <button
              id="screen-resume-btn"
              type="submit"
              disabled={loading || !file || !selectedJob}
              className="btn-primary w-full"
            >
              {loading ? <><RefreshCw size={14} className="animate-spin" /> Analysing</> : <><Zap size={14} strokeWidth={1.8} /> Screen with AI</>}
            </button>
          </form>
        </Section>

        {/* Result */}
        <div className="space-y-4">
          {loading ? (
            <Section>
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Spinner className="text-ink-400" />
                <p className="text-[13px] text-ink-600">Reading the resume and scoring it against the job</p>
              </div>
            </Section>
          ) : result && ai ? (
            <>
              <Section
                title="Screening result"
                action={
                  <div className="flex items-center gap-2">
                    {ai.mock && <span className="pill-neutral">Mock evaluation</span>}
                    {rec && <span className={`pill-${rec.tone}`}>{rec.label}</span>}
                  </div>
                }
              >
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[12px] text-ink-500">Overall fit</p>
                    <p className="num text-[30px] leading-9 font-medium text-ink-900">
                      {ai.score ?? 0}<span className="text-[15px] text-ink-400">/100</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] text-ink-500">Experience</p>
                    <p className="num text-[15px] text-ink-800">
                      {ai.experience != null ? `${ai.experience} yr${Number(ai.experience) === 1 ? '' : 's'}` : 'Not stated'}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <ScoreBar value={ai.score || 0} />
                </div>

                {ai.summary && (
                  <p className="text-[13px] text-ink-700 leading-6 mt-4 pt-4 border-t border-line">
                    {ai.summary}
                  </p>
                )}
                {ai.reasoning && (
                  <p className="text-[12.5px] text-ink-500 leading-6 mt-2">
                    {ai.reasoning}
                  </p>
                )}
              </Section>

              <div className="grid sm:grid-cols-2 gap-4">
                <Section title="Strengths">
                  {ai.strengths?.length ? (
                    <ul className="space-y-2">
                      {ai.strengths.map((s, i) => (
                        <li key={i} className="text-[12.5px] text-ink-700 leading-5 flex gap-2">
                          <span className="text-ink-300">—</span>{s}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12.5px] text-ink-400">None reported</p>
                  )}
                </Section>
                <Section title="Gaps">
                  {ai.weaknesses?.length ? (
                    <ul className="space-y-2">
                      {ai.weaknesses.map((w, i) => (
                        <li key={i} className="text-[12.5px] text-ink-700 leading-5 flex gap-2">
                          <span className="text-ink-300">—</span>{w}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12.5px] text-ink-400">None reported</p>
                  )}
                </Section>
              </div>

              {ai.skills?.length > 0 && (
                <Section title={`Skills found (${ai.skills.length})`}>
                  <p className="text-[12.5px] text-ink-700 leading-6">
                    {ai.skills.join(' · ')}
                  </p>
                </Section>
              )}
            </>
          ) : (
            <div className="card">
              <EmptyState
                icon={ScanText}
                title="No screening yet"
                description="Pick a job, attach a resume and run screening. The score, summary, strengths and gaps appear here."
              />
            </div>
          )}

          {selectedJob && applicants.length > 0 && (
            <Section
              title="Applicants with resumes"
              description={`${applicants.filter(a => a.resumeUrl).length} of ${applicants.length} have a resume`}
              padded={false}
            >
              <ul className="divide-y divide-line max-h-[320px] overflow-y-auto">
                {applicants.map(app => {
                  const hasResume = Boolean(app.resumeUrl)
                  const name = app.candidate?.name || 'Unknown'
                  return (
                    <li key={app._id} className="flex items-center gap-2.5 px-5 py-2.5">
                      <span className="w-6 h-6 rounded-md bg-ink-100 text-ink-600 text-[11px] font-medium flex items-center justify-center flex-shrink-0">
                        {name[0]?.toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] text-ink-900 truncate">{name}</p>
                        <p className="text-[11.5px] text-ink-500 truncate">{app.candidate?.email}</p>
                      </div>
                      {hasResume ? (
                        <button
                          onClick={() => handleAutoScreen(app._id)}
                          disabled={screeningId === app._id}
                          className="btn-secondary btn-sm flex-shrink-0"
                        >
                          {screeningId === app._id
                            ? <><Spinner /> Screening</>
                            : <><Users size={12} /> Screen</>}
                        </button>
                      ) : (
                        <span className="text-[11.5px] text-ink-400 flex-shrink-0">No resume</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="mt-4">
          <Section title="Screening history" padded={false}>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="th">Candidate</th>
                    <th className="th">Job</th>
                    <th className="th">Score</th>
                    <th className="th">Stage</th>
                    <th className="th">Screened</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(c => (
                    <tr key={c._id} className="hover:bg-ink-50/60">
                      <td className="td">
                        <p className="text-ink-900">{c.name}</p>
                        <p className="text-[12px] text-ink-500">{c.email}</p>
                      </td>
                      <td className="td text-ink-600">{c.job?.title || '—'}</td>
                      <td className="td num">
                        <span className="text-ink-900">{c.resumeScore}</span>
                        <span className="text-ink-400">/100</span>
                      </td>
                      <td className="td"><StatusPill status={c.status} /></td>
                      <td className="td num text-[12px] text-ink-500">
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}
