import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileText, Zap, CheckCircle, XCircle, AlertCircle,
  ChevronDown, Brain, Target, TrendingUp, Award, RefreshCw,
  User, Mail, Briefcase, Users, Loader2
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const recommendationConfig = {
  hire:      { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', icon: CheckCircle, label: 'Strong Hire' },
  interview: { color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25',    icon: AlertCircle, label: 'Interview' },
  reject:    { color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/25',     icon: XCircle,     label: 'Not a Fit' },
}

const ScoreRing = ({ value, label, color = '#6366f1' }) => {
  const r = 28, c = 2 * Math.PI * r
  const offset = c - (value / 100) * c
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#1a1a27" strokeWidth="6" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color}
          strokeWidth="6" strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="absolute" style={{ marginTop: '18px' }}>
        <p className="text-lg font-bold text-white text-center leading-none">{value}</p>
      </div>
      <p className="text-xs text-slate-400 -mt-1">{label}</p>
    </div>
  )
}

export default function ResumePage() {
  const [jobs, setJobs]                 = useState([])
  const [selectedJob, setSelectedJob]   = useState('')
  const [file, setFile]                 = useState(null)
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [dragging, setDragging]         = useState(false)
  const [loading, setLoading]           = useState(false)
  const [result, setResult]             = useState(null)
  const [history, setHistory]           = useState([])
  const [applicants, setApplicants]     = useState([])
  const [screeningId, setScreeningId]   = useState(null) // appId being screened
  const fileRef = useRef()

  useEffect(() => {
    api.get('/jobs?status=active').then(r => setJobs(r.data.jobs)).catch(() => {})
    api.get('/resume/history').then(r => setHistory(r.data.candidates)).catch(() => {})
  }, [])

  // Fetch applicants with resumes when job changes
  useEffect(() => {
    if (!selectedJob) { setApplicants([]); return }
    api.get(`/applications/job/${selectedJob}?limit=50`)
      .then(r => setApplicants(r.data.applications || []))
      .catch(() => setApplicants([]))
  }, [selectedJob])

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const handleScreen = async (e) => {
    e.preventDefault()
    if (!file)        return toast.error('Please upload a resume file')
    if (!selectedJob) return toast.error('Please select a job')

    setLoading(true); setResult(null)
    try {
      const fd = new FormData()
      fd.append('resume', file)
      fd.append('jobId', selectedJob)
      fd.append('candidateName', candidateName)
      fd.append('candidateEmail', candidateEmail)

      const { data } = await api.post('/resume/screen', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResult(data)
      toast.success(`Screened! Score: ${data.aiResult.score}/100`)
      // Refresh history
      const hist = await api.get('/resume/history')
      setHistory(hist.data.candidates)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Screening failed')
    } finally {
      setLoading(false)
    }
  }

  // Auto-screen from application (no re-upload)
  const handleAutoScreen = async (applicationId) => {
    setScreeningId(applicationId)
    setResult(null)
    try {
      const { data } = await api.post('/resume/screen-application', { applicationId })
      setResult(data)
      toast.success(`Screened! Score: ${data.aiResult.score}/100`)
      const hist = await api.get('/resume/history')
      setHistory(hist.data.candidates)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Screening failed')
    } finally {
      setScreeningId(null)
    }
  }

  const rec = result && recommendationConfig[result.aiResult?.recommendation]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid lg:grid-cols-2 gap-6 items-start">

        {/* === Upload Form === */}
        <div className="card space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary-500/15 border border-primary-500/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white">AI Resume Screener</h2>
              <p className="text-slate-400 text-xs">Upload manually or auto-screen from applicants</p>
            </div>
          </div>

          <form onSubmit={handleScreen} className="space-y-4">
            {/* Job select */}
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Select Job *</label>
              <div className="relative">
                <select className="input pr-8 appearance-none cursor-pointer"
                  value={selectedJob} onChange={e => setSelectedJob(e.target.value)} required>
                  <option value="">Choose a job posting…</option>
                  {jobs.map(j => (
                    <option key={j._id} value={j._id}>{j.title} — {j.company}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
              </div>
            </div>

            {/* Candidate info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Candidate Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <input className="input pl-9" placeholder="Full name"
                    value={candidateName} onChange={e => setCandidateName(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Candidate Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <input className="input pl-9" type="email" placeholder="email@example.com"
                    value={candidateEmail} onChange={e => setCandidateEmail(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Drop zone */}
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Resume File * <span className="text-slate-500">(PDF, DOC, TXT · max 5MB)</span></label>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
                  ${dragging ? 'border-primary-500 bg-primary-500/8' : 'border-white/15 hover:border-primary-500/40 hover:bg-white/[0.02]'}
                  ${file ? 'border-accent-500/40 bg-accent-500/5' : ''}`}
              >
                <input ref={fileRef} type="file" className="hidden"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={e => setFile(e.target.files[0])} />
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="w-8 h-8 text-accent-400" />
                    <div className="text-left">
                      <p className="text-white font-medium text-sm">{file.name}</p>
                      <p className="text-slate-400 text-xs">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button type="button" onClick={e => { e.stopPropagation(); setFile(null) }}
                      className="ml-2 text-slate-500 hover:text-red-400 transition-colors text-xs">✕</button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-300 text-sm font-medium">Drop resume here or <span className="text-primary-400">click to browse</span></p>
                    <p className="text-slate-500 text-xs mt-1">PDF, DOC, DOCX or TXT</p>
                  </>
                )}
              </div>
            </div>

            <button id="screen-resume-btn" type="submit" disabled={loading || !file || !selectedJob}
              className="btn-primary w-full justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? (
                <><RefreshCw size={16} className="animate-spin" /> Analyzing with AI…</>
              ) : (
                <><Zap size={16} /> Screen with AI</>
              )}
            </button>
          </form>
        </div>

        {/* === Applicants with Resumes (Auto-Screen) === */}
        {selectedJob && applicants.length > 0 && (
          <div className="card space-y-3 lg:col-span-2 xl:col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <Users size={16} className="text-primary-400" />
              <h3 className="font-semibold text-white text-sm">Applicants with Resumes</h3>
              <span className="text-slate-500 text-xs ml-auto">{applicants.filter(a => a.resumeUrl).length} with resume</span>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {applicants.map(app => {
                const hasResume = !!app.resumeUrl
                const name = app.candidate?.name || 'Unknown'
                return (
                  <div key={app._id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
                    ${hasResume ? 'border-white/[0.07] hover:border-primary-500/30 bg-surface-700/50' : 'border-white/[0.04] bg-surface-800/50 opacity-50'}`}>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-600/30 to-accent-500/30 flex items-center justify-center text-primary-300 text-xs font-bold flex-shrink-0">
                      {name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{name}</p>
                      <p className="text-slate-500 text-xs">{app.candidate?.email}</p>
                    </div>
                    {hasResume ? (
                      <button
                        onClick={() => handleAutoScreen(app._id)}
                        disabled={screeningId === app._id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                          bg-primary-500/15 text-primary-400 border border-primary-500/20
                          hover:bg-primary-500/25 disabled:opacity-50 transition-all flex-shrink-0"
                      >
                        {screeningId === app._id ? (
                          <><Loader2 size={12} className="animate-spin" /> Screening…</>
                        ) : (
                          <><Zap size={12} /> Screen</>
                        )}
                      </button>
                    ) : (
                      <span className="text-slate-600 text-xs">No resume</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* === Results Panel === */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="card flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-primary-500/20 border-t-primary-500 animate-spin" />
                <Brain className="w-6 h-6 text-primary-400 absolute inset-0 m-auto" />
              </div>
              <p className="text-slate-300 font-medium">AI is analyzing the resume…</p>
              <p className="text-slate-500 text-sm text-center">Extracting skills · Scoring fit · Generating insights</p>
            </motion.div>
          ) : result ? (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-4">
              {/* Score card */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Screening Result</h3>
                  {rec && (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${rec.bg} border ${rec.border}`}>
                      <rec.icon size={14} className={rec.color} />
                      <span className={`text-sm font-semibold ${rec.color}`}>{rec.label}</span>
                    </div>
                  )}
                </div>

                {/* Score rings */}
                <div className="flex justify-around mb-4 relative">
                  <ScoreRing value={result.aiResult?.score || 0} label="Overall" color="#6366f1" />
                  <ScoreRing value={result.aiResult?.correctness || result.aiResult?.score || 0} label="Fit Score" color="#10b981" />
                  <ScoreRing value={Math.min(100, (result.aiResult?.experience || 0) * 10)} label="Experience" color="#f59e0b" />
                </div>

                <p className="text-slate-300 text-sm leading-relaxed border-t border-white/[0.06] pt-4">
                  {result.aiResult?.summary}
                </p>
                <p className="text-slate-500 text-xs mt-2 italic">{result.aiResult?.reasoning}</p>
              </div>

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-2 gap-3">
                <div className="card">
                  <h4 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <CheckCircle size={14} /> Strengths
                  </h4>
                  <ul className="space-y-1.5">
                    {result.aiResult?.strengths?.map((s, i) => (
                      <li key={i} className="text-slate-300 text-xs flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card">
                  <h4 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                    <AlertCircle size={14} /> Gaps
                  </h4>
                  <ul className="space-y-1.5">
                    {result.aiResult?.weaknesses?.map((w, i) => (
                      <li key={i} className="text-slate-300 text-xs flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5">•</span> {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Skills */}
              {result.aiResult?.skills?.length > 0 && (
                <div className="card">
                  <h4 className="text-sm font-semibold text-white mb-3">Extracted Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.aiResult.skills.map(s => (
                      <span key={s} className="badge-primary badge text-xs">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="card flex flex-col items-center justify-center py-20 text-center">
              <Target className="w-12 h-12 text-slate-600 mb-4" />
              <p className="text-slate-400 font-medium mb-1">No results yet</p>
              <p className="text-slate-500 text-sm">Upload a resume and select a job to get AI screening results</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* === Screening History === */}
      {history.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Award size={16} className="text-primary-400" /> Screening History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  {['Candidate', 'Job', 'Score', 'Status', 'Screened'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {history.map(c => (
                  <tr key={c._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 pr-4">
                      <p className="text-white font-medium">{c.name}</p>
                      <p className="text-slate-500 text-xs">{c.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{c.job?.title || '–'}</td>
                    <td className="py-3 pr-4">
                      <span className="font-bold text-white">{c.resumeScore}</span>
                      <span className="text-slate-500">/100</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="badge-primary badge capitalize">{c.status}</span>
                    </td>
                    <td className="py-3 text-slate-400 text-xs">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
