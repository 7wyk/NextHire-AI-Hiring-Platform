import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import { upload } from '../config/multer.js'
import {
  screenResume,
  screenFromApplication,
  matchResumes,
  getScreeningHistory,
} from '../controllers/resume.controller.js'

const router = Router()
router.use(protect)

// Legacy: manual file upload screening
router.post('/screen',              authorize('recruiter', 'admin'), upload.single('resume'), screenResume)

// New: screen from existing application (no re-upload)
router.post('/screen-application',  authorize('recruiter', 'admin'), screenFromApplication)

router.post('/match',   authorize('recruiter', 'admin'), matchResumes)
router.get('/history',  authorize('recruiter', 'admin'), getScreeningHistory)

export default router

