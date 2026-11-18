import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import { upload } from '../config/multer.js'
import { resumeScreenLimiter, aiLimiter } from '../middlewares/rateLimit.middleware.js'
import {
  screenResume,
  screenFromApplication,
  matchResumes,
  getScreeningHistory,
} from '../controllers/resume.controller.js'

const router = Router()
router.use(protect)

// Legacy: manual file upload screening
router.post('/screen',
  authorize('recruiter', 'admin'), resumeScreenLimiter, upload.single('resume'), screenResume)

// New: screen from existing application (no re-upload)
router.post('/screen-application',
  authorize('recruiter', 'admin'), resumeScreenLimiter, screenFromApplication)

router.post('/match',   authorize('recruiter', 'admin'), aiLimiter, matchResumes)
router.get('/history',  authorize('recruiter', 'admin'), getScreeningHistory)

export default router

