/**
 * candidateInterview.controller.js
 *
 * Candidate-facing AI Interview endpoints.
 * - Start interview (generates resume-based questions, prevents duplicates)
 * - Submit answer (evaluates via AI, stores score — never returns score)
 * - Complete interview (computes finalScore, updates Candidate profile)
 * - Check status (has candidate already taken interview for this job?)
 *
 * Evaluation contract: answers are scored 0–100 by the AI and stored as-is.
 * When the AI is unavailable the answer is marked `evaluated: false` and no
 * score is invented; such answers are excluded from the final average, and an
 * interview with no evaluated answers is completed with
 * `evaluationStatus: 'unavailable'` instead of a fabricated zero.
 */

import InterviewSession from '../models/InterviewSession.js'
import Application from '../models/Application.js'
import Job from '../models/Job.js'
import logger from '../config/logger.js'
import {
  generateResumeBasedQuestions,
  evaluateInterviewAnswer,
} from '../services/interview.service.js'
import {
  applyInterviewResult,
  findProfileForJob,
} from '../services/candidateProfile.service.js'
import { scoreInterviewAnswers } from '../services/interviewScoring.service.js'

// ── POST /api/interview/candidate/start ──────────────────────────────────────
export const startCandidateInterview = async (req, res) => {
  try {
    const { jobId } = req.body
    const candidateId = req.user._id

    if (!jobId) return res.status(400).json({ message: 'Job ID is required' })

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

    // Resume an active (in-progress) session rather than creating a second one
    const activeSession = await InterviewSession.findOne({
      candidate: candidateId,
      job: jobId,
      initiatedBy: 'candidate',
      completed: false,
      status: 'active',
    })
    if (activeSession) {
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

    // ── Resume text: application first, recruiter-owned profile second ────
    const application = await Application.findOne({
      candidate: candidateId,
      job: jobId,
    }).select('resumeText').lean()

    const candidateProfile = await findProfileForJob({
      jobId,
      email: req.user?.email,
    })

    const resumeText = application?.resumeText || candidateProfile?.resumeText || ''

    // ── Generate questions (no generic substitute) ─────────────────────────
    const generated = await generateResumeBasedQuestions({
      resumeText,
      jobTitle: job.title,
    })

    if (!generated?.ok) {
      logger.warn('[CandidateInterview] Question generation unavailable', {
        candidateId: String(candidateId),
        jobId: String(jobId),
        reason: generated?.reason,
      })
      return res.status(503).json({
        message: generated?.message ||
          'The AI interviewer is unavailable right now. No interview was started.',
        evaluationUnavailable: true,
        reason: generated?.reason,
      })
    }

    const questions = generated.questions

    if (generated.mock) {
      logger.warn('[CandidateInterview] Starting interview with MOCK questions', {
        candidateId: String(candidateId), jobId: String(jobId),
      })
    }

    // ── Create session ────────────────────────────────────────────────────
    let session
    try {
      session = await InterviewSession.create({
        candidate: candidateId,
        job: jobId,
        // The session belongs to the recruiter who owns the job. Falling back
        // to the candidate id used to put the candidate on both sides.
        recruiter: job.recruiter,
        jobTitle: job.title,
        initiatedBy: 'candidate',
        status: 'active',
        startedAt: new Date(),
        answers: questions.map(q => ({
          question: q,
          answerText: '',
          score: 0,
          feedback: '',
          evaluated: true,
        })),
      })
    } catch (err) {
      // Unique index backstop: a concurrent start already created the session
      if (err?.code === 11000) {
        const concurrent = await InterviewSession.findOne({
          candidate: candidateId,
          job: jobId,
          initiatedBy: 'candidate',
        })
        if (concurrent) {
          return res.status(200).json({
            session: {
              _id: concurrent._id,
              jobTitle: concurrent.jobTitle,
              questions: concurrent.answers.map(a => a.question),
              currentIndex: concurrent.answers.findIndex(a => !a.answerText && a.answerText !== ''),
              resumed: true,
            },
          })
        }
      }
      throw err
    }

    logger.info('[CandidateInterview] Session created', {
      sessionId: session._id,
      questionCount: questions.length,
      mockQuestions: Boolean(generated.mock),
    })

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

    if (session.candidate.toString() !== candidateId.toString()) {
      return res.status(403).json({ message: 'Not authorized' })
    }

    if (session.completed) {
      return res.status(400).json({ message: 'Interview already completed' })
    }

    if (questionIndex < 0 || questionIndex >= session.answers.length) {
      return res.status(400).json({ message: 'Invalid question index' })
    }

    const safeAnswer = (answerText || '').trim()
    const existing  = session.answers[questionIndex]

    // Idempotent retry: the same answer that was already evaluated is not sent
    // to the model again (no double cost, no drifting score).
    if (existing.answerText === safeAnswer && existing.evaluated !== false) {
      return res.json({
        success: true,
        questionIndex,
        duplicate: true,
        nextIndex: questionIndex + 1 < session.answers.length ? questionIndex + 1 : null,
      })
    }

    existing.answerText = safeAnswer

    const evaluation = await evaluateInterviewAnswer({
      question: existing.question,
      answer: safeAnswer,
      jobTitle: session.jobTitle,
    })

    if (evaluation?.ok) {
      existing.score      = evaluation.score
      existing.feedback   = evaluation.feedback
      existing.evaluated  = true
    } else {
      // No score is invented. The answer is kept and excluded from the average.
      existing.score      = 0
      existing.evaluated  = false
      existing.feedback   = 'Not evaluated — the AI evaluator was unavailable for this answer.'
      logger.warn('[CandidateInterview] Answer stored without evaluation', {
        sessionId: String(session._id),
        questionIndex,
        reason: evaluation?.reason,
      })
    }

    await session.save()

    if (evaluation?.ok) {
      logger.info('[CandidateInterview] Answer submitted', {
        sessionId, questionIndex, answerLength: safeAnswer.length,
      })
    }

    res.json({
      success: true,
      questionIndex,
      evaluated: Boolean(evaluation?.ok),
      evaluationUnavailable: !evaluation?.ok,
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

    // Idempotent: a retried completion is a success, not an error.
    if (session.completed) {
      return res.json({
        success: true,
        alreadyCompleted: true,
        evaluationStatus: session.evaluationStatus,
        message: 'Interview already completed.',
      })
    }

    // Only answers that were actually given AND successfully evaluated count.
    // A genuine zero counts; an unavailable evaluation does not, and an
    // interview with nothing evaluated gets no score at all.
    const { finalScore, evaluatedCount, evaluationStatus } = scoreInterviewAnswers(session.answers)

    session.finalScore     = finalScore
    session.completed      = true
    session.status         = 'completed'
    session.completedAt    = new Date()
    session.evaluationStatus = evaluationStatus
    session.durationMin = session.startedAt
      ? Math.max(0, Math.round((session.completedAt - session.startedAt) / 60000))
      : 0

    session.scores.overall       = finalScore
    session.scores.communication = finalScore

    await session.save()

    if (evaluatedCount === 0) {
      // Nothing was evaluated: do not write an interview score onto the
      // candidate profile, which would look like a real zero to the recruiter.
      logger.warn('[CandidateInterview] Interview completed without any evaluated answers', {
        sessionId: String(session._id),
        totalAnswers: session.answers.length,
      })
    } else {
      const job = await Job.findById(session.job).select('recruiter title').lean()

      await applyInterviewResult({
        candidateUserId: candidateId,
        candidateName: req.user?.name,
        jobId: session.job,
        recruiterId: job?.recruiter || session.recruiter,
        interviewScore: finalScore,
      })
    }

    logger.info('[CandidateInterview] Interview completed', {
      sessionId,
      finalScore,
      evaluationStatus: session.evaluationStatus,
      evaluatedAnswers: evaluatedCount,
      durationMin: session.durationMin,
    })

    res.json({
      success: true,
      evaluationStatus: session.evaluationStatus,
      message: session.evaluationStatus === 'evaluated'
        ? 'Interview completed. Thank you for your time!'
        : 'Interview completed, but the evaluation service was unavailable. Your answers were saved.',
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
    })
      .select('completed status startedAt completedAt evaluationStatus')
      .lean()

    if (!session) {
      return res.json({ hasInterview: false, completed: false, status: 'not_started' })
    }

    const completed = session.completed || session.status === 'completed'

    res.json({
      hasInterview: true,
      completed,
      status: completed ? 'completed' : 'in_progress',
      evaluationStatus: session.evaluationStatus || 'pending',
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
