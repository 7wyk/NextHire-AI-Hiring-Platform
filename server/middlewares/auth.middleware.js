import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { ACCESS_COOKIE, parseCookies } from '../config/cookies.js'

/**
 * Resolve the access token from a Bearer header (API clients, tests) or from
 * the HttpOnly session cookie (browser). Cookie auth is the preferred browser
 * path: JS — and therefore XSS — cannot read the token.
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return { token: authHeader.slice(7).trim(), source: 'bearer' }
  }

  const cookies = req.cookies || parseCookies(req.headers.cookie)
  if (cookies?.[ACCESS_COOKIE]) {
    return { token: cookies[ACCESS_COOKIE], source: 'cookie' }
  }

  return { token: null, source: null }
}

export const protect = async (req, res, next) => {
  try {
    const { token, source } = extractToken(req)
    if (!token) {
      return res.status(401).json({ message: 'Not authorized. No token.' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await User.findById(decoded.id).select('-password')
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive.' })
    }

    req.user = user
    req.authSource = source
    next()
  } catch (err) {
    // An expired cookie should not look like a hard logout to the client; it
    // refreshes through /api/auth/refresh and retries.
    return res.status(401).json({ message: 'Token invalid or expired.' })
  }
}

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized.' })
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: `Role '${req.user.role}' is not authorized.` })
  }
  next()
}

/**
 * Allow the resource owner, or any of the listed staff roles.
 * Used where a candidate may read/write only their own document.
 */
export const authorizeOwnerOr = (roles, getOwnerId) => async (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authorized.' })
  if (roles.includes(req.user.role)) return next()

  try {
    const ownerId = await getOwnerId(req)
    if (ownerId && String(ownerId) === String(req.user._id)) return next()
  } catch { /* fall through to 403 */ }

  return res.status(403).json({ message: 'Access denied' })
}
