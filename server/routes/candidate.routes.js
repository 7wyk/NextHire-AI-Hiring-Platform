import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import { requireObjectId } from '../middlewares/security.middleware.js'
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
// Candidate records are recruiter-owned data: every route here is staff-only.
// POST previously accepted any authenticated caller (SEC-05).
router.route('/')
  .get(authorize('recruiter', 'admin'), getCandidates)
  .post(authorize('recruiter', 'admin'), createCandidate)
router.route('/:id')
  .get(requireObjectId('id'), authorize('recruiter', 'admin'), getCandidate)
  .put(requireObjectId('id'), authorize('recruiter', 'admin'), updateCandidate)
  .delete(requireObjectId('id'), authorize('recruiter', 'admin'), deleteCandidate)
router.patch('/:id/status', requireObjectId('id'), authorize('recruiter', 'admin'), updateStatus)

export default router
