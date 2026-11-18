import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import { aiLimiter, codingExecutionLimiter } from '../middlewares/rateLimit.middleware.js'
import { requireObjectId } from '../middlewares/security.middleware.js'
import {
  generateTest,
  getTestForJob,
  startTest,
  submitTest,
  runCode,
  getTestResults,
  getMySubmission,
} from '../controllers/codingTest.controller.js'

const router = Router()

router.use(protect)

// ── Recruiter only ────────────────────────────────────────────────────────────
router.post('/generate',            authorize('recruiter', 'admin'), aiLimiter, generateTest)
router.get('/:jobId/results',       requireObjectId('jobId'), authorize('recruiter', 'admin'), getTestResults)

// ── Candidate only ────────────────────────────────────────────────────────────
router.post('/run',                 authorize('candidate'), codingExecutionLimiter, runCode)
router.post('/submit',              authorize('candidate'), codingExecutionLimiter, submitTest)
// Read-only: describes the test and the current attempt. Never starts a timer.
router.get('/:jobId',               requireObjectId('jobId'), authorize('candidate'), getTestForJob)
// The only endpoint that starts the clock (idempotent).
router.post('/:jobId/start',        requireObjectId('jobId'), authorize('candidate'), startTest)
router.get('/:jobId/my-submission', requireObjectId('jobId'), authorize('candidate'), getMySubmission)

export default router
