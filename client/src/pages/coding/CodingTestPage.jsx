import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Editor from '@monaco-editor/react'
import {
  Clock, ChevronLeft, ChevronRight, Send,
  CheckCircle2, AlertCircle, Code2, Loader2,
  Play, XCircle
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

// ── Timer Component (server-anchored) ────────────────────────────────────────
function CountdownTimer({ totalSecs, onExpire }) {
  const [remaining, setRemaining] = useState(totalSecs)

  useEffect(() => {
    setRemaining(totalSecs)
  }, [totalSecs])

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return }
    const id = setInterval(() => setRemaining(s => s - 1), 1000)
    return () => clearInterval(id)
  }, [remaining, onExpire])

  const m = String(Math.floor(remaining / 60)).padStart(2, '0')
  const s = String(remaining % 60).padStart(2, '0')
  const urgent = remaining < 120

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-sm font-bold
      ${urgent
        ? 'bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse'
        : 'bg-surface-700 text-slate-300 border border-white/10'
      }`}
    >
      <Clock size={14} className={urgent ? 'text-red-400' : 'text-slate-400'} />
      {m}:{s} remaining
    </div>
  )
}

// ── Difficulty badge colors ──────────────────────────────────────────────────
const difficultyColors = {
  easy:   'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  hard:   'bg-red-500/15 text-red-300 border-red-500/30',
}

export default function CodingTestPage() {
  const { jobId } = useParams()
  const navigate  = useNavigate()

  const [test, setTest]                       = useState(null)
  const [loading, setLoading]                 = useState(true)
  const [currentIdx, setCurrentIdx]           = useState(0)
  const [answers, setAnswers]                 = useState([])
  const [submitting, setSubmitting]           = useState(false)
  const [result, setResult]                   = useState(null)
  const [totalRemainingSecs, setTotalRemainingSecs] = useState(0)
  const [timeExpired, setTimeExpired]         = useState(false)

  // Run Code state
  const [running, setRunning]                 = useState(false)
  const [runResults, setRunResults]           = useState({}) // { [questionIndex]: { results, passed, total, allPassed } }

  const editorRef = useRef(null)

  // ── Fetch the test and record start time on server ─────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/coding-test/${jobId}`)
        const t = data.test
        setTest(t)

        const totalTimeLimitSecs = t.questions.reduce(
          (sum, q) => sum + (q.timeLimit || 15) * 60, 0
        )
        const elapsed = t.startTime
          ? Math.floor((Date.now() - new Date(t.startTime).getTime()) / 1000)
          : 0
        const remaining = Math.max(0, totalTimeLimitSecs - elapsed)
        setTotalRemainingSecs(remaining)
        if (remaining <= 0) setTimeExpired(true)

        setAnswers(t.questions.map((_, i) => ({
          questionIndex: i,
          code: getStarterCode('javascript'),
          language: 'javascript',
        })))
      } catch (err) {
        const errData = err.response?.data
        // Already submitted — show their existing result
        if (errData?.alreadySubmitted) {
          setResult({
            verdict:      errData.submission?.verdict || 'Submitted',
            overallScore: errData.submission?.passRate || 0,
            testResults:  [],
            alreadySubmitted: true,
          })
          return
        }
        toast.error(errData?.message || 'Failed to load test')
        navigate('/my-applications')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [jobId, navigate])

  const getStarterCode = (lang) => {
    const starters = {
      javascript: '// Write your solution here\nfunction solution(input) {\n  \n}\n',
      python:     '# Write your solution here\ndef solution(input):\n    pass\n',
      java:       'public class Solution {\n    public static void main(String[] args) {\n        \n    }\n}',
      cpp:        '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}',
    }
    return starters[lang] || starters.javascript
  }

  const handleLanguageChange = (lang) => {
    setAnswers(prev => prev.map((a, i) =>
      i === currentIdx ? { ...a, language: lang, code: getStarterCode(lang) } : a
    ))
    // Clear run results for this question when language changes
    setRunResults(prev => { const n = { ...prev }; delete n[currentIdx]; return n })
  }

  const handleEditorChange = useCallback((value) => {
    setAnswers(prev => prev.map((a, i) =>
      i === currentIdx ? { ...a, code: value || '' } : a
    ))
  }, [currentIdx])

  // ── Timer expire ───────────────────────────────────────────────────────────
  const handleTimerExpire = useCallback(() => {
    setTimeExpired(true)
    toast.error('Total time is up! Auto-submitting…', { icon: '⏰', duration: 4000 })
    setSubmitting(true)
    api.post('/coding-test/submit', { jobId, answers })
      .then(({ data }) => { setResult(data) })
      .catch(() => toast.error('Auto-submit failed — please refresh and try again'))
      .finally(() => setSubmitting(false))
  }, [jobId, answers])

  // ── Run Code (no save) ─────────────────────────────────────────────────────
  const handleRunCode = async () => {
    if (timeExpired) return
    const currentAnswer = answers[currentIdx]
    if (!currentAnswer?.code?.trim()) {
      toast.error('Write some code before running!')
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

      if (data.allPassed) {
        toast.success(`All ${data.total} test cases passed!`, { icon: '🎉' })
      } else {
        toast(`${data.passed}/${data.total} test cases passed`, { icon: '🧪' })
      }
    } catch (err) {
      if (err.response?.data?.timeExpired) {
        setTimeExpired(true)
        toast.error('Time expired!')
      } else {
        toast.error(err.response?.data?.message || 'Execution failed')
      }
    } finally {
      setRunning(false)
    }
  }

  // ── Final Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (timeExpired) return
    if (!window.confirm('Submit all answers? This cannot be undone.')) return
    setSubmitting(true)
    try {
      const { data } = await api.post('/coding-test/submit', { jobId, answers })
      setResult(data)
      toast.success('Test submitted successfully!')
    } catch (err) {
      if (err.response?.data?.timeExpired) {
        setTimeExpired(true)
        toast.error('Time expired — submission rejected')
      } else {
        toast.error(err.response?.data?.message || 'Submission failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    )
  }

  // ── Result screen (post-submission) ────────────────────────────────────────
  if (result) {
    const passed   = result.verdict === 'Accepted'
    const partial  = result.verdict === 'Partial'
    const ai       = result.aiFeedback

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto space-y-4 py-4"
      >
        {/* Verdict card */}
        <div className="card text-center py-8">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4
            ${passed ? 'bg-emerald-500/15' : partial ? 'bg-amber-500/15' : 'bg-red-500/15'}`}>
            {passed
              ? <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              : <AlertCircle  className="w-10 h-10 text-amber-400" />}
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">{result.verdict}</h2>
          <p className="text-slate-400 mb-1">Overall score: <span className="text-white font-bold text-xl">{result.overallScore}%</span></p>
          {result.alreadySubmitted && (
            <p className="text-amber-400 text-xs mt-2 bg-amber-500/10 px-3 py-1.5 rounded-lg inline-block">
              ⚠️ You had already submitted this test
            </p>
          )}
        </div>

        {/* Per-question breakdown */}
        {(result.testResults || []).length > 0 && (
          <div className="card">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">Question Breakdown</p>
            <div className="grid grid-cols-3 gap-3">
              {result.testResults.map((r, i) => (
                <div key={i} className="bg-surface-700 rounded-xl p-3 border border-white/[0.06] text-center">
                  <p className="text-slate-400 text-xs mb-1">Q{i + 1}</p>
                  <p className={`font-bold text-xl ${
                    r.score === 100 ? 'text-emerald-400' :
                    r.score >= 50   ? 'text-amber-400'   : 'text-red-400'}`}>{r.score}%</p>
                  <p className="text-slate-500 text-xs">{r.passed}/{r.total} passed</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Feedback panel */}
        {ai && (
          <div className="card border border-primary-500/20 bg-primary-500/[0.03]">
            <div className="flex items-center gap-2 mb-4">
              <Code2 size={16} className="text-primary-400" />
              <p className="text-white font-semibold text-sm">AI Code Review</p>
              <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-lg ${
                ai.codeQuality === 'excellent' ? 'bg-emerald-500/10 text-emerald-400' :
                ai.codeQuality === 'good'      ? 'bg-blue-500/10    text-blue-400'    :
                ai.codeQuality === 'fair'      ? 'bg-amber-500/10   text-amber-400'   :
                'bg-red-500/10 text-red-400'}`}>
                {ai.codeQuality?.charAt(0).toUpperCase() + ai.codeQuality?.slice(1)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-surface-700 rounded-xl p-3">
                <p className="text-slate-500 text-xs mb-1">Time Complexity</p>
                <p className="text-white font-mono font-semibold">{ai.timeComplexity || 'N/A'}</p>
              </div>
              <div className="bg-surface-700 rounded-xl p-3">
                <p className="text-slate-500 text-xs mb-1">Space Complexity</p>
                <p className="text-white font-mono font-semibold">{ai.spaceComplexity || 'N/A'}</p>
              </div>
            </div>

            {ai.feedback && (
              <p className="text-slate-300 text-sm leading-relaxed mb-4 p-3 bg-surface-700 rounded-xl">
                {ai.feedback}
              </p>
            )}

            {ai.improvements?.length > 0 && (
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-2">Suggestions</p>
                <ul className="space-y-1.5">
                  {ai.improvements.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                      <span className="text-primary-400 mt-0.5 flex-shrink-0">→</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => navigate('/my-applications')}
          className="btn-primary mx-auto"
        >
          Back to Applications
        </button>
      </motion.div>
    )
  }

  const q = test.questions[currentIdx]
  const currentAnswer = answers[currentIdx] || { code: '', language: 'javascript' }
  const isLast        = currentIdx === test.questions.length - 1
  const currentRunResult = runResults[currentIdx]

  return (
    <div className="flex flex-col gap-4 h-full animate-fade-in">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-500/15 border border-primary-500/20 flex items-center justify-center">
            <Code2 className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">{test.role} Assessment</p>
            <p className="text-slate-500 text-xs">
              Question {currentIdx + 1} of {test.questions.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`badge capitalize border ${difficultyColors[test.difficulty] || difficultyColors.medium}`}>
            {test.difficulty}
          </span>
          <CountdownTimer
            totalSecs={totalRemainingSecs}
            onExpire={handleTimerExpire}
          />
        </div>
      </div>

      {/* ── Time expired banner ─────────────────────────────────────────────── */}
      {timeExpired && !result && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm">
          <AlertCircle size={16} />
          <span className="font-medium">Time expired — you can no longer run or submit code.</span>
        </div>
      )}

      {/* ── Question tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {test.questions.map((_, i) => {
          const hasRun  = runResults[i]
          const allPass = hasRun?.allPassed
          return (
            <button
              key={i}
              onClick={() => setCurrentIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0
                ${i === currentIdx
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                  : allPass
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : hasRun
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : answers[i]?.code?.trim().length > 20
                        ? 'bg-surface-600 text-slate-300 border border-white/10'
                        : 'bg-surface-700 text-slate-400 border border-white/5 hover:bg-surface-600'
                }`}
            >
              Q{i + 1}
              {allPass && <CheckCircle2 size={10} className="inline ml-1" />}
            </button>
          )
        })}
      </div>

      {/* ── Main split: question + editor ─────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Question panel + run results */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              className="card"
            >
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-3">
                Problem Statement
              </p>
              <p className="text-white leading-relaxed mb-5">{q.question}</p>

              {q.sampleInput && (
                <div className="bg-surface-700 rounded-xl p-3 border border-white/[0.06]">
                  <p className="text-xs text-slate-500 mb-1.5 font-medium">Sample Input</p>
                  <code className="text-emerald-300 text-sm font-mono">{q.sampleInput}</code>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* ── Run Results Panel ─────────────────────────────────────────── */}
          <AnimatePresence>
            {currentRunResult && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="card"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                    Test Results
                  </p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                    ${currentRunResult.allPassed
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {currentRunResult.passed}/{currentRunResult.total} passed
                  </span>
                </div>

                <div className="space-y-2">
                  {currentRunResult.results.map((r, i) => (
                    <div
                      key={i}
                      className={`rounded-xl p-3 border text-sm
                        ${r.passed
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : 'bg-red-500/5 border-red-500/20'
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        {r.passed
                          ? <CheckCircle2 size={14} className="text-emerald-400" />
                          : <XCircle size={14} className="text-red-400" />
                        }
                        <span className={`font-semibold text-xs ${r.passed ? 'text-emerald-300' : 'text-red-300'}`}>
                          Test Case {i + 1}: {r.passed ? 'Passed' : 'Failed'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                        <div>
                          <p className="text-slate-500 mb-0.5">Input</p>
                          <code className="text-slate-300 font-mono break-all">{r.input}</code>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-0.5">Expected</p>
                          <code className="text-emerald-300 font-mono break-all">{r.expectedOutput}</code>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-0.5">Got</p>
                          <code className={`font-mono break-all ${r.passed ? 'text-emerald-300' : r.error ? 'text-red-400' : 'text-amber-300'}`}>
                            {r.actualOutput}
                          </code>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Editor panel */}
        <div className="card p-0 overflow-hidden flex flex-col min-h-[400px]">
          {/* Editor toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.07] flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-amber-500/70" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
            </div>
            <div className="flex items-center gap-2">
              <select
                id="language-select"
                value={currentAnswer.language}
                onChange={e => handleLanguageChange(e.target.value)}
                disabled={timeExpired}
                className="bg-surface-700 border border-white/10 text-slate-300 text-xs rounded-lg px-2 py-1 focus:outline-none disabled:opacity-40"
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>

              {/* ── Run Code Button ─────────────────────────────────────── */}
              <button
                id="run-code-btn"
                onClick={handleRunCode}
                disabled={running || timeExpired || submitting}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold
                  bg-emerald-600 hover:bg-emerald-500 text-white
                  disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {running
                  ? <><Loader2 size={12} className="animate-spin" /> Running…</>
                  : <><Play size={12} /> Run Code</>
                }
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1">
            <Editor
              height="100%"
              language={currentAnswer.language === 'cpp' ? 'cpp' : currentAnswer.language}
              value={currentAnswer.code}
              onChange={handleEditorChange}
              onMount={editor => { editorRef.current = editor }}
              theme="vs-dark"
              options={{
                fontSize: 13,
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

      {/* ── Navigation + Submit ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <button
          id="prev-question-btn"
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx(i => i - 1)}
          className="btn-secondary gap-2 disabled:opacity-30"
        >
          <ChevronLeft size={16} /> Previous
        </button>

        <div className="flex items-center gap-2">
          {/* Submit is always visible (not just on last question) */}
          <button
            id="submit-test-btn"
            onClick={handleSubmit}
            disabled={submitting || timeExpired}
            className="btn-primary gap-2 disabled:opacity-40"
          >
            {submitting
              ? <><Loader2 size={15} className="animate-spin" /> Submitting…</>
              : <><Send size={15} /> Submit All</>
            }
          </button>

          {!isLast && (
            <button
              id="next-question-btn"
              onClick={() => setCurrentIdx(i => i + 1)}
              className="btn-secondary gap-2"
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
