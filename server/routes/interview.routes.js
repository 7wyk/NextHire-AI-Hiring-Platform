import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import {
  createSession, sendMessage, getSessions, getSession, endSession
} from '../controllers/interview.controller.js'
import {
  startCandidateInterview, submitCandidateAnswer,
  completeCandidateInterview, getCandidateInterviewStatus,
} from '../controllers/candidateInterview.controller.js'

const router = Router()
router.use(protect)

// ── Recruiter-initiated interview routes ───────────────────────────────────
router.get('/sessions',          getSessions)
router.post('/sessions',         createSession)
router.get('/sessions/:id',      getSession)
router.post('/sessions/:id/message', sendMessage)
router.patch('/sessions/:id/end',    endSession)

// ── Candidate-initiated interview routes ───────────────────────────────────
router.post('/candidate/start',          authorize('candidate'), startCandidateInterview)
router.post('/candidate/answer',         authorize('candidate'), submitCandidateAnswer)
router.post('/candidate/complete',       authorize('candidate'), completeCandidateInterview)
router.get('/candidate/status/:jobId',   authorize('candidate'), getCandidateInterviewStatus)

export default router
