/**
 * notification.socket.js
 * Real-time push notifications for recruiters & candidates.
 * Namespace: /notifications
 *
 * Auth: the JWT is accepted from `handshake.auth.token` (API clients) or from
 * the `nh_access` HttpOnly cookie the browser sends with the handshake (the
 * cookie is the browser's only credential since SEC-04).
 * Server verifies it and auto-registers the user.
 */
import jwt from 'jsonwebtoken'
import logger from '../config/logger.js'
import { ACCESS_COOKIE, parseCookies } from '../config/cookies.js'

// In-memory map: userId → Set of socketIds (multi-tab support)
const userSockets = new Map()

export const registerNotificationSockets = (io) => {
  const ns = io.of('/notifications')

  // ── JWT auth middleware on namespace ──────────────────────────────────────
  ns.use((socket, next) => {
    const cookies = parseCookies(socket.handshake.headers?.cookie || '')
    const token = socket.handshake.auth?.token || cookies?.[ACCESS_COOKIE]
    if (!token) return next(new Error('Authentication required'))

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      socket.data.userId = String(decoded.id)
      socket.data.role   = decoded.role
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  ns.on('connection', (socket) => {
    const { userId, role } = socket.data

    // Auto-join personal room (no manual register event needed)
    socket.join(`user:${userId}`)
    if (userId) {
      if (!userSockets.has(userId)) userSockets.set(userId, new Set())
      userSockets.get(userId).add(socket.id)
    }

    logger.info('[Socket/Notify] User connected', { userId, role, socketId: socket.id })

    socket.on('disconnect', () => {
      if (userId && userSockets.has(userId)) {
        userSockets.get(userId).delete(socket.id)
        if (userSockets.get(userId).size === 0) userSockets.delete(userId)
      }
      logger.info('[Socket/Notify] User disconnected', { userId, socketId: socket.id })
    })
  })

  // ── Exported helpers called from controllers ──────────────────────────────

  /**
   * Push event to a specific user (by userId string).
   * Works across multiple browser tabs.
   */
  const pushToUser = (userId, event, payload) => {
    ns.to(`user:${userId}`).emit(event, {
      ...payload,
      timestamp: new Date().toISOString(),
    })
    logger.info('[Socket/Notify] pushToUser', { userId, event })
  }

  /**
   * Broadcast to all connected users in the namespace.
   */
  const broadcastToRecruiters = (event, payload) => {
    ns.emit(event, { ...payload, timestamp: new Date().toISOString() })
  }

  return { pushToUser, broadcastToRecruiters, userSockets }
}
