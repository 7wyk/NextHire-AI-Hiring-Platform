import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Send, Loader2, Zap, User, Bot,
  CheckCircle, XCircle, AlertCircle, Clock, Trophy,
  ChevronDown, Star, RefreshCw, Plus, BarChart3
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const recColors = {
  hire:          { cls: 'badge-success', label: '✅ Hire',           icon: CheckCircle },
  'interview-next': { cls: 'badge-primary', label: '🔄 Next Round', icon: RefreshCw },
  reject:        { cls: 'badge-danger',  label: '❌ Not a Fit',      icon: XCircle },
  pending:       { cls: 'badge-warning', label: '⏳ Pending',         icon: Clock },
}

const ScoreBar = ({ label, value, color = 'bg-primary-500' }) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span className="text-slate-400">{label}</span>
      <span className="text-white font-semibold">{value}%</span>
    </div>
    <div className="h-1.5 bg-surface-600 rounded-full overflow-hidden">
      <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={`h-full ${color} rounded-full`} />
    </div>
  </div>
)

export default function InterviewPage() {
  const [candidates, setCandidates] = useState([])
  const [jobs, setJobs] = useState([])
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)
  const [view, setView] = useState('list')  // 'list' | 'chat' | 'new'
  const [newForm, setNewForm] = useState({ candidateId: '', jobId: '' })
  const messagesEndRef = useRef(null)

  useEffect(() => {
    api.get('/candidates').then(r => setCandidates(r.data.candidates)).catch(() => {})
    api.get('/jobs?status=active').then(r => setJobs(r.data.jobs)).catch(() => {})
    api.get('/interview/sessions').then(r => setSessions(r.data.sessions)).catch(() => {})
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages])

  const handleCreateSession = async (e) => {
    e.preventDefault()
    if (!newForm.candidateId || !newForm.jobId) return toast.error('Select a candidate and job')
    setCreating(true)
    try {
      console.log('[InterviewPage] Starting session:', { candidateId: newForm.candidateId, jobId: newForm.jobId })
      const { data } = await api.post('/interview/sessions', newForm)
      setSessions(prev => [data.session, ...prev])
      setActiveSession(data.session)
      setView('chat')
      toast.success('Interview session started! 🎙️')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start session')
    } finally { setCreating(false) }
  }

  const handleSend = async () => {
    if (!input.trim() || sending || !activeSession) return
    const msgText = input.trim()
    setInput('')
    setSending(true)

    // Optimistic UI: add candidate message immediately
    setActiveSession(prev => ({
      ...prev,
      messages: [...prev.messages, { role: 'candidate', content: msgText, timestamp: new Date() }]
    }))

    try {
      const { data } = await api.post(`/interview/sessions/${activeSession._id}/message`, { content: msgText })
      setActiveSession(data.session)
      // Update session in list
      setSessions(prev => prev.map(s => s._id === data.session._id ? data.session : s))
      if (data.isComplete) toast.success('Interview complete! AI summary generated.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message')
    } finally { setSending(false) }
  }

  const loadSession = async (id) => {
    try {
      const { data } = await api.get(`/interview/sessions/${id}`)
      setActiveSession(data.session)
      setView('chat')
    } catch { toast.error('Failed to load session') }
  }

  const isComplete = activeSession?.status === 'completed'

  return (
    <div className="h-[calc(100vh-112px)] flex gap-5 animate-fade-in overflow-hidden">

      {/* ── Left: Sessions List ──────────────────────────────────────── */}
      <div className="w-64 flex flex-col gap-3 flex-shrink-0">
        <button id="new-interview-btn"
          onClick={() => setView('new')}
          className="btn-primary w-full justify-center">
          <Plus size={15} /> New Interview
        </button>

        <div className="card flex-1 overflow-hidden flex flex-col p-0">
          <div className="px-4 py-3 border-b border-white/[0.07]">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sessions</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
            {sessions.length === 0 ? (
              <p className="text-slate-500 text-xs p-4 text-center">No sessions yet</p>
            ) : sessions.map(s => (
              <button key={s._id} onClick={() => loadSession(s._id)}
                className={`w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors
                  ${activeSession?._id === s._id ? 'bg-primary-500/10 border-l-2 border-primary-500' : ''}`}>
                <p className="text-white text-xs font-medium line-clamp-1">
                  {s.candidate?.name || 'Candidate'}
                </p>
                <p className="text-slate-500 text-[10px] line-clamp-1 mt-0.5">
                  {s.job?.title || 'Role'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`${s.status === 'completed' ? 'badge-success' : 'badge-warning'} badge text-[9px] px-1.5`}>
                    {s.status}
                  </span>
                  {s.scores?.overall > 0 && (
                    <span className="text-primary-400 text-[10px] font-semibold">{s.scores.overall}/100</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Area ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col gap-4">

        {/* === New Session Form === */}
        {view === 'new' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="card max-w-lg mx-auto mt-8 w-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary-500/15 border border-primary-500/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Start AI Interview</h2>
                <p className="text-slate-400 text-xs">AI will generate adaptive questions automatically</p>
              </div>
            </div>
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Candidate *</label>
                <div className="relative">
                  <select className="input pr-8 appearance-none cursor-pointer"
                    value={newForm.candidateId} onChange={e => setNewForm({ ...newForm, candidateId: e.target.value })} required>
                    <option value="">Select candidate…</option>
                    {candidates.map(c => (
                      <option key={c._id} value={c._id}>{c.name} — {c.email}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Job *</label>
                <div className="relative">
                  <select className="input pr-8 appearance-none cursor-pointer"
                    value={newForm.jobId} onChange={e => setNewForm({ ...newForm, jobId: e.target.value })} required>
                    <option value="">Select job…</option>
                    {jobs.map(j => <option key={j._id} value={j._id}>{j.title} — {j.company}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setView('list')} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button id="start-interview-btn" type="submit" disabled={creating} className="btn-primary flex-1 justify-center">
                  {creating ? <><Loader2 size={14} className="animate-spin" /> Starting…</> : <><Zap size={14} /> Start Interview</>}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* === Chat View === */}
        {view === 'chat' && activeSession && (
          <div className="flex gap-4 flex-1 overflow-hidden">
            {/* Chat panel */}
            <div className="flex flex-col flex-1 card p-0 overflow-hidden">
              {/* Chat header */}
              <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500/30 to-accent-500/30 border border-primary-500/20 flex items-center justify-center text-primary-300 font-bold text-sm">
                    {activeSession.candidate?.name?.[0] || 'C'}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{activeSession.candidate?.name || 'Candidate'}</p>
                    <p className="text-slate-500 text-xs">{activeSession.job?.title || activeSession.jobTitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${activeSession.status === 'completed' ? 'badge-success' : 'badge-warning'} badge capitalize`}>
                    {activeSession.status}
                  </span>
                  <span className="text-slate-500 text-xs">
                    Q{activeSession.questionCount || 0}/7
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {activeSession.messages.map((msg, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className={`flex gap-3 ${msg.role === 'candidate' ? 'flex-row-reverse' : ''}`}
                  >
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                      ${msg.role === 'interviewer'
                        ? 'bg-gradient-to-br from-primary-600 to-primary-800 text-white'
                        : 'bg-gradient-to-br from-accent-600 to-accent-800 text-white'}`}>
                      {msg.role === 'interviewer' ? <Bot size={15} /> : <User size={15} />}
                    </div>

                    {/* Bubble */}
                    <div className={`max-w-[75%] ${msg.role === 'candidate' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <p className="text-slate-500 text-[10px]">{msg.role === 'interviewer' ? 'Alex (AI Interviewer)' : 'You'}</p>
                      <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
                        ${msg.role === 'interviewer'
                          ? 'bg-surface-700 text-slate-100 rounded-tl-sm'
                          : 'bg-primary-600/80 text-white rounded-tr-sm'}`}>
                        {msg.content}
                      </div>
                      {msg.score !== undefined && (
                        <div className="flex items-center gap-1.5">
                          {[...Array(5)].map((_, si) => (
                            <Star key={si} size={10}
                              className={si < Math.round(msg.score / 2) ? 'text-amber-400 fill-amber-400' : 'text-slate-600'} />
                          ))}
                          <span className="text-slate-500 text-[10px]">{msg.feedback}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {sending && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center">
                      <Bot size={15} className="text-white" />
                    </div>
                    <div className="bg-surface-700 rounded-2xl rounded-tl-sm px-4 py-3">
                      <span className="flex gap-1">
                        {[0,1,2].map(i => (
                          <span key={i} className="w-2 h-2 rounded-full bg-primary-400 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              {!isComplete ? (
                <div className="p-4 border-t border-white/[0.07] flex gap-3 flex-shrink-0">
                  <input
                    id="interview-input"
                    type="text"
                    className="input flex-1"
                    placeholder="Type your answer…"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    disabled={sending}
                  />
                  <button id="send-answer-btn"
                    onClick={handleSend} disabled={sending || !input.trim()}
                    className="btn-primary px-4 disabled:opacity-50">
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              ) : (
                <div className="p-4 border-t border-white/[0.07] text-center text-sm text-slate-400">
                  ✅ Interview complete — see AI summary on the right
                </div>
              )}
            </div>

            {/* Score Summary (shown when complete or has scores) */}
            {(isComplete || activeSession.scores?.overall > 0) && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className="w-64 flex flex-col gap-3 flex-shrink-0">
                <div className="card">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <BarChart3 size={15} className="text-primary-400" /> AI Evaluation
                  </h3>
                  <div className="space-y-3 mb-4">
                    <ScoreBar label="Overall"       value={activeSession.scores?.overall || 0}       color="bg-primary-500" />
                    <ScoreBar label="Technical"     value={activeSession.scores?.technical || 0}     color="bg-blue-500" />
                    <ScoreBar label="Behavioral"    value={activeSession.scores?.behavioral || 0}    color="bg-purple-500" />
                    <ScoreBar label="Communication" value={activeSession.scores?.communication || 0} color="bg-emerald-500" />
                  </div>
                  {activeSession.recommendation && activeSession.recommendation !== 'pending' && (
                    <div className="pt-3 border-t border-white/[0.07]">
                      {(() => { const rc = recColors[activeSession.recommendation]; return rc ? (
                        <div className={`${rc.cls} badge w-full justify-center py-2 text-sm`}>
                          {rc.label}
                        </div>
                      ) : null })()}
                    </div>
                  )}
                </div>

                {activeSession.summary && (
                  <div className="card text-xs space-y-3">
                    <p className="text-slate-400 font-semibold uppercase tracking-wider">Summary</p>
                    <p className="text-slate-300 leading-relaxed">{activeSession.summary}</p>
                    {activeSession.strengths?.length > 0 && (
                      <div>
                        <p className="text-emerald-400 font-medium mb-1">Strengths</p>
                        {activeSession.strengths.map((s, i) => (
                          <p key={i} className="text-slate-400">• {s}</p>
                        ))}
                      </div>
                    )}
                    {activeSession.concerns?.length > 0 && (
                      <div>
                        <p className="text-amber-400 font-medium mb-1">Concerns</p>
                        {activeSession.concerns.map((c, i) => (
                          <p key={i} className="text-slate-400">• {c}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}

        {/* === Empty state === */}
        {view === 'list' && (
          <div className="card flex flex-col items-center justify-center flex-1 text-center">
            <MessageSquare className="w-14 h-14 text-slate-600 mb-4" />
            <h3 className="text-white font-semibold mb-1">AI Interview Engine</h3>
            <p className="text-slate-400 text-sm mb-6 max-w-sm">
              Start an AI-powered interview session. "Alex", your AI interviewer,
              asks adaptive questions and evaluates responses in real-time.
            </p>
            <button onClick={() => setView('new')} className="btn-primary">
              <Plus size={15} /> Start New Interview
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
