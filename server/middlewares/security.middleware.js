/**
 * security.middleware.js
 *
 * Small, dependency-free guards applied to every request:
 *   - NoSQL operator stripping (`$where`, `$ne`, dotted keys) in body/query/params
 *   - ObjectId validation for route params that address a document
 *   - Cross-site mutation rejection for cookie-authenticated requests (CSRF)
 */

import mongoose from 'mongoose'
import { CSRF_COOKIE } from '../config/cookies.js'

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const isPlainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype

/**
 * Recursively remove keys that Mongo would interpret as operators.
 * `{ email: { $ne: null } }` becomes `{ email: {} }`, which matches nothing.
 */
export const stripMongoOperators = (input) => {
  if (Array.isArray(input)) return input.map(stripMongoOperators)
  if (!isPlainObject(input)) return input

  const output = {}
  for (const [key, value] of Object.entries(input)) {
    if (key.startsWith('$') || key.includes('.')) continue
    output[key] = stripMongoOperators(value)
  }
  return output
}

export const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') req.body = stripMongoOperators(req.body)
  if (req.query && typeof req.query === 'object') {
    const clean = stripMongoOperators(req.query)
    // req.query may be a getter-only property on some Express versions
    try { req.query = clean } catch { /* ignore read-only query */ }
  }
  if (req.params && typeof req.params === 'object') req.params = stripMongoOperators(req.params)
  next()
}

/** Reject malformed :id params before they reach a Mongoose cast error. */
export const requireObjectId = (param = 'id') => (req, res, next) => {
  const value = req.params?.[param]
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({ message: `Invalid ${param}` })
  }
  next()
}

/**
 * Double-submit CSRF protection.
 *
 * Only applies when the request is authenticated by the auth cookie (browsers).
 * Requests carrying an `Authorization: Bearer` header are not vulnerable to
 * CSRF because a cross-site page cannot set that header.
 */
export const csrfProtection = (req, res, next) => {
  if (!UNSAFE_METHODS.has(req.method)) return next()
  if (req.headers.authorization) return next()
  if (!req.cookies?.nh_access) return next()
  if (req.path.startsWith('/api/auth/')) return next() // login/refresh/register

  const header = req.headers['x-csrf-token']
  const cookie = req.cookies?.[CSRF_COOKIE]

  if (!header || !cookie || header !== cookie) {
    return res.status(403).json({ message: 'Invalid or missing CSRF token' })
  }
  next()
}
