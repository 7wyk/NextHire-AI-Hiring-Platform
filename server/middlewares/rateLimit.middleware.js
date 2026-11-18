/**
 * rateLimit.middleware.js
 *
 * One global limiter for everything made legitimate polling (the agent monitor
 * polls every 5s) exhaust the shared budget and lock real users out with 429s.
 *
 * Limits are per route class and keyed by user id when authenticated, falling
 * back to IP for anonymous traffic. Every number can be overridden from the
 * environment without a code change.
 */

import rateLimit from 'express-rate-limit'

const num = (value, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const MINUTE = 60 * 1000

/** windowMs / max per limiter. Exported so tests can assert the policy. */
export const RATE_LIMITS = Object.freeze({
  global:           { windowMs: 15 * MINUTE, max: num(process.env.RATE_LIMIT_GLOBAL_MAX, 2000) },
  auth:             { windowMs: 15 * MINUTE, max: num(process.env.RATE_LIMIT_AUTH_MAX, 20) },
  passwordReset:    { windowMs: 60 * MINUTE, max: num(process.env.RATE_LIMIT_PASSWORD_RESET_MAX, 5) },
  ai:               { windowMs: 15 * MINUTE, max: num(process.env.RATE_LIMIT_AI_MAX, 60) },
  resumeScreen:     { windowMs: 15 * MINUTE, max: num(process.env.RATE_LIMIT_RESUME_MAX, 40) },
  codingExecution:  { windowMs: 15 * MINUTE, max: num(process.env.RATE_LIMIT_CODE_MAX, 240) },
  interview:        { windowMs: 15 * MINUTE, max: num(process.env.RATE_LIMIT_INTERVIEW_MAX, 150) },
  agentMonitor:     { windowMs: 15 * MINUTE, max: num(process.env.RATE_LIMIT_AGENT_MAX, 1200) },
  upload:           { windowMs: 15 * MINUTE, max: num(process.env.RATE_LIMIT_UPLOAD_MAX, 30) },
})

const keyFor = (req) =>
  req.user?._id ? `user:${req.user._id}` : `ip:${req.ip}`

const make = ({ windowMs, max }, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // Users are keyed individually, so successful requests from a shared
    // campus/office IP never spend each other's allowance.
    keyGenerator: keyFor,
    message: { message },
  })

/** Broad safety net — high enough that normal polling never reaches it. */
export const globalLimiter = make(RATE_LIMITS.global, 'Too many requests — slow down.')

/** Sign-in / registration. Tight: this is the brute-force surface. */
export const authLimiter = make(RATE_LIMITS.auth, 'Too many authentication attempts. Try again later.')

/** Password reset requests and submissions. */
export const passwordResetLimiter = make(
  RATE_LIMITS.passwordReset,
  'Too many password reset attempts. Try again later.'
)

/** Anything that spends AI tokens (screening, generation, evaluation). */
export const aiLimiter = make(RATE_LIMITS.ai, 'Too many AI operations. Please wait a moment.')

/** Resume upload + screening. */
export const resumeScreenLimiter = make(
  RATE_LIMITS.resumeScreen,
  'Too many resume operations. Please wait a moment.'
)

/** Code execution — each run spawns or calls an external executor. */
export const codingExecutionLimiter = make(
  RATE_LIMITS.codingExecution,
  'Too many code executions. Please wait a moment.'
)

/** Interview messaging and session operations. */
export const interviewLimiter = make(
  RATE_LIMITS.interview,
  'Too many interview operations. Please wait a moment.'
)

/**
 * Agent monitor polling. Keyed per user and deliberately generous: the
 * dashboard polls every 5s (≈180 requests / 15 min).
 */
export const agentMonitorLimiter = make(RATE_LIMITS.agentMonitor, 'Agent polling limit reached.')

/** File uploads. */
export const uploadLimiter = make(RATE_LIMITS.upload, 'Too many uploads. Please wait a moment.')
