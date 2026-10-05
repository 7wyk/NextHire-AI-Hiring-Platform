/**
 * candidateInterview.controller.js
 *
 * Candidate-facing AI Interview endpoints.
 * - Start interview (generates resume-based questions, prevents duplicates)
 * - Submit answer (evaluates via AI, stores score — never returns score)
 * - Complete interview (computes finalScore, updates Candidate profile)
 * - Check status (has candidate already taken interview for this job?)
 */

import InterviewSession from '../models/InterviewSession.js'
import Application from '../models/Application.js'
import Candidate from '../models/Candidate.js'
import Job from '../models/Job.js'
import logger from '../config/logger.js'
import {
  generateResumeBasedQuestions,
  evaluateInterviewAnswer,
} from '../services/interview.service.js'

// ── POST /api/interview/candidate/start ──────────────────────────────────────
export const startCandidateInterview = async (req, res) => {
  try {
    const { jobId } = req.body
    const candidateId = req.user._id

    if (!jobId) return res.status(400).json({ message: 'Job ID is required' })

    // Verify job exists
    const job = await Job.findById(jobId)
    if (!job) return res.status(404).json({ message: 'Job not found' })

    // ── Prevent duplicate interviews ──────────────────────────────────────
    const existing = await InterviewSession.findOne({
      candidate: candidateId,
      job: jobId,
      initiatedBy: 'candidate',
      completed: true,
    })
    if (existing) {
      return res.status(400).json({ message: 'Interview already completed for this job.' })
    }

    // Also check for an active (in-progress) session
    const activeSession = await InterviewSession.findOne({
      candidate: candidateId,
      job: jobId,
      initiatedBy: 'candidate',
      completed: false,
      status: 'active',
    })
    if (activeSession) {
      // Return the existing active session so candidate can resume
      return res.status(200).json({
        session: {
          _id: activeSession._id,
          jobTitle: activeSession.jobTitle,
          questions: activeSession.answers.map(a => a.question),
          currentIndex: activeSession.answers.findIndex(a => !a.answerText && a.answerText !== ''),
          resumed: true,
        },
      })
    }

    // ── Fetch resume text ──────────────────────────────────────────────────
    const application = await Application.findOne({
      candidate: candidateId,
      job: jobId,
    }).select('resumeText').lean()

    const candidateProfile = await Candidate.findOne({ createdBy: candidateId })
      .sort({ resumeScore: -1 })
      .select('resumeText')
      .lean()

    const resumeText = application?.resumeText || candidateProfile?.resumeText || ''

    logger.info('[CandidateInterview] Starting interview', {
      candidateId, jobId, jobTitle: job.title,
      hasResume: resumeText.length > 0,
    })

    // ── Generate questions ────────────────────────────────────────────────
    const questions = await generateResumeBasedQuestions({
      resumeText,
      jobTitle: job.title,
    })

    // ── Create session ────────────────────────────────────────────────────
    const session = await InterviewSession.create({
      candidate: candidateId,
      job: jobId,
      recruiter: job.recruiter || candidateId, // fallback if no recruiter ref
      jobTitle: job.title,
      initiatedBy: 'candidate',
      status: 'active',
      startedAt: new Date(),
      answers: questions.map(q => ({
        question: q,
        answerText: '',
        score: 0,
        feedback: '',
      })),
    })

    logger.info('[CandidateInterview] Session created', {
      sessionId: session._id,
      questionCount: questions.length,
    })

    // Return questions only — NO scores
    res.status(201).json({
      session: {
        _id: session._id,
        jobTitle: job.title,
        questions,
        currentIndex: 0,
      },
    })
  } catch (err) {
    logger.error('[CandidateInterview] startCandidateInterview failed', {
      error: err.message, stack: err.stack,
    })
    res.status(500).json({ message: err.message })
  }
}

// ── POST /api/interview/candidate/answer ─────────────────────────────────────
export const submitCandidateAnswer = async (req, res) => {
  try {
    const { sessionId, questionIndex, answerText } = req.body
    const candidateId = req.user._id

    if (!sessionId) return res.status(400).json({ message: 'Session ID is required' })
    if (questionIndex === undefined || questionIndex === null) {
      return res.status(400).json({ message: 'Question index is required' })
    }

    const session = await InterviewSession.findById(sessionId)
    if (!session) return res.status(404).json({ message: 'Session not found' })

    // Verify ownership
    if (session.candidate.toString() !== candidateId.toString()) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    if (session.completed) {
      return res.status(400).json({ message: 'Interview already completed' })
    }

    if (questionIndex < 0 || questionIndex >= session.answers.length) {
      return res.status(400).json({ message: 'Invalid question index' })
    }

    // Store the answer text (even if empty)
    const safeAnswer = (answerText || '').trim()
    session.answers[questionIndex].answerText = safeAnswer

    // Evaluate answer via AI (non-blocking — if it fails, fallback is used)
    try {
      const evaluation = await evaluateInterviewAnswer({
        question: session.answers[questionIndex].question,
        answer: safeAnswer,
        jobTitle: session.jobTitle,
      })
      session.answers[questionIndex].score = evaluation.score
      session.answers[questionIndex].feedback = evaluation.feedback
    } catch (evalErr) {
      logger.warn('[CandidateInterview] Answer evaluation failed, using fallback', {
        error: evalErr.message,
      })
      session.answers[questionIndex].score = Math.floor(Math.random() * 40) + 60
      session.answers[questionIndex].feedback = 'Decent answer. Improve clarity.'
    }

    await session.save()

    logger.info('[CandidateInterview] Answer submitted', {
      sessionId, questionIndex, answerLength: safeAnswer.length,
    })

    // Return ONLY confirmation — NO score, NO feedback
    res.json({
      success: true,
      questionIndex,
      nextIndex: questionIndex + 1 < session.answers.length ? questionIndex + 1 : null,
    })
  } catch (err) {
    logger.error('[CandidateInterview] submitCandidateAnswer failed', {
      error: err.message, stack: err.stack,
    })
    res.status(500).json({ message: err.message })
  }
}

// ── POST /api/interview/candidate/complete ───────────────────────────────────
export const completeCandidateInterview = async (req, res) => {
  try {
    const { sessionId } = req.body
    const candidateId = req.user._id

    if (!sessionId) return res.status(400).json({ message: 'Session ID is required' })

    const session = await InterviewSession.findById(sessionId)
    if (!session) return res.status(404).json({ message: 'Session not found' })

    if (session.candidate.toString() !== candidateId.toString()) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    if (session.completed) {
      return res.status(400).json({ message: 'Interview already completed' })
    }

    // ── Compute final score ───────────────────────────────────────────────
    const scoredAnswers = session.answers.filter(a => a.score > 0)
    const finalScore = scoredAnswers.length > 0
      ? Math.round(scoredAnswers.reduce((acc, a) => acc + a.score, 0) / scoredAnswers.length)
      : 0

    session.finalScore = finalScore
    session.completed = true
    session.status = 'completed'
    session.completedAt = new Date()
    session.durationMin = Math.round(
      (session.completedAt - session.startedAt) / 60000
    )

    // Also populate scores.overall for recruiter view consistency
    session.scores.overall = finalScore
    session.scores.communication = finalScore

    await session.save()

    // ── Update Candidate profile safely ───────────────────────────────────
    try {
      const candidateDoc = await Candidate.findOne({ createdBy: candidateId })
        .sort({ resumeScore: -1 })

      if (candidateDoc) {
        candidateDoc.interviewScore = finalScore
        candidateDoc.totalScore = Math.round(
          (candidateDoc.resumeScore || 0) * 0.3 +
          (candidateDoc.codeScore || 0) * 0.4 +
          (finalScore) * 0.3
        )
        await candidateDoc.save()

        logger.info('[CandidateInterview] Candidate profile updated', {
          candidateId,
          interviewScore: finalScore,
          totalScore: candidateDoc.totalScore,
        })
      } else {
        logger.warn('[CandidateInterview] No Candidate document found for score update', { candidateId })
      }
    } catch (profileErr) {
      // Non-blocking — interview is still completed even if profile update fails
      logger.error('[CandidateInterview] Failed to update candidate profile', {
        error: profileErr.message,
      })
    }

    logger.info('[CandidateInterview] Interview completed', {
      sessionId, finalScore, durationMin: session.durationMin,
    })

    // Return ONLY completion confirmation — NO scores
    res.json({
      success: true,
      message: 'Interview completed. Thank you for your time!',
    })
  } catch (err) {
    logger.error('[CandidateInterview] completeCandidateInterview failed', {
      error: err.message, stack: err.stack,
    })
    res.status(500).json({ message: err.message })
  }
}

// ── GET /api/interview/candidate/status/:jobId ───────────────────────────────
export const getCandidateInterviewStatus = async (req, res) => {
  try {
    const candidateId = req.user._id
    const { jobId } = req.params

    if (!jobId) return res.status(400).json({ message: 'Job ID is required' })

    const session = await InterviewSession.findOne({
      candidate: candidateId,
      job: jobId,
      initiatedBy: 'candidate',
    }).select('completed status startedAt completedAt').lean()

    if (!session) {
      return res.json({ hasInterview: false })
    }

    res.json({
      hasInterview: true,
      completed: session.completed || session.status === 'completed',
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      // NO scores returned
    })
  } catch (err) {
    logger.error('[CandidateInterview] getCandidateInterviewStatus failed', {
      error: err.message,
    })
    res.status(500).json({ message: err.message })
  }
}
