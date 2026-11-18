import { useState, useEffect } from 'react'
import {
  Wand2, ChevronDown, CheckCircle2, ChevronRight, RotateCcw,
  AlertCircle, Code2, Loader2,
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { PageHeader, Section, Field, Alert } from '../../components/ui'

const DIFFICULTY = ['easy', 'medium', 'hard']

export default function CreateCodingTest() {
  const [jobs, setJobs] = useState([])
  const [jobsLoading, setJobsLoading] = useState(true)

  const [form, setForm] = useState({
    jobId: '',
    role: '',
    difficulty: 'medium',
    numberOfQuestions: 3,
  })

  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(null)
  const [expandedQ, setExpandedQ] = useState(null)
  const [mockGenerated, setMockGenerated] = useState(false)

  useEffect(() => {
    api.get('/jobs?limit=50')
      .then(({ data }) => setJobs(data.jobs || []))
      .catch(() => toast.error('Could not load jobs'))
      .finally(() => setJobsLoading(false))
  }, [])

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!form.jobId) return toast.error('Select a job first')
    if (!form.role) return toast.error('Name the role the test is for')

    setGenerating(true)
    setGenerated(null)
    try {
      const { data } = await api.post('/coding-test/generate', {
        jobId: form.jobId,
        role: form.role,
        difficulty: form.difficulty,
        numberOfQuestions: Number(form.numberOfQuestions),
      })
      setGenerated(data.test)
      setMockGenerated(Boolean(data.mock))
      setExpandedQ(0)
      toast.success(`${data.test.questions.length} questions generated`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const selectedJob = jobs.find(j => j._id === form.jobId)

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader
        title="Coding tests"
        description="Generate a role-specific assessment with test cases. Candidates take it in a timed editor."
      />

      <Section title="Generate an assessment">
        <form onSubmit={handleGenerate} className="space-y-4">
          <Field label="Job" required>
            {jobsLoading ? (
              <div className="input flex items-center text-ink-400">Loading jobs</div>
            ) : (
              <div className="relative">
                <select
                  id="job-select"
                  className="input pr-8"
                  value={form.jobId}
                  onChange={e => {
                    const job = jobs.find(j => j._id === e.target.value)
                    setForm({ ...form, jobId: e.target.value, role: job?.title || form.role })
                  }}
                >
                  <option value="">Select a job posting</option>
                  {jobs.map(j => (
                    <option key={j._id} value={j._id}>{j.title} ({j.company})</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              </div>
            )}
            {!jobsLoading && jobs.length === 0 && (
              <p className="field-hint">No jobs yet. Create a job before generating a test.</p>
            )}
          </Field>

          <Field label="Role or position" hint="Used to tailor the questions." required>
            <input
              id="role-input"
              type="text"
              className="input"
              placeholder="SDE Intern, Full Stack Engineer, Data Scientist"
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Difficulty">
              <div className="flex gap-1 p-1 rounded-lg bg-ink-50 border border-line">
                {DIFFICULTY.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm({ ...form, difficulty: d })}
                    aria-pressed={form.difficulty === d}
                    className={`flex-1 h-7 rounded-md text-[12.5px] capitalize transition-colors ${
                      form.difficulty === d
                        ? 'bg-white text-ink-900 border border-line font-medium'
                        : 'text-ink-500 hover:text-ink-800'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Questions" hint="Between 1 and 10.">
              <input
                id="num-questions-input"
                type="number"
                min={1}
                max={10}
                className="input num"
                value={form.numberOfQuestions}
                onChange={e => setForm({ ...form, numberOfQuestions: e.target.value })}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[12px] text-ink-500">
              Generation uses the job description and required skills.
            </p>
            <button
              id="generate-test-btn"
              type="submit"
              disabled={generating || !form.jobId}
              className="btn-primary"
            >
              {generating ? <><Loader2 size={14} className="animate-spin" /> Generating</> : <><Wand2 size={14} strokeWidth={1.8} /> Generate assessment</>}
            </button>
          </div>
        </form>
      </Section>

      {generated && (
        <div className="mt-4 space-y-4 animate-rise-in">
          <Section
            title="Assessment ready"
            action={
              <div className="flex items-center gap-2">
                <button onClick={() => { setGenerated(null); setExpandedQ(null) }} className="btn-secondary btn-sm">
                  <RotateCcw size={12} /> Regenerate
                </button>
                {selectedJob && (
                  <a
                    href={`/coding-test/${form.jobId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary btn-sm"
                  >
                    <Code2 size={12} /> Open test
                  </a>
                )}
              </div>
            }
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={16} className="text-positive-600" strokeWidth={1.7} />
              <p className="text-[13px] text-ink-700">
                <span className="num">{generated.questionCount}</span> questions ·{' '}
                <span className="capitalize">{generated.difficulty}</span> · {generated.role}
              </p>
            </div>
            <p className="text-[12.5px] text-ink-500 mt-2">
              The test is live for this job. Candidates see the questions and sample input, not the
              expected outputs.
            </p>
            {mockGenerated && (
              <p className="mt-3 text-[12.5px] text-warn-700 bg-warn-50 border border-warn-100 rounded-lg px-3 py-2">
                These questions came from the development mock pool (AI mock mode), not from the AI model.
              </p>
            )}
          </Section>

          <div className="card overflow-hidden divide-y divide-line">
            {generated.questions.map((q, i) => (
              <div key={i}>
                <button
                  onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-ink-50/60 transition-colors"
                  aria-expanded={expandedQ === i}
                >
                  <span className="num text-[11.5px] text-ink-400 w-4 flex-shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1 text-[13px] text-ink-900 line-clamp-1">{q.question}</span>
                  <span className="num text-[11.5px] text-ink-500 flex-shrink-0">{q.timeLimit} min</span>
                  <ChevronRight
                    size={14}
                    className={`text-ink-400 flex-shrink-0 transition-transform ${expandedQ === i ? 'rotate-90' : ''}`}
                  />
                </button>

                {expandedQ === i && (
                  <div className="px-5 pb-4 pl-[52px]">
                    <p className="text-[11.5px] text-ink-500 mb-2">Test cases</p>
                    <div className="space-y-1.5">
                      {(q.testCases || []).map((tc, ti) => (
                        <div key={ti} className="grid sm:grid-cols-2 gap-1.5">
                          <div className="surface-inset px-3 py-2">
                            <p className="text-[10.5px] text-ink-500">Input</p>
                            <code className="num text-[12px] text-ink-800 break-all">{tc.input}</code>
                          </div>
                          <div className="surface-inset px-3 py-2">
                            <p className="text-[10.5px] text-ink-500">Expected output</p>
                            <code className="num text-[12px] text-ink-800 break-all">{tc.output}</code>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Alert tone="neutral">
            <span className="inline-flex items-start gap-2">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              Regenerating replaces the current test for this job.
            </span>
          </Alert>
        </div>
      )}
    </div>
  )
}
