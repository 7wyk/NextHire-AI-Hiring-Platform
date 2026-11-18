import InterviewSession from '../models/InterviewSession.js'
import User from '../models/User.js'
import Candidate from '../models/Candidate.js'
import Application from '../models/Application.js'
import Job from '../models/Job.js'
import logger from '../config/logger.js'
import {
  applyInterviewResult,
  findProfileForJob,
} from '../services/candidateProfile.service.js'
import {
  startInterview, continueInterview,
  evaluateAnswer, generateInterviewSummary
} from '../services/interview.service.js'
import { sendEmail, buildInterviewScheduledEmail } from '../services/email.service.js'

// v2 Agent System
import { supervisorAgent } from '../agents/supervisor.agent.js'
import { storeInterviewSession } from '../memory/interview.memory.js'
import { storeInterviewResult } from '../memory/candidate.memory.js'

// POST /api/interview/sessions
export const createSession = async (req, res) => {
  try {
    const { candidateId, jobId, scheduledAt } = req.body

    logger.info('[Interview] createSession — request received', { candidateId, jobId })

    if (!candidateId) return res.status(400).json({ message: 'Candidate ID is required' })
    if (!jobId)       return res.status(400).json({ message: 'Job ID is required' })

    // Primary lookup: User collection (candidateId is a User._id)
    // Fallback: also try matching by email in case frontend sends email
    let candidate = await User.findOne({ _id: candidateId, role: 'candidate' }).lean()
    if (!candidate) {
      candidate = await User.findOne({ email: candidateId, role: 'candidate' }).lean()
    }

    logger.info('[Interview] Candidate lookup result', {
      found: !!candidate,
      candidateId,
      candidateName: candidate?.name || null,
    })

    if (!candidate) return res.status(404).json({ message: 'Candidate not found' })

    // A recruiter may only interview for their own jobs; admins may act on any.
    const jobFilter = req.user.role === 'admin'
      ? { _id: jobId }
      : { _id: jobId, recruiter: req.user._id }
    const job = await Job.findOne(jobFilter)
    if (!job) return res.status(404).json({ message: 'Job not found or access denied' })

    // Optional scheduling slot. Rejected rather than silently ignored if bad.
    let scheduledDate = null
    if (scheduledAt) {
      scheduledDate = new Date(scheduledAt)
      if (Number.isNaN(scheduledDate.getTime())) {
        return res.status(400).json({ message: 'scheduledAt must be a valid date' })
      }
    }

    // Fetch resume from Application (single source of truth)
    const application = await Application.findOne({
      candidate: candidate._id,
      job: jobId,
    }).select('resumeText').lean()

    // Fallback: the recruiter-owned Candidate profile for this candidate + job
    const candidateProfile = await findProfileForJob({ jobId, email: candidate.email })

    const resumeText   = application?.resumeText || candidateProfile?.resumeText || ''
    const resumeSkills = candidateProfile?.skills || []

    logger.info('[Interview] Resume context', {
      fromApplication: !!application?.resumeText,
      fromCandidate:   !!candidateProfile?.resumeText,
      textLength:      resumeText.length,
    })

    // Generate opening question via Agent System (falls back to direct call)
    let opening
    try {
      const agentResult = await supervisorAgent.process({
        type: 'start-interview',
        jobTitle: job.title,
        resumeText,
        resumeSkills,
      })
      opening = agentResult.success ? agentResult.data : await startInterview({ jobTitle: job.title, resumeText, resumeSkills })
    } catch {
      opening = await startInterview({ jobTitle: job.title, resumeText, resumeSkills })
    }

    // No generic greeting may stand in for a real interviewer: if the AI is
    // unavailable the session is not created at all.
    if (!opening?.ok) {
      logger.warn('[Interview] Opening question unavailable', {
        candidateId: String(candidate._id), jobId: String(jobId), reason: opening?.reason,
      })
      return res.status(503).json({
        message: opening?.message || 'The AI interviewer is unavailable right now. No session was created.',
        evaluationUnavailable: true,
        reason: opening?.reason,
      })
    }

    const session = await InterviewSession.create({
      candidate: candidate._id,
      job: jobId,
      recruiter: req.user._id,
      jobTitle: job.title,
      messages: [{ role: 'interviewer', content: opening.message, category: opening.category, timestamp: new Date() }],
      status: 'active',
      startedAt: new Date(),
      questionCount: 1,
      ...(scheduledDate ? { scheduledAt: scheduledDate } : {}),
    })

    // Tell the candidate when a slot was scheduled. Non-blocking; delivery is
    // reported honestly by sendEmail().
    if (scheduledDate && candidate.email) {
      sendEmail({
        to: candidate.email,
        ...buildInterviewScheduledEmail({
          candidateName: candidate.name,
          jobTitle:      job.title,
          scheduledAt:   scheduledDate,
        }),
      }).catch(() => {})
    }

    // Update the candidate's profile stage for this job, if one exists
    await Candidate.updateMany(
      { email: candidate.email, job: jobId },
      { status: 'interview' }
    )

    // Populate for the response
    const populated = await InterviewSession.findById(session._id)
      .populate('candidate', 'name email')
      .populate('job', 'title company')

    logger.info('[Interview] Session created successfully', {
      sessionId: session._id,
      candidateName: candidate.name,
      jobTitle: job.title,
    })

    res.status(201).json({ session: populated })
  } catch (err) {
    logger.error('[Interview] createSession failed', { error: err.message, stack: err.stack })
    res.status(500).json({ message: err.message })
  }
}

// POST /api/interview/sessions/:id/message  – Candidate replies
export const sendMessage = async (req, res) => {
  try {
    const { content } = req.body
    const session = await InterviewSession.findById(req.params.id)
      .populate('candidate', 'name email')
      .populate('job', 'title')

    if (!session) return res.status(404).json({ message: 'Session not found' })
    if (session.status !== 'active') {
      return res.status(400).json({ message: 'Interview session is not active' })
    }

    // Load resume from Application (single source of truth), then Candidate as fallback
    const candidateUserId = session.candidate._id || session.candidate
    const jobId = session.job?._id || session.job

    const application = await Application.findOne({
      candidate: candidateUserId,
      job: jobId,
    }).select('resumeText').lean()

    const candidateProfile = await findProfileForJob({
      jobId,
      email: session.candidate?.email,
    })

    // Merge: Application resume takes priority
    const mergedResumeText = application?.resumeText || candidateProfile?.resumeText || ''

    // Add candidate message
    const candidateMsg = { role: 'candidate', content, timestamp: new Date() }
    session.messages.push(candidateMsg)

    // Evaluate the answer asynchronously (don't block)
    let evaluation = null
    try {
      const lastQuestion = session.messages
        .filter(m => m.role === 'interviewer')
        .slice(-1)[0]?.content || ''

      // Evaluate via Agent System (falls back to direct call)
      let evalResult
      try {
        const agentResult = await supervisorAgent.process({
          type: 'evaluate-answer',
          question: lastQuestion,
          answer: content,
          jobTitle: session.job?.title || session.jobTitle,
        })
        evalResult = agentResult.success ? agentResult.data : await evaluateAnswer({ question: lastQuestion, answer: content, jobTitle: session.job?.title || session.jobTitle })
      } catch {
        evalResult = await evaluateAnswer({ question: lastQuestion, answer: content, jobTitle: session.job?.title || session.jobTitle })
      }
      evaluation = evalResult

      // Attach score/feedback to the candidate message. A score is stored only
      // when the model actually produced one.
      const lastIdx = session.messages.length - 1
      if (evaluation?.ok) {
        session.messages[lastIdx].score    = evaluation.score
        session.messages[lastIdx].feedback = evaluation.feedback
        session.messages[lastIdx].category = evaluation.category
      } else {
        session.messages[lastIdx].feedback =
          'Not evaluated — the AI evaluator was unavailable for this answer.'
        logger.warn('[Interview] Answer stored without evaluation', {
          sessionId: String(session._id), reason: evaluation?.reason,
        })
      }
    } catch (err) {
      logger.error('[Interview] Answer evaluation threw', { error: err.message })
    }

    // Check if interview is complete (>= 7 questions or AI said thank you)
    const isWrappingUp = content.toLowerCase().includes('thank you') ||
      session.questionCount >= 7

    let nextMsg = null
    let evaluationUnavailable = !evaluation?.ok

    if (!isWrappingUp) {
      // Generate next interviewer message — never a canned substitute.
      const next = await continueInterview({
        jobTitle: session.job?.title || session.jobTitle,
        resumeText: mergedResumeText,
        resumeSkills: candidateProfile?.skills || [],
        messages: session.messages,
        questionCount: session.questionCount,
      })

      if (next?.ok) {
        nextMsg = { role: 'interviewer', content: next.message, timestamp: new Date() }
        session.messages.push(nextMsg)
        session.questionCount += 1
      } else {
        evaluationUnavailable = true
        logger.warn('[Interview] Next question unavailable', {
          sessionId: String(session._id), reason: next?.reason,
        })
      }
    } else {
      session.status = 'completed'
      session.completedAt = new Date()
      session.durationMin = Math.round(
        (session.completedAt - session.startedAt) / 60000
      )

      // Generate summary
      try {
        const summary = await generateInterviewSummary({
          jobTitle: session.jobTitle,
          messages: session.messages,
        })

        if (!summary?.ok) {
          // Nothing was evaluated: do not write scores, a recommendation or a
          // candidate profile score that would look like a real result.
          session.evaluationStatus = 'unavailable'
          evaluationUnavailable = true
          logger.warn('[Interview] Summary unavailable — session marked unevaluated', {
            sessionId: String(session._id), reason: summary?.reason,
          })
        } else {
          session.scores.technical     = summary.technical ?? 0
          session.scores.behavioral    = summary.behavioral ?? 0
          session.scores.communication = summary.communication ?? 0
          session.scores.overall       = summary.overall ?? 0
          session.summary              = summary.summary || ''
          session.strengths            = summary.strengths || []
          session.concerns             = summary.concerns || []
          session.recommendation       = summary.recommendation || 'pending'
          session.evaluationStatus     = 'evaluated'

          // Persist the interview score on the candidate's profile for this job
          const candidateDoc = await applyInterviewResult({
            candidateUserId,
            jobId,
            interviewScore: summary.overall,
            recruiterId: req.user?._id,
          })
          if (candidateDoc) {
            if (summary.recommendation === 'hire') candidateDoc.status = 'shortlisted'
            else if (summary.recommendation === 'reject') candidateDoc.status = 'rejected'
            await candidateDoc.save()
          }
          // Store in AI memory (non-blocking)
          storeInterviewSession(session._id, candidateUserId, jobId, summary).catch(() => {})
          storeInterviewResult(candidateUserId, jobId, summary).catch(() => {})
        }
      } catch (e) {
        logger.error('[Interview summary]', { error: e.message })
      }
    }

    await session.save()

    res.json({
      session,
      nextMessage: nextMsg,
      evaluation,
      evaluationUnavailable,
      isComplete: session.status === 'completed',
    })
  } catch (err) {
    console.error('[Interview sendMessage]', err)
    res.status(500).json({ message: err.message })
  }
}

// ── Helper: strip scores from session for candidate users ──────────────────
const stripScoresForCandidate = (session, userRole) => {
  if (userRole === 'recruiter' || userRole === 'admin') return session
  const obj = session.toObject ? session.toObject() : { ...session }
  delete obj.scores
  delete obj.finalScore
  delete obj.summary
  delete obj.strengths
  delete obj.concerns
  delete obj.recommendation
  if (obj.answers) {
    obj.answers = obj.answers.map(a => ({
      question: a.question,
      answerText: a.answerText,
      // score and feedback intentionally omitted
    }))
  }
  // Strip score/feedback from messages too
  if (obj.messages) {
    obj.messages = obj.messages.map(m => {
      const { score, feedback, ...rest } = m
      return rest
    })
  }
  return obj
}

// GET /api/interview/sessions
export const getSessions = async (req, res) => {
  try {
    const sessions = await InterviewSession.find({ recruiter: req.user._id })
      .populate('candidate', 'name email')
      .populate('job', 'title company')
      .sort('-createdAt')
      .limit(50)
    const cleaned = sessions.map(s => stripScoresForCandidate(s, req.user.role))
    res.json({ sessions: cleaned })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/interview/sessions/:id
export const getSession = async (req, res) => {
  try {
    const session = await InterviewSession.findById(req.params.id)
      .populate('candidate', 'name email')
      .populate('job', 'title company')
    if (!session) return res.status(404).json({ message: 'Session not found' })
    res.json({ session: stripScoresForCandidate(session, req.user.role) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── Recruiter interview management endpoints ────────────────────────────────

/**
 * GET /api/recruiter/interviews
 *
 * Paginated, filterable, sortable list of interviews visible to the recruiter.
 * Returns populated candidate + job info and full answer/evaluation data.
 */
export const getRecruiterInterviews = async (req, res) => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      search,
      jobId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query

    // Authorization: recruiter sees their own interviews; admin sees all
    const baseFilter = req.user.role === 'admin'
      ? {}
      : { recruiter: req.user._id }

    // Status filter
    if (status && status !== 'all') {
      if (status === 'not_started') {
        // Not started: recruiter-initiated sessions that are still pending
        // and candidate-initiated sessions whose candidate has not yet started
        baseFilter.$or = [
          { initiatedBy: 'recruiter', status: 'pending' },
          { initiatedBy: 'candidate', status: 'pending' },
        ]
      } else {
        baseFilter.status = status
      }
    }

    // Job filter
    if (jobId) {
      baseFilter.job = jobId
    }

    // Text search across candidate name, job title
    let textFilter = {}
    if (search) {
      textFilter.$or = [
        { 'candidate.name': { $regex: search, $options: 'i' } },
        { jobTitle: { $regex: search, $options: 'i' } },
        { 'job.title': { $regex: search, $options: 'i' } },
      ]
    }

    const combinedFilter = { ...baseFilter, ...textFilter }
    // $or from status and $or from search need merging
    if (combinedFilter.$or && textFilter.$or) {
      combinedFilter.$or = [
        ...combinedFilter.$or,
        ...textFilter.$or,
      ]
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
    const skip = (pageNum - 1) * limitNum

    const sortDir = sortOrder === 'asc' ? 1 : -1
    const sortMap = {
      createdAt: { createdAt: sortDir },
      startedAt: { startedAt: sortDir },
      completedAt: { completedAt: sortDir },
      'scores.overall': { 'scores.overall': sortDir },
      candidate: { 'candidate.name': sortDir },
      jobTitle: { jobTitle: sortDir },
    }
    const sort = sortMap[sortBy] || { createdAt: -1 }

    const [sessions, total] = await Promise.all([
      InterviewSession.find(combinedFilter)
        .populate('candidate', 'name email avatar')
        .populate('job', 'title company')
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      InterviewSession.countDocuments(combinedFilter),
    ])

    const pages = Math.max(1, Math.ceil(total / limitNum))

    res.json({
      sessions,
      pagination: { page: pageNum, limit: limitNum, total, pages },
    })
  } catch (err) {
    logger.error('[Recruiter Interviews] getRecruiterInterviews failed', { error: err.message, stack: err.stack })
    res.status(500).json({ message: err.message })
  }
}

/**
 * GET /api/recruiter/interviews/stats
 *
 * Dashboard statistics for the recruiter's interviews.
 */
export const getRecruiterInterviewStats = async (req, res) => {
  try {
    const baseFilter = req.user.role === 'admin'
      ? {}
      : { recruiter: req.user._id }

    const [
      totalResult,
      completedResult,
      inProgressResult,
      notStartedResult,
      abandonedResult,
      avgScoreResult,
    ] = await Promise.all([
      InterviewSession.countDocuments(baseFilter),
      InterviewSession.countDocuments({ ...baseFilter, status: 'completed' }),
      InterviewSession.countDocuments({ ...baseFilter, status: 'active' }),
      InterviewSession.countDocuments({
        ...baseFilter,
        $or: [
          { initiatedBy: 'recruiter', status: 'pending' },
          { initiatedBy: 'candidate', status: 'pending' },
        ],
      }),
      InterviewSession.countDocuments({ ...baseFilter, status: 'abandoned' }),
      InterviewSession.aggregate([
        { $match: { ...baseFilter, status: 'completed', evaluationStatus: 'evaluated' } },
        { $group: { _id: null, avg: { $avg: '$scores.overall' } } },
      ]),
    ])

    res.json({
      total: totalResult,
      completed: completedResult,
      inProgress: inProgressResult,
      notStarted: notStartedResult,
      abandoned: abandonedResult,
      averageScore: avgScoreResult.length > 0 ? Math.round(avgScoreResult[0].avg) : null,
    })
  } catch (err) {
    logger.error('[Recruiter Interviews] getRecruiterInterviewStats failed', { error: err.message, stack: err.stack })
    res.status(500).json({ message: err.message })
  }
}

/**
 * GET /api/recruiter/interviews/:sessionId
 *
 * Full interview detail for recruiter review. Returns populated session with
 * all scores, answers, feedback, summary, strengths, concerns.
 */
export const getRecruiterInterviewDetail = async (req, res) => {
  try {
    const session = await InterviewSession.findById(req.params.sessionId)
      .populate('candidate', 'name email avatar company location')
      .populate('job', 'title company description skills')

    if (!session) return res.status(404).json({ message: 'Interview session not found' })

    // Authorization
    if (req.user.role !== 'admin' && String(session.recruiter) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' })
    }

    res.json({ session })
  } catch (err) {
    logger.error('[Recruiter Interviews] getRecruiterInterviewDetail failed', { error: err.message, stack: err.stack })
    res.status(500).json({ message: err.message })
  }
}

/**
 * GET /api/recruiter/interviews/:sessionId/transcript
 *
 * Returns a formatted chronological transcript of the interview.
 */
export const getRecruiterInterviewTranscript = async (req, res) => {
  try {
    const session = await InterviewSession.findById(req.params.sessionId)
      .populate('candidate', 'name')
      .populate('job', 'title')

    if (!session) return res.status(404).json({ message: 'Interview session not found' })

    // Authorization
    if (req.user.role !== 'admin' && String(session.recruiter) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' })
    }

    // Build transcript from messages (recruiter-initiated flow) and answers
    // (candidate-initiated flow).
    const transcript = []

    if (session.messages && session.messages.length > 0) {
      // Recruiter-initiated interview: use message history
      for (const msg of session.messages) {
        transcript.push({
          type: msg.role === 'interviewer' ? 'question' : 'answer',
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          category: msg.category || null,
          score: msg.score !== undefined ? msg.score : null,
          feedback: msg.feedback || null,
        })
      }
    } else if (session.answers && session.answers.length > 0) {
      // Candidate-initiated interview: use answers array
      for (let i = 0; i < session.answers.length; i++) {
        const a = session.answers[i]
        transcript.push({
          type: 'question',
          role: 'interviewer',
          content: a.question,
          timestamp: null,
          category: null,
          score: null,
          feedback: null,
        })
        transcript.push({
          type: a.answerText && a.answerText.trim() ? 'answer' : 'skipped',
          role: 'candidate',
          content: a.answerText || '(No answer provided)',
          timestamp: null,
          category: null,
          score: a.evaluated ? a.score : null,
          feedback: a.evaluated ? a.feedback : 'Not evaluated — the AI evaluator was unavailable for this answer.',
        })
      }
    }

    res.json({
      sessionId: session._id,
      candidateName: session.candidate?.name || 'Candidate',
      jobTitle: session.job?.title || session.jobTitle || 'Role',
      status: session.status,
      transcript,
    })
  } catch (err) {
    logger.error('[Recruiter Interviews] getRecruiterInterviewTranscript failed', { error: err.message, stack: err.stack })
    res.status(500).json({ message: err.message })
  }
}

// PATCH /api/interview/sessions/:id/end  – Force end session
export const endSession = async (req, res) => {
  try {
    const session = await InterviewSession.findByIdAndUpdate(
      req.params.id,
      { status: 'completed', completedAt: new Date() },
      { new: true }
    )
    if (!session) return res.status(404).json({ message: 'Session not found' })
    res.json({ session })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
