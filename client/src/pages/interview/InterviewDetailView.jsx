import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, User, Mail, Briefcase, Clock, Calendar,
  CheckCircle2, AlertCircle, Inbox, Star, Award, MessageSquare,
  ChevronDown, ChevronUp, FileText, ScrollText,   ExternalLink,
  Building2, MapPin, GraduationCap, Github, Linkedin,
  ChevronRight, X,
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Section, StatusPill, ScoreBar, LoadingBlock, EmptyState } from '../../components/ui'

/* ── Helpers ────────────────────────────────────────────────────────────────── */

const STATUS_CONFIG = {
  pending:   { label: 'Not Started',  icon: Inbox,         tone: 'neutral'  },
  active:    { label: 'In Progress',  icon: AlertCircle,    tone: 'accent'   },
  completed: { label: 'Completed',    icon: CheckCircle2,   tone: 'positive' },
  abandoned: { label: 'Abandoned',    icon: AlertCircle,    tone: 'danger'   },
}

function formatDateTime(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDateShort(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDuration(min) {
  if (min === undefined || min === null) return '—'
  if (min < 1) return '< 1 minute'
  if (min === 1) return '1 minute'
  return `${min} minutes`
}

function InterviewStatusHeader({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status || 'Unknown', icon: Inbox, tone: 'neutral' }
  const Icon = cfg.icon
  return (
    <span className={`pill-${cfg.tone} capitalize flex items-center gap-1.5`}>
      <Icon size={13} strokeWidth={1.8} />
      {cfg.label}
    </span>
  )
}

function ProfileChip({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-1.5 text-sm text-ink-600">
      <Icon size={12} className="text-ink-400" strokeWidth={1.7} />
      <span className="text-ink-500">{label}:</span>
      <span className="text-ink-800 font-medium">{value}</span>
    </div>
  )
}

/* ── Question Card (Accordion) ─────────────────────────────────────────────── */

function QuestionCard({ question, answer, index, total, score, feedback, evaluated }) {
  const [open, setOpen] = useState(index < 3) // Open first 3 by default

  return (
    <div className="border border-line rounded-xl overflow-hidden bg-paper">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-ink-50 transition-colors"
        aria-expanded={open}
      >
        <span className="num text-xs text-ink-400 w-6 flex-shrink-0">
          Q{index + 1}
        </span>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-ink-900 line-clamp-2">
            {question || 'Question not available'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {score !== null && score !== undefined && evaluated !== false && (
            <span className="flex items-center gap-1 num text-sm font-semibold tabular-nums">
              <Award size={13} className={`${score >= 70 ? 'text-positive-600' : score >= 40 ? 'text-warn-600' : 'text-danger-600'}`} />
              {score}
            </span>
          )}
          {evaluated === false && (
            <span className="pill-warn text-xs">Not Evaluated</span>
          )}
          {index >= total - 1 && score === null && evaluated !== false && (
            <span className="text-ink-400 text-xs">Pending</span>
          )}
          {open ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-line px-5 py-4 space-y-4 bg-ink-50/30">
          {/* Candidate Answer */}
          <div>
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <MessageSquare size={12} />
              Candidate Answer
            </p>
            <div className="card-pad bg-white text-sm text-ink-800 leading-relaxed">
              {answer || <span className="text-ink-400 italic">No answer provided</span>}
            </div>
          </div>

          {/* AI Evaluation */}
          {(feedback || (score !== null && score !== undefined)) && (
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Star size={12} className="text-accent-600" />
                AI Evaluation
              </p>
              {score !== null && score !== undefined && evaluated !== false && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-ink-500">Score</span>
                    <span className="num text-sm font-semibold tabular-nums">
                      {Math.max(0, Math.min(100, Number(score) || 0))}/100
                    </span>
                  </div>
                  <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        score >= 70 ? 'bg-positive-500' : score >= 40 ? 'bg-warn-500' : 'bg-danger-500'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, Number(score) || 0))}%` }}
                    />
                  </div>
                </div>
              )}
              {feedback && (
                <p className="text-sm text-ink-700 leading-relaxed">{feedback}</p>
              )}
            </div>
          )}

          {/* Not evaluated notice */}
          {evaluated === false && (
            <div className="flex items-start gap-2 text-sm text-warn-700 bg-warn-50 border border-warn-100 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>The AI evaluator was unavailable when this answer was submitted. The answer has been saved but was not scored.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Transcript Item ────────────────────────────────────────────────────────── */

function TranscriptItem({ item, index }) {
  const isQuestion = item.type === 'question'
  const isSkipped = item.type === 'skipped'

  return (
    <div className={`flex gap-3 ${isQuestion ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
        isQuestion
          ? 'bg-accent-600 text-white'
          : isSkipped
            ? 'bg-ink-200 text-ink-500'
            : 'bg-primary-600 text-white'
      }`}>
        {isQuestion ? 'AI' : 'C'}
      </div>

      {/* Content */}
      <div className={`flex flex-col ${isQuestion ? 'items-end' : 'items-start'} max-w-[75%]`}>
        <p className="text-xs text-ink-500 mb-0.5">
          {isQuestion ? 'AI Interviewer' : isSkipped ? 'Candidate (no answer)' : 'Candidate'}
          {item.timestamp && ` · ${formatDateTime(item.timestamp)}`}
        </p>
        <div className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
          isQuestion
            ? 'bg-accent-50 text-ink-800 rounded-tr-sm'
            : isSkipped
              ? 'bg-ink-100 text-ink-500 italic rounded-tl-sm'
              : 'bg-primary-50 text-ink-800 rounded-tl-sm'
        }`}>
          {item.content}
        </div>
        {item.score !== null && item.score !== undefined && !isSkipped && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-ink-500">Score:</span>
            <span className={`num text-xs font-semibold ${
              item.score >= 70 ? 'text-positive-600' : item.score >= 40 ? 'text-warn-600' : 'text-danger-600'
            }`}>
              {Math.max(0, Math.min(100, Number(item.score) || 0))}/100
            </span>
          </div>
        )}
        {item.feedback && !isSkipped && (
          <p className="text-xs text-ink-500 mt-0.5 italic">{item.feedback}</p>
        )}
      </div>
    </div>
  )
}

/* ── Main Component ─────────────────────────────────────────────────────────── */

export default function InterviewDetailView() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [transcript, setTranscript] = useState(null)
  const [transcriptLoading, setTranscriptLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('questions') // questions | evaluation | transcript

  const fetchSession = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/interview/recruiter/interviews/${sessionId}`)
      setSession(data.session)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load interview details')
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  const fetchTranscript = useCallback(async () => {
    setTranscriptLoading(true)
    try {
      const { data } = await api.get(`/interview/recruiter/interviews/${sessionId}/transcript`)
      setTranscript(data)
    } catch {
      setTranscript(null)
    } finally {
      setTranscriptLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (sessionId) {
      fetchSession()
    }
  }, [sessionId, fetchSession])

  useEffect(() => {
    if (session && (session.messages || session.answers)) {
      fetchTranscript()
    }
  }, [session, fetchTranscript])

  const answeredCount = session?.answers
    ? session.answers.filter(a => (a.answerText || '').trim().length > 0).length
    : session?.questionCount || 0

  const totalQuestions = session?.answers?.length || session?.questionCount || 0

  const completionPct = totalQuestions > 0
    ? Math.round((answeredCount / totalQuestions) * 100)
    : 0

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/interviews')} className="btn-ghost btn-sm text-ink-500">
            <ArrowLeft size={14} />
            Back to Interviews
          </button>
        </div>
        <LoadingBlock label="Loading interview details…" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/interviews')} className="btn-ghost btn-sm text-ink-500">
            <ArrowLeft size={14} />
            Back to Interviews
          </button>
        </div>
        <EmptyState
          icon={AlertCircle}
          title="Interview not found"
          description="This interview session could not be found or you do not have permission to view it."
          action={
            <button onClick={() => navigate('/interviews')} className="btn-primary btn-sm">
              Return to Interview List
            </button>
          }
        />
      </div>
    )
  }

  const candidate = session.candidate
  const job = session.job
  const overallScore = session.scores?.overall ?? session.finalScore ?? null
  const evaluationStatus = session.evaluationStatus || 'pending'

  return (
    <div className="flex flex-col gap-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/interviews')} className="btn-ghost btn-sm text-ink-500 flex-shrink-0">
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[17px] font-semibold text-ink-900 truncate">
                Interview Details
              </h1>
              <InterviewStatusHeader status={session.status} />
              {session.initiatedBy && (
                <span className="text-xs text-ink-400 capitalize bg-ink-100 px-2 py-0.5 rounded">
                  {session.initiatedBy}-initiated
                </span>
              )}
            </div>
            <p className="text-sm text-ink-500 mt-0.5 truncate">
              {job?.title || session.jobTitle || 'Role'} · {candidate?.name || 'Candidate'}
            </p>
          </div>
        </div>
      </div>

      {/* Candidate Info Card */}
      <Section title="Candidate Information" className="!">
        <div className="flex flex-wrap items-start gap-6">
          {/* Profile card */}
          <div className="card-pad flex items-center gap-4 min-w-[220px]">
            <div className="w-14 h-14 rounded-full bg-ink-100 text-ink-700 flex items-center justify-center text-lg font-semibold flex-shrink-0 overflow-hidden">
              {candidate?.avatar ? (
                <img src={candidate.avatar} alt={candidate.name} className="w-full h-full object-cover" />
              ) : (
                candidate?.name?.[0]?.toUpperCase() || '?'
              )}
            </div>
            <div>
              <p className="text-base font-semibold text-ink-900">{candidate?.name || 'Unknown Candidate'}</p>
              {candidate?.email && (
                <a
                  href={`mailto:${candidate.email}`}
                  className="flex items-center gap-1 text-sm text-accent-700 hover:text-accent-800 mt-0.5"
                >
                  <Mail size={12} />
                  {candidate.email}
                </a>
              )}
            </div>
          </div>

          {/* Info grid */}
          <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProfileChip icon={Briefcase} label="Applied for" value={job?.title || session.jobTitle || '—'} />
            {job?.company && (
              <ProfileChip icon={Building2} label="Company" value={job.company} />
            )}
            {candidate?.email && (
              <ProfileChip icon={Mail} label="Email" value={candidate.email} />
            )}
            {session.startedAt && (
              <ProfileChip icon={Clock} label="Started" value={formatDateTime(session.startedAt)} />
            )}
            {session.completedAt && (
              <ProfileChip icon={CheckCircle2} label="Completed" value={formatDateTime(session.completedAt)} />
            )}
            <ProfileChip icon={Clock} label="Duration" value={formatDuration(session.durationMin)} />
            {session.recruiter && (
              <ProfileChip icon={User} label="Recruiter" value="Assigned recruiter" />
            )}
          </div>
        </div>
      </Section>

      {/* Progress Card */}
      <Section title="Interview Progress" className="!">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="card-pad text-center">
            <p className="text-xs text-ink-500">Total Questions</p>
            <p className="num text-[22px] font-semibold text-ink-900 mt-1">{totalQuestions}</p>
          </div>
          <div className="card-pad text-center">
            <p className="text-xs text-ink-500">Answered</p>
            <p className="num text-[22px] font-semibold text-positive-600 mt-1">{answeredCount}</p>
          </div>
          <div className="card-pad text-center">
            <p className="text-xs text-ink-500">Remaining</p>
            <p className="num text-[22px] font-semibold text-ink-900 mt-1">
              {totalQuestions - answeredCount}
            </p>
          </div>
          <div className="card-pad text-center">
            <p className="text-xs text-ink-500">Completion</p>
            <p className="num text-[22px] font-semibold text-accent-600 mt-1">{completionPct}%</p>
          </div>
        </div>
        <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-600 rounded-full transition-all duration-700"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-ink-500">
          <span>{completionPct === 100 ? 'Interview complete' : `${totalQuestions - answeredCount} questions remaining`}</span>
          <span>{answeredCount} / {totalQuestions} answered</span>
        </div>
      </Section>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-line">
        {['questions', 'evaluation', 'transcript'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab px-4 capitalize ${
              activeTab === tab ? 'tab-active' : ''
            }`}
          >
            {tab === 'questions' && <MessageSquare size={13} className="mr-1" />}
            {tab === 'evaluation' && <Award size={13} className="mr-1" />}
            {tab === 'transcript' && <ScrollText size={13} className="mr-1" />}
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {/* ── Questions Tab ──────────────────────────────────────────────── */}
        {activeTab === 'questions' && (
          <Section
            title="Interview Questions & Answers"
            description="Review each question and the candidate's response, along with AI evaluation scores where available."
            padded={false}
            className="!"
          >
            {session.messages && session.messages.length > 0 ? (
              // Recruiter-initiated: display message pairs
              <div className="p-5 space-y-3">
                {session.messages
                  .filter(m => m.role === 'interviewer')
                  .map((qMsg, i) => {
                    const candidateMsg = session.messages[i * 2 + 1]
                    const qIndex = i
                    return (
                      <QuestionCard
                        key={qIndex}
                        question={qMsg.content}
                        answer={candidateMsg?.content || ''}
                        index={qIndex}
                        total={Math.ceil(session.messages.filter(m => m.role === 'interviewer').length)}
                        score={candidateMsg?.score}
                        feedback={candidateMsg?.feedback}
                        evaluated={candidateMsg ? candidateMsg.score !== undefined : true}
                      />
                    )
                  })}
              </div>
            ) : session.answers && session.answers.length > 0 ? (
              // Candidate-initiated: display answers array
              <div className="p-5 space-y-3">
                {session.answers.map((a, i) => (
                  <QuestionCard
                    key={i}
                    question={a.question}
                    answer={a.answerText}
                    index={i}
                    total={session.answers.length}
                    score={a.evaluated ? a.score : null}
                    feedback={a.feedback || null}
                    evaluated={a.evaluated}
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <EmptyState
                  icon={FileText}
                  title="No questions recorded"
                  description="This interview session does not have any questions recorded."
                />
              </div>
            )}
          </Section>
        )}

        {/* ── Evaluation Tab ──────────────────────────────────────────────── */}
        {activeTab === 'evaluation' && (
          <Section
            title="AI Interview Evaluation"
            description="AI-generated assessment of the candidate's performance across multiple dimensions."
            padded={false}
            className="!"
          >
            {evaluationStatus === 'pending' && !overallScore ? (
              <div className="p-8 text-center">
                <EmptyState
                  icon={Clock}
                  title="Evaluation Pending"
                  description="The AI evaluation has not been generated yet. This interview is still being processed or has not been completed."
                />
              </div>
            ) : evaluationStatus === 'unavailable' ? (
              <div className="p-8">
                <div className="card-pad bg-warn-50 border-warn-100">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-warn-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-warn-700">Evaluation Unavailable</p>
                      <p className="text-sm text-warn-700 mt-1">
                        The interview was completed, but the AI evaluator was unavailable. No scores or summary could be generated.
                        The candidate's answers have been saved and can still be reviewed manually in the Questions tab.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-5">
                {/* Overall Score */}
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Overall Score</p>
                  <div className="card-pad">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-ink-700">Interview Performance</span>
                      <span className={`num text-2xl font-bold ${
                        overallScore >= 70 ? 'text-positive-600' : overallScore >= 40 ? 'text-warn-600' : 'text-danger-600'
                      }`}>
                        {Math.max(0, Math.min(100, Number(overallScore) || 0))}/100
                      </span>
                    </div>
                    <ScoreBar value={overallScore} />
                  </div>
                </div>

                {/* Dimension Scores */}
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-3">Dimension Scores</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {session.scores?.technical && (
                      <div className="card-pad">
                        <p className="text-xs text-ink-500 mb-1">Technical Knowledge</p>
                        <ScoreBar value={session.scores.technical} />
                      </div>
                    )}
                    {session.scores?.behavioral && (
                      <div className="card-pad">
                        <p className="text-xs text-ink-500 mb-1">Problem Solving</p>
                        <ScoreBar value={session.scores.behavioral} />
                      </div>
                    )}
                    {session.scores?.communication && (
                      <div className="card-pad">
                        <p className="text-xs text-ink-500 mb-1">Communication</p>
                        <ScoreBar value={session.scores.communication} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Summary */}
                {session.summary && (
                  <div>
                    <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Assessment Summary</p>
                    <div className="card-pad bg-ink-50">
                      <p className="text-sm text-ink-700 leading-relaxed">{session.summary}</p>
                    </div>
                  </div>
                )}

                {/* Strengths */}
                {session.strengths && session.strengths.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Strengths</p>
                    <div className="flex flex-wrap gap-2">
                      {session.strengths.map((s, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-positive-50 text-positive-700 text-sm rounded-full">
                          <Award size={11} />
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Concerns */}
                {session.concerns && session.concerns.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Areas for Improvement</p>
                    <div className="flex flex-wrap gap-2">
                      {session.concerns.map((c, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-warn-50 text-warn-700 text-sm rounded-full">
                          <AlertCircle size={11} />
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendation */}
                {session.recommendation && session.recommendation !== 'pending' && (
                  <div className="pt-3 border-t border-line">
                    <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-1.5">Recommendation</p>
                    <span className={`pill-${session.recommendation === 'hire' ? 'positive' : session.recommendation === 'interview-next' ? 'accent' : 'danger'} capitalize inline-flex items-center gap-1.5`}>
                      {session.recommendation === 'hire' && <Award size={13} />}
                      {session.recommendation === 'interview-next' && <ChevronRight size={13} className="rotate-180" />}
                      {session.recommendation === 'reject' && <X size={13} />}
                      {session.recommendation === 'hire' ? 'Hire' : session.recommendation === 'interview-next' ? 'Interview Next' : 'Not a Fit'}
                    </span>
                  </div>
                )}

                {/* Not available notice for missing dimensions */}
                {(!session.scores?.technical && !session.scores?.behavioral && !session.scores?.communication) && evaluationStatus === 'evaluated' && (
                  <p className="text-sm text-ink-500 text-center py-4">
                    Overall score is available but detailed dimension scores are not recorded.
                  </p>
                )}
              </div>
            )}
          </Section>
        )}

        {/* ── Transcript Tab ──────────────────────────────────────────────── */}
        {activeTab === 'transcript' && (
          <Section
            title="Interview Transcript"
            description="Complete chronological transcript of the interview conversation."
            padded={false}
            className="!"
          >
            {transcriptLoading ? (
              <div className="p-8">
                <LoadingBlock label="Loading transcript…" />
              </div>
            ) : transcript && transcript.transcript.length > 0 ? (
              <div className="p-5 max-h-[500px] overflow-y-auto space-y-3">
                {transcript.transcript.map((item, i) => (
                  <TranscriptItem key={i} item={item} index={i} />
                ))}
              </div>
            ) : session.messages && session.messages.length > 0 ? (
              <div className="p-5 max-h-[500px] overflow-y-auto space-y-3">
                {session.messages.map((msg, i) => (
                  <TranscriptItem
                    key={i}
                    item={{
                      type: msg.role === 'interviewer' ? 'question' : 'answer',
                      role: msg.role,
                      content: msg.content,
                      timestamp: msg.timestamp,
                      score: msg.score,
                      feedback: msg.feedback || null,
                    }}
                    index={i}
                  />
                ))}
              </div>
            ) : session.answers && session.answers.length > 0 ? (
              <div className="p-5 max-h-[500px] overflow-y-auto space-y-3">
                {session.answers.map((a, i) => (
                  <>
                    <TranscriptItem
                      key={`q-${i}`}
                      item={{
                        type: 'question',
                        role: 'interviewer',
                        content: a.question,
                        timestamp: null,
                        score: null,
                        feedback: null,
                      }}
                      index={i * 2}
                    />
                    <TranscriptItem
                      key={`a-${i}`}
                      item={{
                        type: a.answerText && a.answerText.trim() ? 'answer' : 'skipped',
                        role: 'candidate',
                        content: a.answerText || '(No answer provided)',
                        timestamp: null,
                        score: a.evaluated ? a.score : null,
                        feedback: a.evaluated ? a.feedback : 'Not evaluated — the AI evaluator was unavailable.',
                      }}
                      index={i * 2 + 1}
                    />
                  </>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <EmptyState
                  icon={ScrollText}
                  title="No transcript available"
                  description="This interview does not have a recorded transcript."
                />
              </div>
            )}
          </Section>
        )}
      </div>

      {/* Recruiter Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button onClick={() => navigate('/interviews')} className="btn-secondary btn-sm">
          <ArrowLeft size={14} />
          Return to Interview List
        </button>
        {candidate?._id && (
          <button
            onClick={() => navigate(`/candidates`)}
            className="btn-ghost btn-sm text-ink-600"
          >
            <User size={14} />
            View Candidate Profile
          </button>
        )}
        {job?._id && (
          <button
            onClick={() => navigate(`/jobs/${job._id}/applicants`)}
            className="btn-ghost btn-sm text-ink-600"
          >
            <Briefcase size={14} />
            View Job Applicants
          </button>
        )}
      </div>
    </div>
  )
}


