import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import {
  getPublicJobs,
  getJobs,
  createJob,
  getJob,
  updateJob,
  deleteJob,
} from '../controllers/job.controller.js'

const router = Router()

// ── Public — no auth required ────────────────────────────────────────────────
router.get('/public', getPublicJobs)

// ── Protected — must be logged in ────────────────────────────────────────────
router.use(protect)

// Recruiter + Admin only: create
router.post('/',    authorize('recruiter', 'admin'), createJob)

// Recruiter + Admin only: list own / all jobs
router.get('/',     authorize('recruiter', 'admin'), getJobs)

// Single job: recruiter (own) or admin (any)
router.get('/:id',    authorize('recruiter', 'admin'), getJob)
router.put('/:id',    authorize('recruiter', 'admin'), updateJob)
router.delete('/:id', authorize('recruiter', 'admin'), deleteJob)

export default router
