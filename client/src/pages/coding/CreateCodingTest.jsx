import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wand2, Briefcase, ChevronDown, Loader2, CheckCircle2,
  Code2, AlertCircle, ChevronRight, RotateCcw, Trophy
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const difficultyColors = {
  easy:   'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  hard:   'bg-red-500/15 text-red-300 border-red-500/30',
}

export default function CreateCodingTest() {
  const [jobs, setJobs]               = useState([])
  const [jobsLoading, setJobsLoading] = useState(true)

  const [form, setForm] = useState({
    jobId:           '',
    role:            '',
    difficulty:      'medium',
    numberOfQuestions: 3,
  })

  const [generating, setGenerating]   = useState(false)
  const [generated, setGenerated]     = useState(null)   // test result from API
  const [expandedQ,  setExpandedQ]    = useState(null)   // which question is expanded

  // Load recruiter's own jobs
  useEffect(() => {
    api.get('/jobs?limit=50')
      .then(({ data }) => setJobs(data.jobs || []))
      .catch(() => toast.error('Failed to load jobs'))
      .finally(() => setJobsLoading(false))
  }, [])

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!form.jobId) { toast.error('Please select a job'); return }
    if (!form.role)  { toast.error('Please enter a role/position name'); return }

    setGenerating(true)
    setGenerated(null)
    try {
      const { data } = await api.post('/coding-test/generate', {
        jobId:           form.jobId,
        role:            form.role,
        difficulty:      form.difficulty,
        numberOfQuestions: Number(form.numberOfQuestions),
      })
      setGenerated(data.test)
      setExpandedQ(0)
      toast.success(`${data.test.questions.length} questions generated!`, { icon: '🎉' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleReset = () => {
    setGenerated(null)
    setExpandedQ(null)
  }

  const selectedJob = jobs.find(j => j._id === form.jobId)

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-900/30">
          <Code2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Create Coding Assessment</h1>
          <p className="text-slate-400 text-sm">AI generates DSA questions with test cases for your job</p>
        </div>
      </div>

      {/* ── Generator form ──────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card">
        <form onSubmit={handleGenerate} className="space-y-4">
          {/* Job selector */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              <Briefcase size={14} className="inline mr-1.5 text-slate-400" />
              Select Job *
            </label>
            {jobsLoading ? (
              <div className="input animate-pulse bg-surface-700 text-transparent">Loading…</div>
            ) : (
              <div className="relative">
                <select
                  id="job-select"
                  className="input appearance-none pr-9 cursor-pointer"
                  value={form.jobId}
                  onChange={e => {
                    const job = jobs.find(j => j._id === e.target.value)
                    setForm({ ...form, jobId: e.target.value, role: job?.title || form.role })
                  }}
                >
                  <option value="">— Choose a job —</option>
                  {jobs.map(j => (
                    <option key={j._id} value={j._id}>{j.title} ({j.company})</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
              </div>
            )}
            {jobs.length === 0 && !jobsLoading && (
              <p className="text-amber-400 text-xs mt-1.5">No jobs found. Create a job first.</p>
            )}
          </div>

          {/* Role / position name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Role / Position Name *
            </label>
            <input
              id="role-input"
              type="text"
              className="input"
              placeholder="e.g. SDE Intern, Full Stack Engineer, Data Scientist"
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
            />
            <p className="text-slate-500 text-xs mt-1">AI uses this to tailor the questions</p>
          </div>

          {/* Difficulty + question count */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Difficulty</label>
              <div className="flex gap-2">
                {['easy', 'medium', 'hard'].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm({ ...form, difficulty: d })}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border capitalize transition-all
                      ${form.difficulty === d
                        ? difficultyColors[d]
                        : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300'
                      }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Questions
                <span className="text-slate-500 font-normal ml-1">(1–10)</span>
              </label>
              <input
                id="num-questions-input"
                type="number"
                min={1}
                max={10}
                className="input"
                value={form.numberOfQuestions}
                onChange={e => setForm({ ...form, numberOfQuestions: e.target.value })}
              />
            </div>
          </div>

          {/* Generate button */}
          <button
            id="generate-test-btn"
            type="submit"
            disabled={generating || !form.jobId}
            className="btn-primary w-full justify-center py-3 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Generating with AI…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Wand2 size={16} />
                Generate Assessment
              </span>
            )}
          </button>
        </form>
      </motion.div>

      {/* ── Generated questions ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {generated && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Summary card */}
            <div className="card bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  <div>
                    <p className="text-white font-semibold">Assessment Ready!</p>
                    <p className="text-slate-400 text-sm">
                      {generated.questionCount} questions · {generated.difficulty} difficulty · {generated.role}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleReset} className="btn-ghost text-xs gap-1.5">
                    <RotateCcw size={13} /> Regenerate
                  </button>
                  {selectedJob && (
                    <a
                      href={`/coding-test/${form.jobId}`}
                      target="_blank" rel="noreferrer"
                      className="btn-secondary text-xs gap-1.5"
                    >
                      <Trophy size={13} /> Preview
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Question accordion */}
            <div className="space-y-3">
              {generated.questions.map((q, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="card overflow-hidden"
                >
                  {/* Question header */}
                  <button
                    className="w-full flex items-center justify-between gap-3 text-left"
                    onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-primary-500/15 border border-primary-500/20 flex items-center justify-center flex-shrink-0 text-primary-300 font-bold text-xs">
                        {i + 1}
                      </div>
                      <p className="text-white font-medium text-sm truncate">{q.question}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-slate-500 text-xs">{q.timeLimit} min</span>
                      <ChevronRight
                        size={15}
                        className={`text-slate-500 transition-transform ${expandedQ === i ? 'rotate-90' : ''}`}
                      />
                    </div>
                  </button>

                  {/* Test cases */}
                  <AnimatePresence>
                    {expandedQ === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2">
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">
                            Test Cases
                          </p>
                          {(q.testCases || []).map((tc, ti) => (
                            <div key={ti} className="grid grid-cols-2 gap-2">
                              <div className="bg-surface-700 rounded-lg p-2 border border-white/[0.06]">
                                <p className="text-[10px] text-slate-500 mb-1">Input</p>
                                <code className="text-emerald-300 text-xs font-mono break-all">{tc.input}</code>
                              </div>
                              <div className="bg-surface-700 rounded-lg p-2 border border-white/[0.06]">
                                <p className="text-[10px] text-slate-500 mb-1">Expected Output</p>
                                <code className="text-amber-300 text-xs font-mono break-all">{tc.output}</code>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            {/* Info */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-primary-500/5 border border-primary-500/15">
              <AlertCircle size={14} className="text-primary-400 mt-0.5 flex-shrink-0" />
              <p className="text-slate-400 text-xs">
                This test is now live for candidates who apply to <strong className="text-slate-300">{selectedJob?.title}</strong>.
                Candidates will see questions but <strong className="text-slate-300">not</strong> the expected outputs.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
