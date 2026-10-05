import InterviewSession from '../models/InterviewSession.js'
import User from '../models/User.js'
import Candidate from '../models/Candidate.js'
import Application from '../models/Application.js'
import Job from '../models/Job.js'
import logger from '../config/logger.js'
import {
  startInterview, continueInterview,
  evaluateAnswer, generateInterviewSummary
} from '../services/interview.service.js'

// v2 Agent System
import { supervisorAgent } from '../agents/supervisor.agent.js'
import { storeInterviewSession } from '../memory/interview.memory.js'
import { storeInterviewResult } from '../memory/candidate.memory.js'

// POST /api/interview/sessions
export const createSession = async (req, res) => {
  try {
    const { candidateId, jobId } = req.body

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

    const job = await Job.findById(jobId)
    if (!job) return res.status(404).json({ message: 'Job not found' })

    // Fetch resume from Application (single source of truth)
    const application = await Application.findOne({
      candidate: candidate._id,
      job: jobId,
    }).select('resumeText').lean()

    // Fallback: try Candidate profile (populated by manual resume screening)
    const candidateProfile = await Candidate.findOne({ createdBy: candidate._id })
      .sort({ resumeScore: -1 })
      .select('resumeText skills')
      .lean()

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

    const session = await InterviewSession.create({
      candidate: candidate._id,
      job: jobId,
      recruiter: req.user._id,
      jobTitle: job.title,
      messages: [{ ...opening, timestamp: new Date() }],
      status: 'active',
      startedAt: new Date(),
      questionCount: 1,
    })

    // Update candidate profile status if it exists
    await Candidate.updateMany({ createdBy: candidate._id }, { status: 'interview' })

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

    const candidateProfile = await Candidate.findOne({ createdBy: candidateUserId })
      .sort({ resumeScore: -1 })
      .select('resumeText skills resumeScore codeScore interviewScore')
      .lean()

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

      // Attach score/feedback to the candidate message
      const lastIdx = session.messages.length - 1
      session.messages[lastIdx].score    = evaluation.score
      session.messages[lastIdx].feedback = evaluation.feedback
      session.messages[lastIdx].category = evaluation.category
    } catch { /* non-blocking */ }

    // Check if interview is complete (>= 7 questions or AI said thank you)
    const isWrappingUp = content.toLowerCase().includes('thank you') ||
      session.questionCount >= 7

    let nextMsg = null
    if (!isWrappingUp) {
      // Generate next interviewer message
      nextMsg = await continueInterview({
        jobTitle: session.job?.title || session.jobTitle,
        resumeText: mergedResumeText,
        resumeSkills: candidateProfile?.skills || [],
        messages: session.messages,
        questionCount: session.questionCount,
      })
      session.messages.push({ ...nextMsg, timestamp: new Date() })
      session.questionCount += 1
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
        session.scores.technical     = summary.technical || 0
        session.scores.behavioral    = summary.behavioral || 0
        session.scores.communication = summary.communication || 0
        session.scores.overall       = summary.overall || 0
        session.summary              = summary.summary || ''
        session.strengths            = summary.strengths || []
        session.concerns             = summary.concerns || []
        session.recommendation       = summary.recommendation || 'pending'

        // Update candidate interview score in Candidate profile (if exists)
        const interviewScore = summary.overall || 0
        const candidateDoc = await Candidate.findOne({ createdBy: candidateUserId })
          .sort({ resumeScore: -1 })
        if (candidateDoc) {
          candidateDoc.interviewScore = interviewScore
          candidateDoc.totalScore = Math.round(
            (candidateDoc.resumeScore   * 0.4) +
            (candidateDoc.codeScore     * 0.3) +
            (interviewScore             * 0.3)
          )
          if (summary.recommendation === 'hire') candidateDoc.status = 'shortlisted'
          else if (summary.recommendation === 'reject') candidateDoc.status = 'rejected'
          await candidateDoc.save()
        }
        // Store in AI memory (non-blocking)
        storeInterviewSession(session._id, candidateUserId, jobId, summary).catch(() => {})
        storeInterviewResult(candidateUserId, jobId, summary).catch(() => {})
      } catch (e) {
        logger.error('[Interview summary]', { error: e.message })
      }
    }

    await session.save()

    res.json({
      session,
      nextMessage: nextMsg,
      evaluation,
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
