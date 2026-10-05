import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Editor from '@monaco-editor/react'
import {
  Play, Send, ChevronDown, CheckCircle, XCircle,
  AlertCircle, Clock, Cpu, RotateCcw, Loader2,
  Code2, BookOpen, Trophy, ChevronRight
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

// ── Difficulty badges ──────────────────────────────────────────────────────
const diffConfig = {
  easy:   { cls: 'badge-success', label: 'Easy' },
  medium: { cls: 'badge-warning', label: 'Medium' },
  hard:   { cls: 'badge-danger',  label: 'Hard' },
}

// ── Default starter code per language when no problem is loaded ────────────
const DEFAULT_CODE = {
  javascript: `// Start coding...\nfunction solution() {\n  console.log("Hello, World!");\n}\nsolution();`,
  python: `# Start coding...\ndef solution():\n    print("Hello, World!")\n\nsolution()`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`,
  java: `public class Solution {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
  go: `package main\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}`,
  rust: `fn main() {\n    println!("Hello, World!");\n}`,
}

// ── Verdict styling ────────────────────────────────────────────────────────
const verdictConfig = {
  Accepted:     { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle },
  Partial:      { color: 'text-amber-400',   bg: 'bg-amber-500/10',   icon: AlertCircle },
  'Wrong Answer':{ color: 'text-red-400',    bg: 'bg-red-500/10',     icon: XCircle },
}

export default function CodingPage() {
  const [problems, setProblems]         = useState([])
  const [activeProblem, setActiveProblem] = useState(null)
  const [language, setLanguage]         = useState('javascript')
  const [availLangs, setAvailLangs]     = useState([])
  const [code, setCode]                 = useState(DEFAULT_CODE.javascript)
  const [stdin, setStdin]               = useState('')
  const [runResult, setRunResult]       = useState(null)
  const [submitResult, setSubmitResult] = useState(null)
  const [running, setRunning]           = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [activeTab, setActiveTab]       = useState('problem') // 'problem' | 'results' | 'ai'
  const [diffFilter, setDiffFilter]     = useState('')
  const [showProblems, setShowProblems] = useState(true)

  // Fetch problems + languages on mount
  useEffect(() => {
    api.get('/code/languages').then(r => setAvailLangs(r.data.languages)).catch(() => {})
    api.get('/code/problems').then(r => setProblems(r.data.problems)).catch(() => {})
  }, [])

  // When language changes, reset code to starter
  const handleLangChange = (lang) => {
    setLanguage(lang)
    const starter = activeProblem?.starterCode?.[lang] || DEFAULT_CODE[lang] || '// Start coding...'
    setCode(starter)
  }

  // Load a problem
  const loadProblem = async (slug) => {
    try {
      const { data } = await api.get(`/code/problems/${slug}`)
      setActiveProblem(data.problem)
      const starter = data.problem.starterCode?.[language] || DEFAULT_CODE[language]
      setCode(starter)
      setRunResult(null); setSubmitResult(null)
      setActiveTab('problem')
    } catch { toast.error('Failed to load problem') }
  }

  // Run code (custom stdin)
  const handleRun = async () => {
    if (!code.trim()) return
    setRunning(true); setRunResult(null)
    try {
      const { data } = await api.post('/code/run', { code, language, stdin })
      setRunResult(data.result)
      setActiveTab('results')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Run failed')
    } finally { setRunning(false) }
  }

  // Submit against test cases
  const handleSubmit = async () => {
    if (!activeProblem) return toast.error('Select a problem first')
    setSubmitting(true); setSubmitResult(null)
    try {
      const { data } = await api.post('/code/submit', {
        code, language, problemSlug: activeProblem.slug
      })
      setSubmitResult(data)
      setActiveTab('results')
      if (data.verdict === 'Accepted') toast.success('🎉 All tests passed!')
      else toast.error(`${data.passed}/${data.total} tests passed`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submit failed')
    } finally { setSubmitting(false) }
  }

  const resetCode = () => {
    const starter = activeProblem?.starterCode?.[language] || DEFAULT_CODE[language]
    setCode(starter)
    toast('Code reset to starter template')
  }

  const filteredProblems = diffFilter
    ? problems.filter(p => p.difficulty === diffFilter)
    : problems

  const vc = submitResult && verdictConfig[submitResult.verdict]

  return (
    <div className="h-[calc(100vh-112px)] flex gap-0 animate-fade-in overflow-hidden rounded-xl border border-white/[0.07]">

      {/* ── Left Panel: Problem List ───────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {showProblems && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }} animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.25 }}
            className="bg-surface-800 border-r border-white/[0.07] flex flex-col overflow-hidden flex-shrink-0"
          >
            <div className="p-3 border-b border-white/[0.07] flex items-center justify-between">
              <span className="text-white font-semibold text-sm flex items-center gap-2">
                <BookOpen size={15} className="text-primary-400" /> Problems
              </span>
              <select
                className="text-xs bg-surface-700 border border-white/10 text-slate-300 rounded-lg px-2 py-1 focus:outline-none"
                value={diffFilter} onChange={e => setDiffFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
              {filteredProblems.length === 0 ? (
                <p className="text-slate-500 text-xs p-4 text-center">No problems found.<br />Run the seed script first.</p>
              ) : filteredProblems.map((p, i) => (
                <button key={p._id}
                  onClick={() => loadProblem(p.slug)}
                  className={`w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors
                    ${activeProblem?.slug === p.slug ? 'bg-primary-500/10 border-l-2 border-primary-500' : ''}`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-slate-200 text-xs font-medium line-clamp-1">{p.title}</span>
                    <span className={`${diffConfig[p.difficulty].cls} badge text-[10px] px-1.5 py-0`}>
                      {diffConfig[p.difficulty].label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.tags?.slice(0, 2).map(t => (
                      <span key={t} className="text-slate-500 text-[10px]">#{t}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Center: Monaco Editor ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Editor Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface-800 border-b border-white/[0.07] gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Toggle problem list */}
            <button onClick={() => setShowProblems(p => !p)}
              className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5">
              <BookOpen size={16} />
            </button>

            {/* Problem name & difficulty */}
            {activeProblem ? (
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-medium">{activeProblem.title}</span>
                <span className={`${diffConfig[activeProblem.difficulty].cls} badge text-xs`}>
                  {diffConfig[activeProblem.difficulty].label}
                </span>
              </div>
            ) : (
              <span className="text-slate-400 text-sm">Select a problem →</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Language selector */}
            <div className="relative">
              <select
                id="language-select"
                value={language}
                onChange={e => handleLangChange(e.target.value)}
                className="text-sm bg-surface-700 border border-white/10 text-slate-200 rounded-xl pl-3 pr-7 py-1.5 focus:outline-none focus:border-primary-500/40 appearance-none cursor-pointer"
              >
                {(availLangs.length > 0
                  ? availLangs
                  : Object.keys(DEFAULT_CODE).map(k => ({ key: k, name: k }))
                ).map(l => (
                  <option key={l.key} value={l.key}>{l.key}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 w-3.5 h-3.5 pointer-events-none" />
            </div>

            {/* Reset */}
            <button onClick={resetCode} title="Reset to starter"
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
              <RotateCcw size={15} />
            </button>

            {/* Run */}
            <button id="run-code-btn"
              onClick={handleRun} disabled={running || submitting}
              className="btn-secondary text-xs px-3 py-2 gap-1.5 disabled:opacity-50">
              {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Run
            </button>

            {/* Submit */}
            <button id="submit-code-btn"
              onClick={handleSubmit} disabled={running || submitting || !activeProblem}
              className="btn-primary text-xs px-4 py-2 gap-1.5 disabled:opacity-40">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit
            </button>
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            language={language === 'cpp' ? 'cpp' : language === 'csharp' ? 'csharp' : language}
            value={code}
            onChange={v => setCode(v || '')}
            theme="vs-dark"
            options={{
              fontSize: 14,
              fontFamily: 'JetBrains Mono, Fira Code, monospace',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 16, bottom: 16 },
              lineNumbers: 'on',
              roundedSelection: true,
              wordWrap: 'on',
              tabSize: 2,
              automaticLayout: true,
              suggest: { showWords: false },
            }}
          />
        </div>
      </div>

      {/* ── Right Panel: Problem Description + Results ─────────────────── */}
      <div className="w-80 flex flex-col bg-surface-800 border-l border-white/[0.07] overflow-hidden flex-shrink-0">
        {/* Tabs */}
        <div className="flex border-b border-white/[0.07] flex-shrink-0">
          {[
            { key: 'problem', label: 'Problem', icon: BookOpen },
            { key: 'results', label: 'Results', icon: CheckCircle },
            { key: 'ai',      label: 'AI Eval', icon: Trophy },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors
                ${activeTab === tab.key
                  ? 'text-primary-300 border-b-2 border-primary-500 bg-primary-500/5'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <tab.icon size={13} /> {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── Problem Description ── */}
          {activeTab === 'problem' && (
            <div className="p-4 space-y-4">
              {activeProblem ? (
                <>
                  <div>
                    <h3 className="text-white font-semibold mb-2">{activeProblem.title}</h3>
                    <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">
                      {activeProblem.description}
                    </p>
                  </div>
                  {activeProblem.examples?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Examples</p>
                      {activeProblem.examples.map((ex, i) => (
                        <div key={i} className="bg-surface-900 rounded-xl p-3 space-y-1">
                          <p className="text-slate-400 text-xs"><span className="text-slate-300 font-medium">Input:</span> {ex.input}</p>
                          <p className="text-slate-400 text-xs"><span className="text-slate-300 font-medium">Output:</span> {ex.output}</p>
                          {ex.explanation && <p className="text-slate-500 text-xs">{ex.explanation}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  {activeProblem.constraints && (
                    <div>
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Constraints</p>
                      <p className="text-slate-400 text-xs leading-relaxed font-mono whitespace-pre">{activeProblem.constraints}</p>
                    </div>
                  )}
                  {activeProblem.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {activeProblem.tags.map(t => (
                        <span key={t} className="badge bg-surface-700 text-slate-400 border-white/10 text-[10px]">#{t}</span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <Code2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Select a problem from the list to get started</p>
                </div>
              )}

              {/* Custom stdin for Run */}
              <div className="border-t border-white/[0.07] pt-4">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Custom Input (stdin)</p>
                <textarea
                  className="input text-xs font-mono resize-none"
                  rows={3}
                  placeholder="Enter custom input to test with Run..."
                  value={stdin}
                  onChange={e => setStdin(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── Run/Submit Results ── */}
          {activeTab === 'results' && (
            <div className="p-4 space-y-4">
              {/* Run result */}
              {runResult && !submitResult && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Run Output</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      {runResult.time && <span className="flex items-center gap-1"><Clock size={11}/> {runResult.time}</span>}
                      {runResult.memory && <span className="flex items-center gap-1"><Cpu size={11}/> {runResult.memory}</span>}
                    </div>
                  </div>
                  <div className={`rounded-xl p-3 text-xs font-mono whitespace-pre-wrap break-all
                    ${runResult.accepted ? 'bg-emerald-500/8 border border-emerald-500/20 text-emerald-300'
                      : 'bg-red-500/8 border border-red-500/20 text-red-300'}`}>
                    {runResult.stdout || runResult.stderr || runResult.compileOutput || '(no output)'}
                  </div>
                  {(runResult.stderr || runResult.compileOutput) && runResult.stdout && (
                    <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3 mt-2">
                      <p className="text-red-400 text-xs font-mono whitespace-pre-wrap">
                        {runResult.stderr || runResult.compileOutput}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Submit result */}
              {submitResult && (
                <div className="space-y-3">
                  {/* Verdict */}
                  {vc && (
                    <div className={`flex items-center gap-3 p-3 rounded-xl ${vc.bg} border border-white/10`}>
                      <vc.icon size={20} className={vc.color} />
                      <div>
                        <p className={`font-bold ${vc.color}`}>{submitResult.verdict}</p>
                        <p className="text-slate-400 text-xs">{submitResult.passed}/{submitResult.total} test cases passed</p>
                      </div>
                    </div>
                  )}

                  {/* Pass rate bar */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Pass Rate</span>
                      <span className="font-bold text-white">{submitResult.passRate}%</span>
                    </div>
                    <div className="h-2 bg-surface-600 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${submitResult.passRate}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full ${submitResult.passRate === 100 ? 'bg-emerald-500' : submitResult.passRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      />
                    </div>
                  </div>

                  {/* Test cases */}
                  <div className="space-y-2">
                    {(submitResult.testResults || []).map((r, i) => (
                      <div key={i} className={`rounded-xl p-3 border text-xs
                        ${r.passed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {r.passed
                            ? <CheckCircle size={13} className="text-emerald-400" />
                            : <XCircle size={13} className="text-red-400" />}
                          <span className={r.passed ? 'text-emerald-300' : 'text-red-300'}>
                            Test {i + 1} {r.passed ? 'Passed' : 'Failed'}
                          </span>
                          {r.time && <span className="text-slate-500 ml-auto">{r.time}</span>}
                        </div>
                        {!r.passed && (
                          <div className="mt-2 space-y-1 font-mono">
                            {r.input !== '(hidden)' && <p className="text-slate-400">Input: <span className="text-slate-300">{r.input}</span></p>}
                            {r.expected !== '(hidden)' && <p className="text-slate-400">Expected: <span className="text-emerald-300">{r.expected}</span></p>}
                            <p className="text-slate-400">Got: <span className="text-red-300">{r.actual || r.error || '(empty)'}</span></p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!runResult && !submitResult && (
                <div className="text-center py-10">
                  <Play className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Run or Submit your code to see results</p>
                </div>
              )}
            </div>
          )}

          {/* ── AI Evaluation ── */}
          {activeTab === 'ai' && (
            <div className="p-4 space-y-4">
              {submitResult?.aiEval && submitResult.aiEval.score != null ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider">AI Code Review</p>
                    <span className="text-2xl font-bold text-white">{submitResult.aiEval.score}<span className="text-slate-500 text-sm">/100</span></span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Time',    value: submitResult.aiEval.timeComplexity  },
                      { label: 'Space',   value: submitResult.aiEval.spaceComplexity },
                      { label: 'Quality', value: submitResult.aiEval.codeQuality    },
                      { label: 'Correctness', value: `${submitResult.aiEval.correctness}%` },
                    ].map(({label, value}) => (
                      <div key={label} className="bg-surface-900 rounded-xl p-2.5 text-center">
                        <p className="text-slate-500 text-[10px] mb-0.5">{label}</p>
                        <p className="text-white text-xs font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs font-semibold mb-2">Feedback</p>
                    <p className="text-slate-300 text-xs leading-relaxed">{submitResult.aiEval.feedback}</p>
                  </div>
                  {submitResult.aiEval.improvements?.length > 0 && (
                    <div>
                      <p className="text-slate-400 text-xs font-semibold mb-2">Improvements</p>
                      <ul className="space-y-1.5">
                        {submitResult.aiEval.improvements.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                            <ChevronRight size={12} className="text-primary-400 mt-0.5 flex-shrink-0" /> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-10">
                  <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Submit your code to get AI evaluation</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
