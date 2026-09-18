import { Router } from 'express'
import {
  register, login, refresh, logout, getMe,
  forgotPassword, resetPassword, verifyEmail,
  candidateRegister, candidateLogin,
  recruiterRegister, recruiterLogin,
} from '../controllers/auth.controller.js'
import { protect } from '../middlewares/auth.middleware.js'

const router = Router()

// ── Legacy (generic) routes ──────────────────────────────────────────────────
router.post('/register',                    register)
router.post('/login',                       login)

// ── Role-specific auth (PREFERRED — no role from frontend) ───────────────────
router.post('/candidate/register',          candidateRegister)
router.post('/candidate/login',             candidateLogin)
router.post('/recruiter/register',          recruiterRegister)
router.post('/recruiter/login',             recruiterLogin)

// ── Token management ─────────────────────────────────────────────────────────
router.post('/refresh',                     refresh)
router.post('/logout',                      logout)
router.get ('/me',           protect,       getMe)

// ── Password reset & email verification ──────────────────────────────────────
router.post('/forgot-password',             forgotPassword)
router.post('/reset-password',              resetPassword)
router.get ('/verify-email/:token',         verifyEmail)

export default router
