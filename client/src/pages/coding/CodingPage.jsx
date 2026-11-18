import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import {
  Play, Send, ChevronDown, CheckCircle2, XCircle, AlertCircle,
  RotateCcw, Loader2, Code2, BookOpen, PanelLeft,
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { EmptyState } from '../../components/ui'

const DIFFICULTY = {
  easy:   { label: 'Easy',   tone: 'positive' },
  medium: { label: 'Medium', tone: 'warn' },
  hard:   { label: 'Hard',   tone: 'danger' },
}

const DEFAULT_CODE = {
  javascript: `// Start coding\nfunction solution() {\n  console.log("Hello, World!");\n}\nsolution();`,
  python: `# Start coding\ndef solution():\n    print("Hello, World!")\n\nsolution()`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`,
  java: `public class Solution {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
  go: `package main\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}`,
  rust: `fn main() {\n    println!("Hello, World!");\n}`,
}

const VERDICT = {
  Accepted:      { tone: 'text-positive-600 bg-positive-50', icon: CheckCircle2 },
  Partial:       { tone: 'text-warn-600 bg-warn-50', icon: AlertCircle },
  'Wrong Answer':{ tone: 'text-danger-600 bg-danger-50', icon: XCircle },
}

const TABS = [
  { key: 'problem', label: 'Problem' },
  { key: 'results', label: 'Results' },
  { key: 'ai', label: 'Review' },
]

export default function CodingPage() {
  const [problems, setProblems] = useState([])
  const [activeProblem, setActiveProblem] = useState(null)
  const [language, setLanguage] = useState('javascript')
  const [availLangs, setAvailLangs] = useState([])
  const [code, setCode] = useState(DEFAULT_CODE.javascript)
  const [stdin, setStdin] = useState('')
  const [runResult, setRunResult] = useState(null)
  const [submitResult, setSubmitResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('problem')
  const [diffFilter, setDiffFilter] = useState('')
  const [showProblems, setShowProblems] = useState(true)

  useEffect(() => {
    api.get('/code/languages').then(r => setAvailLangs(r.data.languages || [])).catch(() => {})
    api.get('/code/problems').then(r => setProblems(r.data.problems || [])).catch(() => {})
  }, [])

  const handleLangChange = (lang) => {
    setLanguage(lang)
    setCode(activeProblem?.starterCode?.[lang] || DEFAULT_CODE[lang] || '// Start coding')
  }

  const loadProblem = async (slug) => {
    try {
      const { data } = await api.get(`/code/problems/${slug}`)
      setActiveProblem(data.problem)
      setCode(data.problem.starterCode?.[language] || DEFAULT_CODE[language])
      setRunResult(null)
      setSubmitResult(null)
      setActiveTab('problem')
    } catch {
      toast.error('Could not load that problem')
    }
  }

  const handleRun = async () => {
    if (!code.trim()) return
    setRunning(true)
    setRunResult(null)
    setSubmitResult(null)
    try {
      const { data } = await api.post('/code/run', { code, language, stdin })
      setRunResult(data.result)
      setActiveTab('results')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Run failed')
    } finally {
      setRunning(false)
    }
  }

  const handleSubmit = async () => {
    if (!activeProblem) return toast.error('Select a problem before submitting')
    setSubmitting(true)
    setSubmitResult(null)
    try {
      const { data } = await api.post('/code/submit', {
        code, language, problemSlug: activeProblem.slug,
      })
      setSubmitResult(data)
      setActiveTab('results')
      if (data.verdict === 'Accepted') toast.success('All test cases passed')
      else toast.error(`${data.passed}/${data.total} tests passed`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const resetCode = () => {
    setCode(activeProblem?.starterCode?.[language] || DEFAULT_CODE[language])
    toast('Reset to the starter code')
  }

  const filteredProblems = diffFilter
    ? problems.filter(p => p.difficulty === diffFilter)
    : problems

  const vc = submitResult && VERDICT[submitResult.verdict]

  return (
    <div className="h-[calc(100vh-104px)] flex border border-line rounded-xl overflow-hidden bg-white animate-fade-in min-h-[520px]">
      {/* Problems */}
      {showProblems && (
        <aside className="hidden md:flex w-[236px] flex-shrink-0 flex-col border-r border-line">
          <div className="px-3 h-11 flex items-center justify-between border-b border-line">
            <span className="text-[12.5px] font-medium text-ink-800">Problems</span>
            <select
              className="text-[11.5px] bg-white border border-line text-ink-600 rounded-md px-1.5 py-1"
              value={diffFilter}
              onChange={e => setDiffFilter(e.target.value)}
              aria-label="Filter by difficulty"
            >
              <option value="">All</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredProblems.length === 0 ? (
              <p className="text-[12px] text-ink-500 p-4">
                No problems found. The problem set is seeded on the server.
              </p>
            ) : filteredProblems.map(p => {
              const d = DIFFICULTY[p.difficulty] || DIFFICULTY.medium
              const active = activeProblem?.slug === p.slug
              return (
                <button
                  key={p._id}
                  onClick={() => loadProblem(p.slug)}
                  className={`w-full text-left px-3 py-2.5 border-b border-line transition-colors ${
                    active ? 'bg-accent-50' : 'hover:bg-ink-50'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`text-[12.5px] truncate ${active ? 'text-accent-700' : 'text-ink-800'}`}>
                      {p.title}
                    </span>
                    <span className={`pill-${d.tone} flex-shrink-0`}>{d.label}</span>
                  </span>
                  {p.tags?.length > 0 && (
                    <span className="block text-[11px] text-ink-400 mt-0.5 truncate">
                      {p.tags.slice(0, 2).map(t => `#${t}`).join(' ')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </aside>
      )}

      {/* Editor */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 h-11 border-b border-line flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setShowProblems(v => !v)}
              className="hidden md:inline-flex p-1.5 rounded-md text-ink-500 hover:text-ink-900 hover:bg-ink-100"
              aria-label={showProblems ? 'Hide problem list' : 'Show problem list'}
            >
              <PanelLeft size={15} strokeWidth={1.7} />
            </button>
            {activeProblem ? (
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-[12.5px] text-ink-900 truncate">{activeProblem.title}</span>
                <span className={`pill-${DIFFICULTY[activeProblem.difficulty]?.tone || 'warn'} flex-shrink-0`}>
                  {DIFFICULTY[activeProblem.difficulty]?.label || activeProblem.difficulty}
                </span>
              </span>
            ) : (
              <span className="text-[12.5px] text-ink-500">Select a problem</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative">
              <select
                id="language-select"
                value={language}
                onChange={e => handleLangChange(e.target.value)}
                className="input h-7 text-[12px] pr-6 w-auto min-w-[104px]"
                aria-label="Language"
              >
                {(availLangs.length > 0
                  ? availLangs
                  : Object.keys(DEFAULT_CODE).map(k => ({ key: k, name: k }))
                ).map(l => (
                  <option key={l.key} value={l.key}>{l.key}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            </div>

            <button
              onClick={resetCode}
              className="p-1.5 rounded-md text-ink-500 hover:text-ink-900 hover:bg-ink-100"
              title="Reset to starter code"
              aria-label="Reset code"
            >
              <RotateCcw size={14} strokeWidth={1.7} />
            </button>

            <button
              id="run-code-btn"
              onClick={handleRun}
              disabled={running || submitting}
              className="btn-secondary btn-sm"
            >
              {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              Run
            </button>

            <button
              id="submit-code-btn"
              onClick={handleSubmit}
              disabled={running || submitting || !activeProblem}
              className="btn-primary btn-sm"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Submit
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            language={language === 'cpp' ? 'cpp' : language === 'csharp' ? 'csharp' : language}
            value={code}
            onChange={v => setCode(v || '')}
            theme="vs"
            options={{
              fontSize: 13,
              fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 14, bottom: 14 },
              lineNumbers: 'on',
              wordWrap: 'on',
              tabSize: 2,
              automaticLayout: true,
              suggest: { showWords: false },
              renderLineHighlight: 'line',
            }}
          />
        </div>
      </div>

      {/* Side panel */}
      <div className="hidden lg:flex w-[330px] flex-shrink-0 flex-col border-l border-line">
        <div className="flex border-b border-line flex-shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 h-11 ${activeTab === tab.key ? 'tab tab-active' : 'tab'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'problem' && (
            <div className="space-y-4">
              {activeProblem ? (
                <>
                  <p className="text-[12.5px] text-ink-700 leading-6 whitespace-pre-wrap">
                    {activeProblem.description}
                  </p>

                  {activeProblem.examples?.length > 0 && (
                    <div>
                      <p className="text-[11.5px] text-ink-500 mb-1.5">Examples</p>
                      <div className="space-y-2">
                        {activeProblem.examples.map((ex, i) => (
                          <div key={i} className="surface-inset px-3 py-2 space-y-1">
                            <p className="num text-[11.5px] text-ink-700">Input: {ex.input}</p>
                            <p className="num text-[11.5px] text-ink-700">Output: {ex.output}</p>
                            {ex.explanation && (
                              <p className="text-[11.5px] text-ink-500">{ex.explanation}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeProblem.constraints && (
                    <div>
                      <p className="text-[11.5px] text-ink-500 mb-1">Constraints</p>
                      <p className="num text-[11.5px] text-ink-600 whitespace-pre-wrap leading-5">
                        {activeProblem.constraints}
                      </p>
                    </div>
                  )}

                  {activeProblem.tags?.length > 0 && (
                    <p className="text-[11.5px] text-ink-400">
                      {activeProblem.tags.map(t => `#${t}`).join(' ')}
                    </p>
                  )}
                </>
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="No problem selected"
                  description="Choose a problem from the list to read its statement."
                />
              )}

              <div className="pt-4 border-t border-line">
                <label className="label" htmlFor="stdin">Custom input</label>
                <textarea
                  id="stdin"
                  className="input num text-[12px]"
                  rows={3}
                  placeholder="Passed to the program on Run"
                  value={stdin}
                  onChange={e => setStdin(e.target.value)}
                />
              </div>
            </div>
          )}

          {activeTab === 'results' && (
            <div className="space-y-4">
              {runResult && !submitResult && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11.5px] text-ink-500">Run output</p>
                    <p className="num text-[11px] text-ink-400">
                      {[runResult.time, runResult.memory].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <pre className={`num text-[12px] whitespace-pre-wrap break-words rounded-lg border px-3 py-2.5 ${
                    runResult.accepted
                      ? 'bg-positive-50 border-positive-100 text-positive-700'
                      : 'bg-danger-50 border-danger-100 text-danger-700'
                  }`}>
                    {runResult.stdout || runResult.stderr || runResult.compileOutput || '(no output)'}
                  </pre>
                  {runResult.stdout && (runResult.stderr || runResult.compileOutput) && (
                    <pre className="num text-[12px] whitespace-pre-wrap break-words rounded-lg border border-danger-100 bg-danger-50 text-danger-700 px-3 py-2.5 mt-2">
                      {runResult.stderr || runResult.compileOutput}
                    </pre>
                  )}
                </div>
              )}

              {submitResult && (
                <>
                  {vc && (
                    <div className={`rounded-lg px-3 py-2.5 ${vc.tone}`}>
                      <p className="text-[13px] font-medium">{submitResult.verdict}</p>
                      <p className="num text-[11.5px] opacity-80">
                        {submitResult.passed}/{submitResult.total} test cases passed
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="flex items-baseline justify-between text-[11.5px] text-ink-500 mb-1.5">
                      <span>Pass rate</span>
                      <span className="num text-ink-900">{submitResult.passRate}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-600"
                        style={{ width: `${submitResult.passRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(submitResult.testResults || []).map((r, i) => (
                      <div key={i} className="rounded-lg border border-line px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {r.passed
                            ? <CheckCircle2 size={12} className="text-positive-600" strokeWidth={1.8} />
                            : <XCircle size={12} className="text-danger-600" strokeWidth={1.8} />}
                          <span className="text-[12px] text-ink-800">
                            Test {i + 1} {r.passed ? 'passed' : 'failed'}
                          </span>
                          {r.time && <span className="num text-[11px] text-ink-400 ml-auto">{r.time}</span>}
                        </div>
                        {!r.passed && (
                          <div className="num text-[11px] text-ink-600 mt-1.5 space-y-0.5 break-words">
                            {r.input !== '(hidden)' && <p>input: {r.input}</p>}
                            {r.expected !== '(hidden)' && <p>expected: {r.expected}</p>}
                            <p>got: {r.actual || r.error || '(empty)'}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!runResult && !submitResult && (
                <EmptyState
                  icon={Play}
                  title="No output yet"
                  description="Run the code for a quick check, or submit it against the test cases."
                />
              )}
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-4">
              {submitResult?.aiEval?.score != null ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <p className="text-[11.5px] text-ink-500">AI code review</p>
                    <p className="num text-[20px] font-medium text-ink-900">
                      {submitResult.aiEval.score}
                      <span className="text-[12px] text-ink-400">/100</span>
                    </p>
                  </div>

                  <dl className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Time', value: submitResult.aiEval.timeComplexity },
                      { label: 'Space', value: submitResult.aiEval.spaceComplexity },
                      { label: 'Quality', value: submitResult.aiEval.codeQuality },
                      { label: 'Correctness', value: `${submitResult.aiEval.correctness}%` },
                    ].map(({ label, value }) => (
                      <div key={label} className="surface-inset px-2.5 py-2">
                        <dt className="text-[10.5px] text-ink-500">{label}</dt>
                        <dd className="num text-[12px] text-ink-800 mt-0.5">{value ?? '—'}</dd>
                      </div>
                    ))}
                  </dl>

                  {submitResult.aiEval.feedback && (
                    <div>
                      <p className="text-[11.5px] text-ink-500 mb-1">Feedback</p>
                      <p className="text-[12.5px] text-ink-700 leading-6">{submitResult.aiEval.feedback}</p>
                    </div>
                  )}

                  {submitResult.aiEval.improvements?.length > 0 && (
                    <div>
                      <p className="text-[11.5px] text-ink-500 mb-1.5">Improvements</p>
                      <ul className="space-y-1.5">
                        {submitResult.aiEval.improvements.map((s, i) => (
                          <li key={i} className="text-[12.5px] text-ink-700 leading-5 flex gap-2">
                            <span className="num text-[11px] text-ink-400 mt-0.5">{i + 1}</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState
                  icon={Code2}
                  title="No review yet"
                  description="Submit a solution and the AI review appears here."
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
