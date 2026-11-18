import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import { interviewLimiter } from '../middlewares/rateLimit.middleware.js'
import { requireObjectId } from '../middlewares/security.middleware.js'
import {
  createSession, sendMessage, getSessions, getSession, endSession,
  getRecruiterInterviews, getRecruiterInterviewStats,
  getRecruiterInterviewDetail, getRecruiterInterviewTranscript,
} from '../controllers/interview.controller.js'
import {
  startCandidateInterview, submitCandidateAnswer,
  completeCandidateInterview, getCandidateInterviewStatus,
} from '../controllers/candidateInterview.controller.js'

const router = Router()
router.use(protect)

// ── Recruiter-initiated interview routes ───────────────────────────────────
// These were authentication-only, so a candidate could open or drive a
// recruiter interview session.
const staff = authorize('recruiter', 'admin')
router.get('/sessions',              staff, getSessions)
router.post('/sessions',             staff, interviewLimiter, createSession)
router.get('/sessions/:id',          requireObjectId('id'), staff, getSession)
router.post('/sessions/:id/message', requireObjectId('id'), staff, interviewLimiter, sendMessage)
router.patch('/sessions/:id/end',    requireObjectId('id'), staff, endSession)

// ── Recruiter interview management dashboard routes ────────────────────────
router.get('/recruiter/interviews',              staff, getRecruiterInterviews)
router.get('/recruiter/interviews/stats',        staff, getRecruiterInterviewStats)
router.get('/recruiter/interviews/:sessionId',   requireObjectId('sessionId'), staff, getRecruiterInterviewDetail)
router.get('/recruiter/interviews/:sessionId/transcript', requireObjectId('sessionId'), staff, getRecruiterInterviewTranscript)

// ── Candidate-initiated interview routes ───────────────────────────────────
router.post('/candidate/start',          authorize('candidate'), interviewLimiter, startCandidateInterview)
router.post('/candidate/answer',         authorize('candidate'), interviewLimiter, submitCandidateAnswer)
router.post('/candidate/complete',       authorize('candidate'), interviewLimiter, completeCandidateInterview)
router.get('/candidate/status/:jobId',   authorize('candidate'), getCandidateInterviewStatus)

export default router
