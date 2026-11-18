import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Mic, MicOff, Loader2, Volume2, CheckCircle2, ArrowRight,
  AlertCircle, Keyboard, Clock,
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Section, Field } from '../../components/ui'

const QUESTION_TIME = 30

const isSpeechRecognitionSupported =
  typeof window !== 'undefined' &&
  ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

const isTTSSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window

/* ── Timer ──────────────────────────────────────────────────────────────── */

function CircularTimer({ seconds, total }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const progress = (seconds / total) * circumference
  const isLow = seconds <= 5

  return (
    <div className="relative w-[116px] h-[116px]">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e9e5dd" strokeWidth="5" />
        <circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={isLow ? '#a33232' : '#1d4b6e'}
          strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`num text-[26px] leading-7 ${isLow ? 'text-danger-600' : 'text-ink-900'}`}>
          {seconds}
        </span>
        <span className="text-[10.5px] text-ink-500">seconds</span>
      </div>
    </div>
  )
}

function VoiceWaveform({ active }) {
  return (
    <div className="flex items-end gap-[3px] h-6" aria-hidden="true">
      {[10, 18, 24, 16, 10].map((h, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full transition-colors ${active ? 'bg-accent-600' : 'bg-ink-200'}`}
          style={{ height: active ? h : 6 }}
        />
      ))}
    </div>
  )
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function CandidateInterviewPage() {
  const [searchParams] = useSearchParams()
  const jobIdFromUrl = searchParams.get('jobId')

  const [phase, setPhase] = useState('lobby')
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
  const [completionNote, setCompletionNote] = useState('')

  const recognitionRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const { data } = await api.get('/applications/mine', { params: { limit: 50 } })
        const jobList = (data.applications || [])
          .filter(a => a.job)
          .map(a => ({ _id: a.job._id, title: a.job.title, company: a.job.company }))
        setJobs(jobList)

        const statuses = {}
        await Promise.allSettled(
          jobList.map(async j => {
            try {
              const { data: s } = await api.get(`/interview/candidate/status/${j._id}`)
              statuses[j._id] = s
            } catch { /* no session */ }
          })
        )
        setInterviewStatuses(statuses)
      } catch { /* lobby still renders */ }
    }
    loadJobs()
  }, [])

  useEffect(() => {
    if (!timerActive) return
    if (timer <= 0) {
      handleSubmitAnswer(true)
      return
    }
    timerRef.current = setTimeout(() => setTimer(t => t - 1), 1000)
    return () => clearTimeout(timerRef.current)
  }, [timer, timerActive])

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
        if (event.error === 'not-allowed' || event.error === 'audio-capture') {
          setUseTextMode(true)
          toast('Microphone unavailable. Switched to typing.')
        }
        setIsListening(false)
      }

      recognition.onend = () => setIsListening(false)

      recognition.start()
      recognitionRef.current = recognition
      setIsListening(true)
    } catch {
      setUseTextMode(true)
      toast('Voice input unavailable. Using the text field.')
    }
  }, [useTextMode])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* ignored */ }
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  const speakQuestion = useCallback((text) => {
    if (!isTTSSupported) {
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
      setTimer(QUESTION_TIME)
      setTimerActive(true)
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

  const handleStart = async () => {
    if (!selectedJobId) return toast.error('Select the job this interview is for')
    setPhase('loading')
    setError('')

    try {
      const { data } = await api.post('/interview/candidate/start', { jobId: selectedJobId })
      const sess = data.session

      if (sess.resumed) toast('Resuming your interview')

      setSessionId(sess._id)
      setJobTitle(sess.jobTitle)
      setQuestions(sess.questions)
      setCurrentIdx(sess.currentIndex || 0)
      setPhase('interview')

      setTimeout(() => speakQuestion(sess.questions[sess.currentIndex || 0]), 600)
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not start the interview'
      if (msg.includes('already completed')) {
        setPhase('already-done')
      } else {
        setError(msg)
        setPhase('lobby')
        toast.error(msg)
      }
    }
  }

  const handleSubmitAnswer = async () => {
    if (submitting) return
    setSubmitting(true)
    setTimerActive(false)
    stopListening()
    if (isTTSSupported) window.speechSynthesis.cancel()

    const answerText = answer.trim()

    let retries = 1
    while (retries >= 0) {
      try {
        const { data } = await api.post('/interview/candidate/answer', {
          sessionId,
          questionIndex: currentIdx,
          answerText,
        })
        // The answer is saved either way; only the AI evaluation may be missing.
        if (data?.evaluationUnavailable) {
          toast('Answer saved, but the AI evaluator was unavailable for it.')
        }
        break
      } catch (err) {
        if (retries > 0) {
          retries--
          await new Promise(r => setTimeout(r, 1000))
        } else {
          toast.error('Could not save that answer. Moving on.')
          break
        }
      }
    }

    const nextIdx = currentIdx + 1
    setAnswer('')
    setSubmitting(false)

    if (nextIdx >= questions.length) {
      // Finalise on the server before claiming success. A silently swallowed
      // failure here is what leaves the recruiter workspace showing the
      // candidate as "not interviewed".
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { data } = await api.post('/interview/candidate/complete', { sessionId })
          if (data?.evaluationStatus === 'unavailable') {
            setCompletionNote(
              'Your answers were saved, but the AI evaluator was unavailable, so this interview has no score yet.'
            )
          }
          setPhase('completed')
          return
        } catch (err) {
          const msg = err.response?.data?.message || ''
          if (msg.toLowerCase().includes('already completed')) {
            setPhase('completed')
            return
          }
          if (attempt === 1) {
            toast.error(msg || 'Your interview could not be finalised. Please submit again.')
            setTimerActive(false)
            return
          }
          await new Promise(r => setTimeout(r, 1200))
        }
      }
      return
    }

    setCurrentIdx(nextIdx)
    setTimer(QUESTION_TIME)
    setTimerActive(false)
    setTimeout(() => speakQuestion(questions[nextIdx]), 500)
  }

  useEffect(() => {
    return () => {
      stopListening()
      clearTimeout(timerRef.current)
      if (isTTSSupported) window.speechSynthesis.cancel()
    }
  }, [stopListening])

  /* ── Lobby ────────────────────────────────────────────────────────────── */
  if (phase === 'lobby') {
    return (
      <div className="max-w-xl mx-auto animate-fade-in">
        <div className="pb-5">
          <h1 className="text-[19px] font-semibold text-ink-900">AI interview</h1>
          <p className="text-[13.5px] text-ink-500 mt-0.5">
            Five questions generated from your resume for the role you applied to.
          </p>
        </div>

        <Section title="Before you start">
          <Field label="Job you applied for" required>
            <select
              className="input"
              value={selectedJobId}
              onChange={e => setSelectedJobId(e.target.value)}
            >
              <option value="">Select a role</option>
              {jobs.map(j => {
                const done = interviewStatuses[j._id]?.completed
                return (
                  <option key={j._id} value={j._id} disabled={done}>
                    {j.title} — {j.company}{done ? ' (completed)' : ''}
                  </option>
                )
              })}
            </select>
          </Field>

          <ul className="mt-5 space-y-2 text-[13px] text-ink-600">
            <li className="flex gap-2.5">
              <span className="num text-[11.5px] text-ink-400 mt-0.5">01</span>
              Five questions based on your resume and the role
            </li>
            <li className="flex gap-2.5">
              <span className="num text-[11.5px] text-ink-400 mt-0.5">02</span>
              {QUESTION_TIME} seconds per answer, starting after the question is read
            </li>
            <li className="flex gap-2.5">
              <span className="num text-[11.5px] text-ink-400 mt-0.5">03</span>
              Answer by voice or type, whichever you prefer
            </li>
            <li className="flex gap-2.5">
              <span className="num text-[11.5px] text-ink-400 mt-0.5">04</span>
              One interview per job; it cannot be retaken
            </li>
          </ul>

          {!isSpeechRecognitionSupported && (
            <p className="mt-4 text-[12.5px] text-warn-700 bg-warn-50 border border-warn-100 rounded-lg px-3 py-2">
              This browser does not support voice input. You will type your answers.
            </p>
          )}

          {error && (
            <p className="mt-4 text-[12.5px] text-danger-700 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            id="start-ai-interview-btn"
            onClick={handleStart}
            disabled={!selectedJobId}
            className="btn-primary w-full mt-5"
          >
            <Mic size={15} strokeWidth={1.8} />
            Start interview
          </button>
        </Section>
      </div>
    )
  }

  /* ── Loading ──────────────────────────────────────────────────────────── */
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <Loader2 size={20} className="animate-spin text-ink-400" />
        <p className="text-[13.5px] text-ink-800">Preparing your interview</p>
        <p className="text-[12.5px] text-ink-500">Generating questions from your resume</p>
      </div>
    )
  }

  /* ── Already done ─────────────────────────────────────────────────────── */
  if (phase === 'already-done') {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <CheckCircle2 size={22} className="text-positive-600 mx-auto" strokeWidth={1.6} />
        <h1 className="text-[17px] font-semibold text-ink-900 mt-3">Interview already completed</h1>
        <p className="text-[13px] text-ink-500 mt-1.5">
          You have taken the AI interview for this role. Your answers are with the hiring team.
        </p>
        <a href="/my-applications" className="btn-secondary mt-5">Back to applications</a>
      </div>
    )
  }

  /* ── Completed ────────────────────────────────────────────────────────── */
  if (phase === 'completed') {
    return (
      <div className="max-w-md mx-auto py-16 text-center animate-fade-in">
        <CheckCircle2 size={22} className="text-positive-600 mx-auto" strokeWidth={1.6} />
        <h1 className="text-[17px] font-semibold text-ink-900 mt-3">Interview submitted</h1>
        <p className="text-[13px] text-ink-500 mt-1.5 leading-6">
          {completionNote ||
            'Your answers are being evaluated. Your combined score appears to the recruiter alongside your resume and coding results.'}
        </p>
        {completionNote && (
          <p className="text-[12.5px] text-warn-700 bg-warn-50 border border-warn-100 rounded-lg px-3 py-2 mt-4 text-left">
            The recruiter will see this interview as completed but not evaluated. Nothing was
            fabricated in place of a real score.
          </p>
        )}
        <a href="/my-applications" className="btn-primary mt-5">Back to applications</a>
      </div>
    )
  }

  /* ── In progress ──────────────────────────────────────────────────────── */
  const currentQuestion = questions[currentIdx] || ''

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[16px] font-semibold text-ink-900">{jobTitle}</h1>
          <p className="text-[12.5px] text-ink-500">AI interview in progress</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="num text-[12px] text-ink-500">
            {currentIdx + 1} / {questions.length}
          </span>
          {useTextMode && <span className="pill-neutral">Text mode</span>}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_240px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <div className="card p-5">
            <div className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-md bg-ink-100 text-ink-600 flex items-center justify-center flex-shrink-0 text-[11px] font-medium">
                AI
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] text-ink-500">
                  Interviewer{isSpeaking ? ' · speaking' : ''}
                </p>
                <p className="text-[14px] text-ink-900 leading-6 mt-1">{currentQuestion}</p>
              </div>
              {isSpeaking && (
                <Volume2 size={15} className="text-ink-400 flex-shrink-0 mt-1" strokeWidth={1.7} />
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12.5px] font-medium text-ink-900">Your answer</p>
              {isSpeechRecognitionSupported && (
                <button
                  onClick={() => setUseTextMode(v => !v)}
                  className="text-[11.5px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
                >
                  <Keyboard size={11} />
                  {useTextMode ? 'Use voice' : 'Type instead'}
                </button>
              )}
            </div>

            {!useTextMode ? (
              <div className="flex flex-col items-center justify-center gap-3 py-6">
                <VoiceWaveform active={isListening} />
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isSpeaking || submitting}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 ${
                    isListening
                      ? 'bg-danger-600 hover:bg-danger-700 text-white'
                      : 'bg-ink-900 hover:bg-ink-800 text-white'
                  }`}
                  aria-label={isListening ? 'Stop recording' : 'Start recording'}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <p className="text-[12.5px] text-ink-500">
                  {isListening
                    ? 'Listening. Speak your answer.'
                    : isSpeaking ? 'The question is being read aloud.' : 'Tap to record'}
                </p>
                {answer && (
                  <div className="w-full surface-inset px-3 py-2.5 max-h-32 overflow-y-auto">
                    <p className="text-[10.5px] text-ink-500 mb-1">Transcript</p>
                    <p className="text-[12.5px] text-ink-800 leading-5">{answer}</p>
                  </div>
                )}
              </div>
            ) : (
              <textarea
                className="input min-h-[180px]"
                placeholder="Type your answer"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                disabled={isSpeaking || submitting}
              />
            )}

            <button
              id="submit-answer-btn"
              onClick={handleSubmitAnswer}
              disabled={submitting || isSpeaking}
              className="btn-primary w-full mt-4"
            >
              {submitting
                ? <><Loader2 size={14} className="animate-spin" /> Saving</>
                : currentIdx + 1 >= questions.length
                  ? <><CheckCircle2 size={14} /> Submit and finish</>
                  : <><ArrowRight size={14} /> Submit and continue</>}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5 flex flex-col items-center gap-3">
            <p className="text-[11.5px] text-ink-500 flex items-center gap-1.5">
              <Clock size={11} strokeWidth={1.8} /> Time remaining
            </p>
            <CircularTimer seconds={timer} total={QUESTION_TIME} />
            <p className="text-[11px] text-ink-400 text-center leading-4">
              {isSpeaking
                ? 'The timer starts when the question finishes'
                : !timerActive && timer === QUESTION_TIME
                  ? 'Waiting to begin'
                  : 'Answering'}
            </p>
          </div>

          <div className="card p-4">
            <p className="text-[11.5px] text-ink-500 mb-2.5">Progress</p>
            <div className="flex gap-1">
              {questions.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i < currentIdx ? 'bg-ink-800'
                    : i === currentIdx ? 'bg-accent-600'
                    : 'bg-ink-100'
                  }`}
                />
              ))}
            </div>
            <p className="num text-[11px] text-ink-500 mt-2">
              {currentIdx} answered · {questions.length - currentIdx} left
            </p>
          </div>
        </div>
      </div>

      {timer <= 5 && timerActive && (
        <p className="text-[12px] text-danger-700 flex items-center gap-1.5">
          <AlertCircle size={12} /> Your answer will be submitted automatically when the timer ends.
        </p>
      )}
    </div>
  )
}
