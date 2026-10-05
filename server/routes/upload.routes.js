import { Router } from 'express'
import { protect }               from '../middlewares/auth.middleware.js'
import { upload }                from '../config/multer.js'
import {
  uploadResume,
  getResumeUrl,
} from '../controllers/upload.controller.js'

const router = Router()

// All upload routes require a logged-in user
router.use(protect)

// ── POST /api/upload/resume ───────────────────────────────────────────────────
// multipart/form-data  |  field: "resume"  |  PDF / DOC / DOCX / TXT (max 5 MB)
// Optional body field:  candidateId  (links file to an existing Candidate doc)
// Returns: { publicId, url, candidate? }
router.post('/resume', upload.single('resume'), uploadResume)

// ── GET /api/upload/resume/:candidateId/url ───────────────────────────────────
// Get the resume download URL for a candidate.
// Returns: { url, candidate }
router.get('/resume/:candidateId/url', getResumeUrl)

export default router

