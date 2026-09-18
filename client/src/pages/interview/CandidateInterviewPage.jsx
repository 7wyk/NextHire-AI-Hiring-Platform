import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, MicOff, MessageSquare, Loader2, Volume2, Clock,
  CheckCircle, ArrowRight, AlertCircle, Keyboard, Send
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const QUESTION_TIME = 30 // seconds per question

// ── Speech support detection ────────────────────────────────────────────────
const isSpeechRecognitionSupported =
  typeof window !== 'undefined' &&
  ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

const isTTSSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window

// ── Circular Timer Component ────────────────────────────────────────────────
function CircularTimer({ seconds, total }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const progress = (seconds / total) * circumference
  const isLow = seconds <= 5

  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="60" cy="60" r={radius} fill="none"
          stroke={isLow ? '#ef4444' : '#6366f1'} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-1000 ease-linear" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-black ${isLow ? 'text-red-400 animate-pulse' : 'text-white'}`}>
          {seconds}
        </span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">seconds</span>
      </div>
    </div>
  )
}

// ── Waveform Animation ──────────────────────────────────────────────────────
function VoiceWaveform({ active }) {
  return (
    <div className="flex items-center gap-[3px] h-8">
      {[...Array(5)].map((_, i) => (
        <motion.div key={i}
          className={`w-1 rounded-full ${active ? 'bg-primary-400' : 'bg-slate-700'}`}
          animate={active ? {
            height: [8, 24, 12, 28, 8],
            transition: { duration: 0.8, repeat: Infinity, delay: i * 0.1 }
          } : { height: 8 }}
        />
      ))}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function CandidateInterviewPage() {
  const [searchParams] = useSearchParams()
  const jobIdFromUrl = searchParams.get('jobId')

  // State
  const [phase, setPhase] = useState('lobby') // lobby | loading | interview | completed | already-done
  const [sessionId, setSessionId] = useState(null)
  const [jobTitle, setJobTitle] = useState('')
  const [questions, setQuestions] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answer, setAnswer] = useState('')
  const [timer, setTimer] = useState(QUESTION_TIME)
  const [timerActive, setTimerActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [useTextMode, setUseTextMode] = useState(!isSpeechRecognitionSupported)
  const [error, setError] = useState('')
  const [jobs, setJobs] = useState([])
  const [selectedJobId, setSelectedJobId] = useState(jobIdFromUrl || '')
  const [interviewStatuses, setInterviewStatuses] = useState({})

  const recognitionRef = useRef(null)
  const timerRef = useRef(null)

  // ── Load candidate's applied jobs ────────────────────────────────────────
  useEffect(() => {
    const loadJobs = async () => {
      try {
        const { data } = await api.get('/applications/mine', { params: { limit: 50 } })
        const jobList = (data.applications || [])
          .filter(a => a.job)
          .map(a => ({ _id: a.job._id, title: a.job.title, company: a.job.company }))
        setJobs(jobList)

        // Check interview status for each job
        const statuses = {}
        await Promise.allSettled(
          jobList.map(async j => {
            try {
              const { data: s } = await api.get(`/interview/candidate/status/${j._id}`)
              statuses[j._id] = s
            } catch { /* ignore */ }
          })
        )
        setInterviewStatuses(statuses)
      } catch { /* graceful */ }
    }
    loadJobs()
  }, [])

  // ── Timer logic ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerActive) return
    if (timer <= 0) {
      handleSubmitAnswer(true)
      return
    }
    timerRef.current = setTimeout(() => setTimer(t => t - 1), 1000)
    return () => clearTimeout(timerRef.current)
  }, [timer, timerActive])

  // ── Speech Recognition setup ─────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!isSpeechRecognitionSupported || useTextMode) return

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event) => {
        let transcript = ''
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        setAnswer(transcript)
      }

      recognition.onerror = (event) => {
        console.warn('[STT] Error:', event.error)
        if (event.error === 'not-allowed' || event.error === 'audio-capture') {
          setUseTextMode(true)
          toast('Microphone not available. Switched to text mode.', { icon: '⌨️' })
        }
        setIsListening(false)
      }

      recognition.onend = () => setIsListening(false)

      recognition.start()
      recognitionRef.current = recognition
      setIsListening(true)
    } catch {
      setUseTextMode(true)
      toast('Voice input unavailable. Using text mode.', { icon: '⌨️' })
    }
  }, [useTextMode])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* ignore */ }
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  // ── TTS: Speak question ──────────────────────────────────────────────────
  const speakQuestion = useCallback((text) => {
    if (!isTTSSupported) {
      // No TTS — start timer immediately
      setTimerActive(true)
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1.0

    setIsSpeaking(true)

    utterance.onend = () => {
      setIsSpeaking(false)
      // CRITICAL: Start timer AFTER speech ends
      setTimer(QUESTION_TIME)
      setTimerActive(true)
      // Auto-start listening
      if (!useTextMode) startListening()
    }

    utterance.onerror = () => {
      setIsSpeaking(false)
      setTimer(QUESTION_TIME)
      setTimerActive(true)
      if (!useTextMode) startListening()
    }

    window.speechSynthesis.speak(utterance)
  }, [useTextMode, startListening])

  // ── Start Interview ──────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!selectedJobId) return toast.error('Please select a job')
    setPhase('loading')
    setError('')

    try {
      const { data } = await api.post('/interview/candidate/start', { jobId: selectedJobId })
      const sess = data.session

      if (sess.resumed) {
        toast('Resuming your interview…', { icon: '▶️' })
      }

      setSessionId(sess._id)
      setJobTitle(sess.jobTitle)
      setQuestions(sess.questions)
      setCurrentIdx(sess.currentIndex || 0)
      setPhase('interview')

      // Speak first question after a short delay
      setTimeout(() => speakQuestion(sess.questions[sess.currentIndex || 0]), 600)
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to start interview'
      if (msg.includes('already completed')) {
        setPhase('already-done')
      } else {
        setError(msg)
        setPhase('lobby')
        toast.error(msg)
      }
    }
  }

  // ── Submit Answer ────────────────────────────────────────────────────────
  const handleSubmitAnswer = async (autoSubmit = false) => {
    if (submitting) return
    setSubmitting(true)
    setTimerActive(false)
    stopListening()
    if (isTTSSupported) window.speechSynthesis.cancel()

    const answerText = answer.trim()

    // Submit to backend (retry once on failure)
    let retries = 1
    while (retries >= 0) {
      try {
        await api.post('/interview/candidate/answer', {
          sessionId,
          questionIndex: currentIdx,
          answerText,
        })
        break
      } catch (err) {
        if (retries > 0) {
          retries--
          await new Promise(r => setTimeout(r, 1000))
        } else {
          console.error('[Interview] Answer submission failed:', err)
          toast.error('Failed to save answer. Moving to next question.')
          break
        }
      }
    }

    // Move to next question or complete
    const nextIdx = currentIdx + 1
    setAnswer('')
    setSubmitting(false)

    if (nextIdx >= questions.length) {
      // Complete interview
      try {
        await api.post('/interview/candidate/complete', { sessionId })
      } catch (err) {
        console.error('[Interview] Complete failed:', err)
      }
      setPhase('completed')
    } else {
      setCurrentIdx(nextIdx)
      setTimer(QUESTION_TIME)
      setTimerActive(false)
      setTimeout(() => speakQuestion(questions[nextIdx]), 500)
    }
  }

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopListening()
      clearTimeout(timerRef.current)
      if (isTTSSupported) window.speechSynthesis.cancel()
    }
  }, [stopListening])

  // ── RENDER ───────────────────────────────────────────────────────────────

  // === LOBBY ===
  if (phase === 'lobby') {
    return (
      <div className="min-h-[calc(100vh-112px)] flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg">
          <div className="card-glow">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 border border-primary-500/30 flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-primary-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">AI Interview</h1>
                <p className="text-slate-400 text-sm">Voice-powered technical interview</p>
              </div>
            </div>

            {/* Job selector */}
            <div className="mb-5">
              <label className="block text-sm text-slate-300 mb-2">Select Job Position</label>
              <select className="input appearance-none cursor-pointer"
                value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}>
                <option value="">Choose a job you applied for…</option>
                {jobs.map(j => {
                  const status = interviewStatuses[j._id]
                  const done = status?.completed
                  return (
                    <option key={j._id} value={j._id} disabled={done}>
                      {j.title} — {j.company} {done ? '(Completed ✓)' : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Instructions */}
            <div className="bg-surface-700/50 rounded-xl p-4 mb-5 space-y-2">
              <p className="text-slate-300 text-sm font-medium">📋 How it works:</p>
              <ul className="text-slate-400 text-xs space-y-1.5 ml-1">
                <li>• AI will ask <strong className="text-white">5 questions</strong> based on your resume</li>
                <li>• Each question has a <strong className="text-white">{QUESTION_TIME}-second</strong> timer</li>
                <li>• You can speak or type your answers</li>
                <li>• Timer starts <strong className="text-white">after</strong> the AI finishes reading the question</li>
                <li>• You can only take the interview <strong className="text-white">once</strong> per job</li>
              </ul>
            </div>

            {/* Browser support notice */}
            {!isSpeechRecognitionSupported && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-5">
                <AlertCircle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-amber-300 text-xs">
                  Voice input not supported on this browser. You'll type your answers instead.
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-5">
                <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-red-300 text-xs">{error}</p>
              </div>
            )}

            <button id="start-ai-interview-btn" onClick={handleStart}
              disabled={!selectedJobId}
              className="btn-primary w-full justify-center text-base py-3 disabled:opacity-40">
              <Mic size={18} /> Start Interview
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // === LOADING ===
  if (phase === 'loading') {
    return (
      <div className="min-h-[calc(100vh-112px)] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary-500/15 border border-primary-500/20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
        </div>
        <p className="text-white font-semibold">Preparing your interview…</p>
        <p className="text-slate-500 text-sm">Generating resume-based questions</p>
      </div>
    )
  }

  // === ALREADY DONE ===
  if (phase === 'already-done') {
    return (
      <div className="min-h-[calc(100vh-112px)] flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="card-glow max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Interview Already Completed</h2>
          <p className="text-slate-400 text-sm">
            You've already taken the AI interview for this position.
            Your responses have been submitted for review.
          </p>
        </motion.div>
      </div>
    )
  }

  // === COMPLETED ===
  if (phase === 'completed') {
    return (
      <div className="min-h-[calc(100vh-112px)] flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
          className="card-glow max-w-md text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}>
            <CheckCircle className="w-20 h-20 text-emerald-400 mx-auto mb-5" />
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-2">Interview Completed!</h2>
          <p className="text-slate-400 text-sm mb-6">
            Thank you for your time. Your responses have been recorded and will be reviewed by the hiring team.
          </p>
          <div className="bg-surface-700/50 rounded-xl p-4 text-left">
            <p className="text-slate-300 text-xs font-medium mb-2">📝 What happens next?</p>
            <ul className="text-slate-500 text-xs space-y-1">
              <li>• Your answers are being evaluated by AI</li>
              <li>• The recruiter will review your combined scores</li>
              <li>• You'll be notified about next steps</li>
            </ul>
          </div>
        </motion.div>
      </div>
    )
  }

  // === INTERVIEW IN PROGRESS ===
  const currentQuestion = questions[currentIdx] || ''

  return (
    <div className="min-h-[calc(100vh-112px)] flex flex-col p-4 md:p-6 gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">{jobTitle}</h2>
          <p className="text-slate-500 text-xs">AI Interview in Progress</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge-primary badge">
            Question {currentIdx + 1} of {questions.length}
          </span>
          {useTextMode && (
            <span className="badge bg-amber-500/15 text-amber-300 border border-amber-500/25 badge">
              <Keyboard size={11} /> Text Mode
            </span>
          )}
        </div>
      </div>

      {/* Main interview area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
        {/* Left: Question + Controls */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Question card */}
          <AnimatePresence mode="wait">
            <motion.div key={currentIdx}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="card-glow flex-shrink-0">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={18} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                    Alex (AI Interviewer) {isSpeaking && '— Speaking…'}
                  </p>
                  <p className="text-white text-sm leading-relaxed">{currentQuestion}</p>
                </div>
                {isSpeaking && (
                  <Volume2 size={18} className="text-primary-400 animate-pulse flex-shrink-0 mt-1" />
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Answer area */}
          <div className="card flex-1 flex flex-col gap-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 font-medium">Your Answer</p>
              {!useTextMode && isSpeechRecognitionSupported && (
                <button onClick={() => setUseTextMode(true)}
                  className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                  <Keyboard size={10} /> Switch to text
                </button>
              )}
              {useTextMode && isSpeechRecognitionSupported && (
                <button onClick={() => setUseTextMode(false)}
                  className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                  <Mic size={10} /> Switch to voice
                </button>
              )}
            </div>

            {/* Voice mode */}
            {!useTextMode ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <VoiceWaveform active={isListening} />
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isSpeaking || submitting}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300
                    ${isListening
                      ? 'bg-red-500 shadow-lg shadow-red-500/30 hover:bg-red-600 ring-4 ring-red-500/20'
                      : 'bg-primary-600 shadow-lg shadow-primary-500/30 hover:bg-primary-500'}
                    disabled:opacity-40`}>
                  {isListening ? <MicOff size={24} className="text-white" /> : <Mic size={24} className="text-white" />}
                </button>
                <p className="text-slate-500 text-xs">
                  {isListening ? 'Listening… speak your answer' : isSpeaking ? 'AI is speaking…' : 'Tap to start speaking'}
                </p>
                {/* Live transcript */}
                {answer && (
                  <div className="w-full bg-surface-700/50 rounded-xl p-3 max-h-32 overflow-y-auto">
                    <p className="text-xs text-slate-500 mb-1">Transcript:</p>
                    <p className="text-slate-200 text-sm leading-relaxed">{answer}</p>
                  </div>
                )}
              </div>
            ) : (
              /* Text mode */
              <textarea
                className="flex-1 w-full bg-surface-700 border border-white/10 rounded-xl p-4
                  text-slate-100 placeholder-slate-500 text-sm resize-none
                  focus:outline-none focus:border-primary-500/60 focus:ring-1 focus:ring-primary-500/30"
                placeholder="Type your answer here…"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                disabled={isSpeaking || submitting}
              />
            )}

            {/* Submit button */}
            <button id="submit-answer-btn"
              onClick={() => handleSubmitAnswer(false)}
              disabled={submitting || isSpeaking}
              className="btn-primary w-full justify-center disabled:opacity-40">
              {submitting ? (
                <><Loader2 size={15} className="animate-spin" /> Submitting…</>
              ) : currentIdx + 1 >= questions.length ? (
                <><CheckCircle size={15} /> Submit & Finish</>
              ) : (
                <><ArrowRight size={15} /> Submit & Next Question</>
              )}
            </button>
          </div>
        </div>

        {/* Right: Timer panel */}
        <div className="lg:w-56 flex lg:flex-col items-center gap-4 flex-shrink-0">
          <div className="card flex flex-col items-center gap-3 w-full">
            <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Clock size={12} /> Time Remaining
            </p>
            <CircularTimer seconds={timer} total={QUESTION_TIME} />
            {isSpeaking && (
              <p className="text-[10px] text-primary-400 text-center animate-pulse">
                Timer starts after AI finishes speaking
              </p>
            )}
            {!timerActive && !isSpeaking && timer === QUESTION_TIME && (
              <p className="text-[10px] text-slate-600 text-center">Waiting to begin…</p>
            )}
          </div>

          {/* Progress */}
          <div className="card w-full">
            <p className="text-xs text-slate-400 font-medium mb-3">Progress</p>
            <div className="flex gap-1.5">
              {questions.map((_, i) => (
                <div key={i} className={`h-2 flex-1 rounded-full transition-colors duration-300
                  ${i < currentIdx ? 'bg-emerald-500' : i === currentIdx ? 'bg-primary-500' : 'bg-surface-600'}`} />
              ))}
            </div>
            <p className="text-[10px] text-slate-600 mt-2 text-center">
              {currentIdx} of {questions.length} answered
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
