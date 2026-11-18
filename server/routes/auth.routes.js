import { Router } from 'express'
import {
  register, login, refresh, logout, getMe,
  forgotPassword, resetPassword, verifyEmail,
  candidateRegister, candidateLogin,
  recruiterRegister, recruiterLogin,
} from '../controllers/auth.controller.js'
import { protect } from '../middlewares/auth.middleware.js'
import { authLimiter, passwordResetLimiter } from '../middlewares/rateLimit.middleware.js'

const router = Router()

// ── Legacy (generic) routes ──────────────────────────────────────────────────
router.post('/register',                    authLimiter, register)
router.post('/login',                       authLimiter, login)

// ── Role-specific auth (PREFERRED — no role from frontend) ───────────────────
router.post('/candidate/register',          authLimiter, candidateRegister)
router.post('/candidate/login',             authLimiter, candidateLogin)
router.post('/recruiter/register',          authLimiter, recruiterRegister)
router.post('/recruiter/login',             authLimiter, recruiterLogin)

// ── Token management ─────────────────────────────────────────────────────────
router.post('/refresh',                     refresh)
router.post('/logout',                      logout)
router.get ('/me',           protect,       getMe)

// ── Password reset & email verification ──────────────────────────────────────
// Tight limit: reset requests are the enumeration / mailbomb surface.
router.post('/forgot-password',             passwordResetLimiter, forgotPassword)
router.post('/reset-password',              passwordResetLimiter, resetPassword)
router.get ('/verify-email/:token',         verifyEmail)

export default router
