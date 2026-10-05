import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import {
  getLanguages,
  getProblems,
  getProblem,
  createProblem,
  runCode,
  submitCode,
  getMySubmissions,
  getSubmission,
} from '../controllers/code.controller.js'

const router = Router()

// All code routes require authentication
router.use(protect)

// ── Languages ────────────────────────────────────────────────────────────────
router.get('/languages', getLanguages)

// ── Problems ─────────────────────────────────────────────────────────────────
router.get('/problems',           getProblems)
router.get('/problems/:slug',     getProblem)
router.post('/problems', authorize('admin', 'recruiter'), createProblem)

// ── Code Execution ────────────────────────────────────────────────────────────
// Run: quick sandbox, no persistence
router.post('/run',    runCode)

// Submit: runs all test cases, saves to DB
router.post('/submit', submitCode)

// ── Submission History ────────────────────────────────────────────────────────
router.get('/submissions',     getMySubmissions)
router.get('/submissions/:id', getSubmission)

export default router
