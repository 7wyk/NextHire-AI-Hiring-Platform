import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import { upload } from '../config/multer.js'
import {
  applyToJob,
  getMyApplications,
  getMyApplicationJobIds,
  withdrawApplication,
  getApplicantsByJob,
  getApplicationResume,
  updateApplicationStatus,
} from '../controllers/application.controller.js'

const router = Router()

// All application routes require login
router.use(protect)

// ── Candidate routes ─────────────────────────────────────────────────────────
// POST with optional resume file upload (multipart/form-data)
router.post('/',           authorize('candidate'), upload.single('resume'), applyToJob)
router.get('/mine/job-ids', authorize('candidate'), getMyApplicationJobIds)
router.get('/mine',        authorize('candidate'), getMyApplications)
router.delete('/:id',      authorize('candidate'), withdrawApplication)

// ── Recruiter routes ─────────────────────────────────────────────────────────
router.get('/job/:jobId',          authorize('recruiter', 'admin'), getApplicantsByJob)
router.get('/:id/resume',         authorize('recruiter', 'admin'), getApplicationResume)
router.patch('/:id/status',       authorize('recruiter', 'admin'), updateApplicationStatus)

export default router
