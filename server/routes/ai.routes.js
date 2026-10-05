import { Router } from 'express'
import { protect, authorize } from '../middlewares/auth.middleware.js'
import { upload }  from '../config/multer.js'
import {
  parseResume,
  scoreResume,
  generateQuestions,
} from '../controllers/ai.controller.js'

const router = Router()

// All AI routes require a logged-in user
router.use(protect)

// ── POST /api/ai/parse-resume ─────────────────────────────────────────────────
// Recruiter only: PDF / DOC / DOCX / TXT (max 5 MB) — extracts plain text.
router.post('/parse-resume', authorize('recruiter', 'admin'), upload.single('resume'), parseResume)

// ── POST /api/ai/score-resume ─────────────────────────────────────────────────
// Recruiter only: { resumeText, jobTitle?, jobDescription? } → score 0-100.
router.post('/score-resume', authorize('recruiter', 'admin'), scoreResume)

// ── POST /api/ai/generate-questions ──────────────────────────────────────────
// Recruiter only: { resumeText, jobTitle, jobDescription?, round? } → 5 questions.
router.post('/generate-questions', authorize('recruiter', 'admin'), generateQuestions)

export default router
