import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import User from '../models/User.js'
import logger from '../config/logger.js'
import {
  setAuthCookies, clearAuthCookies, REFRESH_COOKIE,
} from '../config/cookies.js'
import { buildPasswordResetEmail, sendEmail, isEmailConfigured } from '../services/email.service.js'

const MAX_LOGIN_ATTEMPTS = 5
const LOCK_DURATION_MS   = 15 * 60 * 1000 // 15 minutes

// ── Token helpers ──────────────────────────────────────────────────────────

const generateAccessToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  )

const generateRefreshToken = (user) =>
  jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  )

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex')

/**
 * Send the token pair to the browser as HttpOnly cookies (XSS cannot read
 * them) while still returning it in the body for API clients and tests.
 */
const sessionResponse = (res, user, { status = 200, accessToken, refreshToken, extra = {} } = {}) => {
  const csrfToken = crypto.randomBytes(24).toString('hex')
  setAuthCookies(res, { accessToken, refreshToken, csrfToken })

  return res.status(status).json({
    tokenTransport: 'cookie',
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      ...extra,
    },
  })
}

// ── Controllers ────────────────────────────────────────────────────────────

// POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { name, email, password, role, company } = req.body

    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required' })

    // Prevent self-assigning admin role via API — legacy register ignores role from body
    const safeRole = 'candidate' // default for generic /register

    const exists = await User.findOne({ email })
    if (exists) return res.status(409).json({ message: 'Email already registered' })

    const user = await User.create({ name, email, password, role: safeRole, company })

    const accessToken  = generateAccessToken(user)
    const refreshToken = generateRefreshToken(user)

    // Persist hashed refresh token
    user.refreshToken = hashToken(refreshToken)
    user.lastLogin    = new Date()
    await user.save({ validateBeforeSave: false })

    logger.info('[Auth] New user registered', { userId: user._id, role: user.role })

    return sessionResponse(res, user, { status: 201, accessToken, refreshToken })
  } catch (err) {
    logger.error('[Auth] Register failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' })

    const user = await User.findOne({ email }).select('+password +refreshToken +loginAttempts +lockUntil')
    if (!user) return res.status(401).json({ message: 'Invalid email or password' })

    // Account lock check
    if (user.isLocked) {
      const remaining = Math.ceil((user.lockUntil - Date.now()) / 60000)
      return res.status(423).json({ message: `Account locked. Try again in ${remaining} minutes.` })
    }

    if (!user.isActive) return res.status(403).json({ message: 'Account deactivated. Contact admin.' })

    const passwordMatch = await user.comparePassword(password)
    if (!passwordMatch) {
      user.loginAttempts += 1
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS)
        logger.warn('[Auth] Account locked due to too many failed attempts', { email })
      }
      await user.save({ validateBeforeSave: false })
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    // Reset lockout on successful login
    user.loginAttempts = 0
    user.lockUntil     = undefined
    user.lastLogin     = new Date()

    const accessToken  = generateAccessToken(user)
    const refreshToken = generateRefreshToken(user)

    user.refreshToken = hashToken(refreshToken)
    await user.save({ validateBeforeSave: false })

    logger.info('[Auth] User logged in', { userId: user._id, role: user.role })

    return sessionResponse(res, user, { accessToken, refreshToken, extra: { company: user.company } })
  } catch (err) {
    logger.error('[Auth] Login failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}

// ── Role-specific registration ─────────────────────────────────────────────

// POST /api/auth/candidate/register
export const candidateRegister = async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required' })

    const exists = await User.findOne({ email })
    if (exists) return res.status(409).json({ message: 'Email already registered' })

    const user = await User.create({ name, email, password, role: 'candidate' })

    const accessToken  = generateAccessToken(user)
    const refreshToken = generateRefreshToken(user)

    user.refreshToken = hashToken(refreshToken)
    user.lastLogin    = new Date()
    await user.save({ validateBeforeSave: false })

    logger.info('[Auth] Candidate registered', { userId: user._id })

    return sessionResponse(res, user, { status: 201, accessToken, refreshToken })
  } catch (err) {
    logger.error('[Auth] candidateRegister failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}

// POST /api/auth/recruiter/register
export const recruiterRegister = async (req, res) => {
  try {
    const { name, email, password, company } = req.body

    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required' })

    const exists = await User.findOne({ email })
    if (exists) return res.status(409).json({ message: 'Email already registered' })

    const user = await User.create({ name, email, password, role: 'recruiter', company })

    const accessToken  = generateAccessToken(user)
    const refreshToken = generateRefreshToken(user)

    user.refreshToken = hashToken(refreshToken)
    user.lastLogin    = new Date()
    await user.save({ validateBeforeSave: false })

    logger.info('[Auth] Recruiter registered', { userId: user._id })

    return sessionResponse(res, user, {
      status: 201, accessToken, refreshToken, extra: { company: user.company },
    })
  } catch (err) {
    logger.error('[Auth] recruiterRegister failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}

// ── Role-specific login ────────────────────────────────────────────────────

// POST /api/auth/candidate/login
export const candidateLogin = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' })

    const user = await User.findOne({ email, role: 'candidate' })
      .select('+password +refreshToken +loginAttempts +lockUntil')
    if (!user) return res.status(401).json({ message: 'Candidate account not found. Check your email or sign up.' })

    if (user.isLocked) {
      const remaining = Math.ceil((user.lockUntil - Date.now()) / 60000)
      return res.status(423).json({ message: `Account locked. Try again in ${remaining} minutes.` })
    }
    if (!user.isActive) return res.status(403).json({ message: 'Account deactivated. Contact admin.' })

    const passwordMatch = await user.comparePassword(password)
    if (!passwordMatch) {
      user.loginAttempts += 1
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS)
      }
      await user.save({ validateBeforeSave: false })
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    user.loginAttempts = 0
    user.lockUntil     = undefined
    user.lastLogin     = new Date()

    const accessToken  = generateAccessToken(user)
    const refreshToken = generateRefreshToken(user)
    user.refreshToken = hashToken(refreshToken)
    await user.save({ validateBeforeSave: false })

    logger.info('[Auth] Candidate logged in', { userId: user._id })

    return sessionResponse(res, user, { accessToken, refreshToken })
  } catch (err) {
    logger.error('[Auth] candidateLogin failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}

// POST /api/auth/recruiter/login
export const recruiterLogin = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' })

    const user = await User.findOne({ email, role: 'recruiter' })
      .select('+password +refreshToken +loginAttempts +lockUntil')
    if (!user) return res.status(401).json({ message: 'Recruiter account not found. Check your email or sign up.' })

    if (user.isLocked) {
      const remaining = Math.ceil((user.lockUntil - Date.now()) / 60000)
      return res.status(423).json({ message: `Account locked. Try again in ${remaining} minutes.` })
    }
    if (!user.isActive) return res.status(403).json({ message: 'Account deactivated. Contact admin.' })

    const passwordMatch = await user.comparePassword(password)
    if (!passwordMatch) {
      user.loginAttempts += 1
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS)
      }
      await user.save({ validateBeforeSave: false })
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    user.loginAttempts = 0
    user.lockUntil     = undefined
    user.lastLogin     = new Date()

    const accessToken  = generateAccessToken(user)
    const refreshToken = generateRefreshToken(user)
    user.refreshToken = hashToken(refreshToken)
    await user.save({ validateBeforeSave: false })

    logger.info('[Auth] Recruiter logged in', { userId: user._id })

    return sessionResponse(res, user, { accessToken, refreshToken, extra: { company: user.company } })
  } catch (err) {
    logger.error('[Auth] recruiterLogin failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}

// POST /api/auth/refresh  — exchange refresh token for new access token
export const refresh = async (req, res) => {
  try {
    // Cookie-first: the browser never has to hold the refresh token in JS.
    const refreshToken = req.body?.refreshToken || req.cookies?.[REFRESH_COOKIE]
    if (!refreshToken) return res.status(400).json({ message: 'Refresh token required' })

    // Verify JWT signature + expiry
    let decoded
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET)
    } catch {
      return res.status(401).json({ message: 'Invalid or expired refresh token' })
    }

    // Find user and compare stored hashed token
    const user = await User.findById(decoded.id).select('+refreshToken')
    if (!user || user.refreshToken !== hashToken(refreshToken))
      return res.status(401).json({ message: 'Refresh token mismatch or revoked' })

    // Issue new token pair (rotation)
    const newAccessToken  = generateAccessToken(user)
    const newRefreshToken = generateRefreshToken(user)

    user.refreshToken = hashToken(newRefreshToken)
    await user.save({ validateBeforeSave: false })

    logger.info('[Auth] Tokens refreshed', { userId: user._id })

    const csrfToken = crypto.randomBytes(24).toString('hex')
    setAuthCookies(res, { accessToken: newAccessToken, refreshToken: newRefreshToken, csrfToken })

    res.json({ tokenTransport: 'cookie', accessToken: newAccessToken, refreshToken: newRefreshToken })
  } catch (err) {
    logger.error('[Auth] Refresh failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}

// POST /api/auth/logout  — invalidate refresh token
export const logout = async (req, res) => {
  try {
    const refreshToken = req.body?.refreshToken || req.cookies?.[REFRESH_COOKIE]

    if (refreshToken) {
      // Revoke the specific refresh token
      const decoded = jwt.decode(refreshToken)
      if (decoded?.id) {
        await User.findByIdAndUpdate(decoded.id, { refreshToken: null }, { validateBeforeSave: false })
        logger.info('[Auth] User logged out', { userId: decoded.id })
      }
    }

    clearAuthCookies(res)
    res.json({ message: 'Logged out successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /api/auth/me
export const getMe = async (req, res) => {
  res.json({
    user: {
      id:        req.user._id,
      name:      req.user.name,
      email:     req.user.email,
      role:      req.user.role,
      company:   req.user.company,
      lastLogin: req.user.lastLogin,
      createdAt: req.user.createdAt,
    }
  })
}

// ── POST /api/auth/forgot-password ─────────────────────────────────────────
// Generates a 1-hour reset token and logs the link (console mode — no SMTP)
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'Email is required' })

    const user = await User.findOne({ email }).select('+resetToken +resetTokenExpiry')
    // Always return 200 so we don't leak user existence
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' })

    // Generate a random 32-byte hex token
    const rawToken = crypto.randomBytes(32).toString('hex')
    user.resetToken       = crypto.createHash('sha256').update(rawToken).digest('hex')
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    await user.save({ validateBeforeSave: false })

    // The raw token is NEVER logged, printed or returned in a response. A reset
    // token in the logs is an account takeover for anyone who can read them.
    // Delivering it requires a mail transport configured through the
    // environment (SMTP/Resend); until one exists the request is recorded
    // without the secret and the response stays generic.
    // Delivery through the configured transport. The raw token only ever
    // travels inside this email — never in a log line or an API response.
    const baseUrl = (
      process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173'
    ).replace(/\/$/, '')
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`

    const delivery = await sendEmail({
      to: user.email,
      ...buildPasswordResetEmail({ name: user.name, resetUrl }),
    })

    logger.info('[Auth] Password reset requested', {
      userId: String(user._id),
      delivered: delivery.ok,
      reason: delivery.reason,
    })

    if (!delivery.ok) {
      logger.warn('[Auth] Reset link could not be delivered', {
        userId: String(user._id),
        mailConfigured: isEmailConfigured(),
        reason: delivery.reason,
      })
    }

    // The response stays identical whether or not the address exists, and
    // whether or not delivery succeeded — no account enumeration, no hint that
    // an email was silently dropped.
    res.json({ message: 'If that email exists, a reset link has been sent.' })
  } catch (err) {
    logger.error('[Auth] forgotPassword failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}

// ── POST /api/auth/reset-password ──────────────────────────────────────────
// Body: { token, password }
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body
    if (!token || !password) return res.status(400).json({ message: 'Token and password are required' })
    if (password.length < 8)  return res.status(400).json({ message: 'Password must be at least 8 characters' })

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const user = await User.findOne({
      resetToken:       hashedToken,
      resetTokenExpiry: { $gt: Date.now() },
    }).select('+resetToken +resetTokenExpiry')

    if (!user) return res.status(400).json({ message: 'Invalid or expired reset token' })

    user.password         = password   // pre-save hook hashes it
    user.resetToken       = undefined
    user.resetTokenExpiry = undefined
    user.loginAttempts    = 0
    user.lockUntil        = undefined
    await user.save()

    logger.info('[Auth] Password reset successful', { userId: user._id })
    res.json({ message: 'Password reset successful. You can now log in.' })
  } catch (err) {
    logger.error('[Auth] resetPassword failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}

// ── GET /api/auth/verify-email/:token ──────────────────────────────────────
// Marks the user's email as verified
export const verifyEmail = async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex')

    const user = await User.findOne({ verifyToken: hashedToken }).select('+verifyToken')
    if (!user) return res.status(400).json({ message: 'Invalid or expired verification link' })

    user.isEmailVerified = true
    user.verifyToken     = undefined
    await user.save({ validateBeforeSave: false })

    logger.info('[Auth] Email verified', { userId: user._id })
    // Redirect to login with success message
    res.redirect(`${process.env.CLIENT_URL}/login?verified=1`)
  } catch (err) {
    logger.error('[Auth] verifyEmail failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}

