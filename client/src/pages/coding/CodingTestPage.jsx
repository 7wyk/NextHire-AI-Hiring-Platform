import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import {
  Clock, ChevronLeft, ChevronRight, Send, CheckCircle2,
  AlertCircle, Code2, Loader2, Play, XCircle,
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { LoadingBlock } from '../../components/ui'

/* ── Timer ──────────────────────────────────────────────────────────────── */

function CountdownTimer({ totalSecs, onExpire }) {
  const [remaining, setRemaining] = useState(totalSecs)

  useEffect(() => { setRemaining(totalSecs) }, [totalSecs])

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return }
    const id = setInterval(() => setRemaining(s => s - 1), 1000)
    return () => clearInterval(id)
  }, [remaining, onExpire])

  const m = String(Math.floor(remaining / 60)).padStart(2, '0')
  const s = String(remaining % 60).padStart(2, '0')
  const urgent = remaining < 120

  return (
    <div
      className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md border num text-[12.5px] ${
        urgent
          ? 'border-danger-100 bg-danger-50 text-danger-700'
          : 'border-line bg-white text-ink-700'
      }`}
    >
      <Clock size={12} strokeWidth={1.8} />
      {m}:{s}
      <span className="text-ink-400 font-sans">left</span>
    </div>
  )
}

const DIFFICULTY = {
  easy: 'positive',
  medium: 'warn',
  hard: 'danger',
}

export default function CodingTestPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()

  const [test, setTest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [totalRemainingSecs, setTotalRemainingSecs] = useState(0)
  const [timeExpired, setTimeExpired] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResults, setRunResults] = useState({})
  // Which runtimes this server can actually execute. Languages the server
  // cannot run are disabled instead of silently scoring zero.
  const [runtimes, setRuntimes] = useState({ javascript: 'sandbox', judge0: false })
  // The timer is server-side and only starts when the candidate presses Start.
  const [started, setStarted] = useState(false)
  const [starting, setStarting] = useState(false)

  const editorRef = useRef(null)

  const getStarterCode = (lang) => {
    const starters = {
      javascript: '// Write your solution here\nfunction solution(input) {\n  \n}\n',
      python:     '# Write your solution here\ndef solution(input):\n    pass\n',
      java:       'public class Solution {\n    public static void main(String[] args) {\n        \n    }\n}',
      cpp:        '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}',
    }
    return starters[lang] || starters.javascript
  }

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/coding-test/${jobId}`)
        const t = data.test
        setTest(t)
        if (t.runtimes) setRuntimes(t.runtimes)

        const totalTimeLimitSecs = t.questions.reduce(
          (sum, q) => sum + (q.timeLimit || 15) * 60, 0
        )
        // A started attempt resumes from the server's clock; an unstarted one
        // shows the full budget and waits for an explicit start.
        const elapsed = t.startTime
          ? Math.floor((Date.now() - new Date(t.startTime).getTime()) / 1000)
          : 0
        const remaining = Math.max(0, totalTimeLimitSecs - elapsed)
        setTotalRemainingSecs(remaining)
        setStarted(Boolean(t.started))
        if (t.started && remaining <= 0) setTimeExpired(true)

        setAnswers(t.questions.map((_, i) => ({
          questionIndex: i,
          code: getStarterCode('javascript'),
          language: 'javascript',
        })))
      } catch (err) {
        const errData = err.response?.data
        if (errData?.alreadySubmitted) {
          setResult({
            verdict: errData.submission?.verdict || 'Submitted',
            overallScore: errData.submission?.passRate || 0,
            testResults: [],
            alreadySubmitted: true,
          })
          return
        }
        toast.error(errData?.message || 'Could not load the test')
        navigate('/my-applications')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [jobId, navigate])

  const handleLanguageChange = (lang) => {
    setAnswers(prev => prev.map((a, i) =>
      i === currentIdx ? { ...a, language: lang, code: getStarterCode(lang) } : a
    ))
    setRunResults(prev => { const n = { ...prev }; delete n[currentIdx]; return n })
  }

  const handleEditorChange = useCallback((value) => {
    setAnswers(prev => prev.map((a, i) =>
      i === currentIdx ? { ...a, code: value || '' } : a
    ))
  }, [currentIdx])

  const handleTimerExpire = useCallback(() => {
    setTimeExpired(true)
    toast.error('Time is up. Submitting your answers.')
    setSubmitting(true)
    api.post('/coding-test/submit', { jobId, answers })
      .then(({ data }) => setResult(data))
      .catch(() => toast.error('Automatic submission failed. Refresh and submit manually.'))
      .finally(() => setSubmitting(false))
  }, [jobId, answers])

  const handleStartAssessment = async () => {
    setStarting(true)
    try {
      // Idempotent: a reload resumes the original start time rather than
      // resetting the clock.
      const { data } = await api.post(`/coding-test/${jobId}/start`)
      const totalTimeLimitSecs = (test?.questions || []).reduce(
        (sum, q) => sum + (q.timeLimit || 15) * 60, 0
      )
      const elapsed = data.startTime
        ? Math.floor((Date.now() - new Date(data.startTime).getTime()) / 1000)
        : 0
      setTotalRemainingSecs(Math.max(0, totalTimeLimitSecs - elapsed))
      setStarted(true)
      if (data.resumed) toast.success('Resumed — your original timer is still running')
    } catch (err) {
      const errData = err.response?.data
      if (errData?.alreadySubmitted) {
        setResult({
          verdict: errData.submission?.verdict || 'Submitted',
          overallScore: errData.submission?.passRate || 0,
          testResults: [],
          alreadySubmitted: true,
        })
        return
      }
      toast.error(errData?.message || 'Could not start the assessment')
    } finally {
      setStarting(false)
    }
  }

  const handleRunCode = async () => {
    if (timeExpired) return
    const currentAnswer = answers[currentIdx]
    if (!currentAnswer?.code?.trim()) {
      toast.error('Write some code before running')
      return
    }

    setRunning(true)
    try {
      const { data } = await api.post('/coding-test/run', {
        jobId,
        questionIndex: currentIdx,
        code: currentAnswer.code,
        language: currentAnswer.language,
      })
      setRunResults(prev => ({ ...prev, [currentIdx]: data }))
      if (data.allPassed) toast.success(`All ${data.total} test cases passed`)
      else toast(`${data.passed}/${data.total} test cases passed`)
    } catch (err) {
      const errData = err.response?.data
      if (errData?.timeExpired) {
        setTimeExpired(true)
        toast.error('Time expired')
      } else if (errData?.executionUnavailable) {
        toast.error(errData.message || 'Code execution is unavailable right now.')
      } else {
        toast.error(errData?.message || 'Execution failed')
      }
    } finally {
      setRunning(false)
    }
  }

  const handleSubmit = async () => {
    if (timeExpired) return
    if (!window.confirm('Submit all answers? This cannot be undone.')) return
    setSubmitting(true)
    try {
      const { data } = await api.post('/coding-test/submit', { jobId, answers })
      setResult(data)
      toast.success('Test submitted')
    } catch (err) {
      const errData = err.response?.data
      if (errData?.timeExpired) {
        setTimeExpired(true)
        toast.error('Time expired. Submission rejected.')
      } else if (errData?.executionUnavailable) {
        // Nothing was submitted or scored; the attempt is preserved.
        toast.error(errData.message || 'Code execution is unavailable right now. Nothing was submitted.')
      } else {
        toast.error(errData?.message || 'Submission failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="card"><LoadingBlock label="Loading assessment" /></div>
  }

  /* ── Start gate ─────────────────────────────────────────────────────── */
  if (!started && !result && test) {
    const totalMinutes = test.questions.reduce((sum, q) => sum + (q.timeLimit || 15), 0)

    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="card p-6">
          <h1 className="text-[17px] font-semibold text-ink-900">{test.role} assessment</h1>
          <p className="text-[13px] text-ink-500 mt-1">
            {test.questions.length} question{test.questions.length === 1 ? '' : 's'} ·{' '}
            <span className="num">{totalMinutes} minutes</span> · {test.difficulty}
          </p>

          <div className="mt-4 rounded-lg border border-line bg-surface-50 px-4 py-3 text-[12.5px] text-ink-600 leading-relaxed">
            The timer starts when you press <strong>Start assessment</strong> and keeps running
            if you reload the page or close the tab. You can run your code against the sample
            tests as often as you like.
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handleStartAssessment}
              disabled={starting}
              className="btn-primary"
            >
              {starting ? 'Starting…' : 'Start assessment'}
              <Play size={13} />
            </button>
            <button onClick={() => navigate('/my-applications')} className="btn-secondary">
              Not now
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Result ─────────────────────────────────────────────────────────── */
  if (result) {
    const passed = result.verdict === 'Accepted'
    const partial = result.verdict === 'Partial'
    const ai = result.aiFeedback

    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="card p-6">
          <div className="flex items-start gap-4">
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              passed ? 'bg-positive-50 text-positive-600'
              : partial ? 'bg-warn-50 text-warn-600'
              : 'bg-danger-50 text-danger-600'
            }`}>
              {passed
                ? <CheckCircle2 size={17} strokeWidth={1.7} />
                : <AlertCircle size={17} strokeWidth={1.7} />}
            </span>
            <div className="flex-1">
              <p className="text-[11.5px] text-ink-500">Assessment submitted</p>
              <h1 className="text-[19px] font-semibold text-ink-900 mt-0.5">{result.verdict}</h1>
              <p className="text-[13px] text-ink-500 mt-1">
                Overall score <span className="num text-ink-900">{result.overallScore}%</span>
              </p>
              {result.alreadySubmitted && (
                <p className="text-[12px] text-warn-600 mt-2">
                  You had already submitted this assessment. This is the recorded result.
                </p>
              )}
            </div>
          </div>
        </div>

        {(result.testResults || []).length > 0 && (
          <div className="card mt-4 overflow-hidden">
            <p className="px-5 py-3 border-b border-line text-[12.5px] font-medium text-ink-900">
              Per-question score
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Question</th>
                  <th className="th">Score</th>
                  <th className="th">Cases passed</th>
                </tr>
              </thead>
              <tbody>
                {result.testResults.map((r, i) => (
                  <tr key={i}>
                    <td className="td num text-ink-600">Q{i + 1}</td>
                    <td className="td num text-ink-900">{r.score}%</td>
                    <td className="td num text-ink-600">{r.passed}/{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ai && (
          <div className="card mt-4 p-5">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-medium text-ink-900">AI code review</p>
              <span className="pill-neutral capitalize">{ai.codeQuality}</span>
            </div>

            <dl className="grid grid-cols-2 gap-2 mt-3">
              <div className="surface-inset px-3 py-2">
                <dt className="text-[10.5px] text-ink-500">Time complexity</dt>
                <dd className="num text-[12.5px] text-ink-800 mt-0.5">{ai.timeComplexity || 'N/A'}</dd>
              </div>
              <div className="surface-inset px-3 py-2">
                <dt className="text-[10.5px] text-ink-500">Space complexity</dt>
                <dd className="num text-[12.5px] text-ink-800 mt-0.5">{ai.spaceComplexity || 'N/A'}</dd>
              </div>
            </dl>

            {ai.feedback && (
              <p className="text-[12.5px] text-ink-700 leading-6 mt-3">{ai.feedback}</p>
            )}

            {ai.improvements?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-line">
                <p className="text-[11.5px] text-ink-500 mb-1.5">Suggestions</p>
                <ul className="space-y-1.5">
                  {ai.improvements.map((tip, i) => (
                    <li key={i} className="text-[12.5px] text-ink-700 leading-5 flex gap-2">
                      <span className="text-ink-300">—</span>{tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <button onClick={() => navigate('/my-applications')} className="btn-primary mt-4">
          Back to applications
        </button>
      </div>
    )
  }

  const q = test.questions[currentIdx]
  const currentAnswer = answers[currentIdx] || { code: '', language: 'javascript' }
  const isLast = currentIdx === test.questions.length - 1
  const currentRunResult = runResults[currentIdx]

  return (
    <div className="flex flex-col gap-3 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[16px] font-semibold text-ink-900 truncate">
            {test.role} assessment
          </h1>
          <p className="num text-[12px] text-ink-500">
            Question {currentIdx + 1} of {test.questions.length}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`pill-${DIFFICULTY[test.difficulty] || 'warn'} capitalize`}>
            {test.difficulty}
          </span>
          <CountdownTimer totalSecs={totalRemainingSecs} onExpire={handleTimerExpire} />
        </div>
      </div>

      {timeExpired && !result && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-danger-50 border border-danger-100 text-[13px] text-danger-700">
          <AlertCircle size={14} />
          Time expired. You can no longer run or submit code.
        </div>
      )}

      {/* Question tabs */}
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {test.questions.map((_, i) => {
          const run = runResults[i]
          const active = i === currentIdx
          const tone = active
            ? 'bg-white border-ink-300 text-ink-900'
            : run?.allPassed
              ? 'bg-positive-50 border-positive-100 text-positive-700'
              : run
                ? 'bg-warn-50 border-warn-100 text-warn-700'
                : 'bg-transparent border-transparent text-ink-500 hover:bg-ink-100'
          return (
            <button
              key={i}
              onClick={() => setCurrentIdx(i)}
              className={`h-7 px-2.5 rounded-md border text-[12px] num flex-shrink-0 transition-colors ${tone}`}
              aria-current={active}
            >
              Q{i + 1}
            </button>
          )
        })}
      </div>

      {/* Editor + question */}
      <div className="grid lg:grid-cols-2 gap-3 flex-1 min-h-0">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="card p-5">
            <p className="text-[11.5px] text-ink-500 mb-2">Problem statement</p>
            <p className="text-[13px] text-ink-800 leading-6">{q.question}</p>

            {q.sampleInput && (
              <div className="surface-inset px-3 py-2 mt-3">
                <p className="text-[10.5px] text-ink-500">Sample input</p>
                <code className="num text-[12.5px] text-ink-800">{q.sampleInput}</code>
              </div>
            )}
          </div>

          {currentRunResult && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
                <p className="text-[12px] font-medium text-ink-900">Test results</p>
                <span className={`num text-[11.5px] ${
                  currentRunResult.allPassed ? 'text-positive-600' : 'text-warn-600'
                }`}>
                  {currentRunResult.passed}/{currentRunResult.total} passed
                </span>
              </div>
              <ul className="divide-y divide-line max-h-[260px] overflow-y-auto">
                {currentRunResult.results.map((r, i) => (
                  <li key={i} className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {r.passed
                        ? <CheckCircle2 size={12} className="text-positive-600" strokeWidth={1.8} />
                        : <XCircle size={12} className="text-danger-600" strokeWidth={1.8} />}
                      <span className="text-[12px] text-ink-800">
                        Case {i + 1}: {r.passed ? 'passed' : 'failed'}
                      </span>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 mt-1.5 num text-[11px]">
                      <div>
                        <dt className="text-ink-400">input</dt>
                        <dd className="text-ink-700 break-all">{r.input}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-400">expected</dt>
                        <dd className="text-ink-700 break-all">{r.expectedOutput}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-400">got</dt>
                        <dd className={`break-all ${r.passed ? 'text-positive-700' : r.error ? 'text-danger-700' : 'text-warn-700'}`}>
                          {r.actualOutput || r.error || '(empty)'}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="card flex flex-col overflow-hidden min-h-[360px]">
          <div className="flex items-center justify-between gap-2 px-3 h-11 border-b border-line flex-shrink-0">
            <div className="flex items-center gap-2">
              <Code2 size={14} className="text-ink-400" strokeWidth={1.7} />
              <select
                id="language-select"
                value={currentAnswer.language}
                onChange={e => handleLanguageChange(e.target.value)}
                disabled={timeExpired}
                className="bg-transparent text-[12px] text-ink-700 border-0 p-0 pr-1 focus:outline-none disabled:opacity-50"
                aria-label="Language"
              >
                <option value="javascript">JavaScript</option>
                <option value="python" disabled={!runtimes.judge0}>
                  Python{runtimes.judge0 ? '' : ' — unavailable'}
                </option>
                <option value="java" disabled={!runtimes.judge0}>
                  Java{runtimes.judge0 ? '' : ' — unavailable'}
                </option>
                <option value="cpp" disabled={!runtimes.judge0}>
                  C++{runtimes.judge0 ? '' : ' — unavailable'}
                </option>
              </select>
            </div>

            <button
              id="run-code-btn"
              onClick={handleRunCode}
              disabled={running || timeExpired || submitting}
              className="btn-secondary btn-sm"
            >
              {running
                ? <><Loader2 size={12} className="animate-spin" /> Running</>
                : <><Play size={12} /> Run code</>}
            </button>
          </div>

          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language={currentAnswer.language === 'cpp' ? 'cpp' : currentAnswer.language}
              value={currentAnswer.code}
              onChange={handleEditorChange}
              onMount={editor => { editorRef.current = editor }}
              theme="vs"
              options={{
                fontSize: 13,
                fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 12, bottom: 12 },
                lineNumbers: 'on',
                wordWrap: 'on',
                automaticLayout: true,
                tabSize: 2,
                readOnly: timeExpired,
              }}
            />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          id="prev-question-btn"
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx(i => i - 1)}
          className="btn-secondary btn-sm"
        >
          <ChevronLeft size={14} /> Previous
        </button>

        <div className="flex items-center gap-2">
          <button
            id="submit-test-btn"
            onClick={handleSubmit}
            disabled={submitting || timeExpired}
            className="btn-primary btn-sm"
          >
            {submitting
              ? <><Loader2 size={13} className="animate-spin" /> Submitting</>
              : <><Send size={13} /> Submit all</>}
          </button>

          {!isLast && (
            <button
              id="next-question-btn"
              onClick={() => setCurrentIdx(i => i + 1)}
              className="btn-secondary btn-sm"
            >
              Next <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
