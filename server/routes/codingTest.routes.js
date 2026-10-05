import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import {
  generateTest,
  getTestForJob,
  submitTest,
  runCode,
  getTestResults,
  getMySubmission,
} from '../controllers/codingTest.controller.js'

const router = Router()

router.use(protect)

// ── Recruiter only ────────────────────────────────────────────────────────────
router.post('/generate',            authorize('recruiter', 'admin'), generateTest)
router.get('/:jobId/results',       authorize('recruiter', 'admin'), getTestResults)

// ── Candidate only ────────────────────────────────────────────────────────────
router.post('/run',                 authorize('candidate'), runCode)
router.post('/submit',              authorize('candidate'), submitTest)
router.get('/:jobId',              authorize('candidate'), getTestForJob)
router.get('/:jobId/my-submission', authorize('candidate'), getMySubmission)

export default router
