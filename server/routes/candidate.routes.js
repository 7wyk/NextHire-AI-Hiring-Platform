import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import {
  getCandidates, createCandidate, getCandidate,
  updateCandidate, deleteCandidate, updateStatus,
  getCandidateRankings,
} from '../controllers/candidate.controller.js'

const router = Router()
router.use(protect)

// ── Rankings ──────────────────────────────────────────────────────────────────
// GET /api/candidates/rankings?jobId=xxx
router.get('/rankings', authorize('recruiter', 'admin'), getCandidateRankings)

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.route('/')
  .get(authorize('recruiter', 'admin'), getCandidates)
  .post(createCandidate)
router.route('/:id')
  .get(authorize('recruiter', 'admin'), getCandidate)
  .put(updateCandidate)
  .delete(authorize('recruiter', 'admin'), deleteCandidate)
router.patch('/:id/status', authorize('recruiter', 'admin'), updateStatus)

export default router
