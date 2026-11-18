/**
 * interview.socket.js
 * Real-time Socket.IO handlers for AI interview sessions.
 * Attach to io via: registerInterviewSockets(io)
 *
 * Access control (mirrors /notifications):
 *   1. Every connection must present a JWT in `handshake.auth.token`, or carry
 *      the `nh_access` HttpOnly cookie the browser uses for REST calls.
 *   2. `join-session` is authorised against the InterviewSession itself: only
 *      its candidate, its recruiter, or an admin may join.
 *   3. Event payloads cannot pick a room — the room is whatever the socket was
 *      authorised to join.
 *   4. Score-bearing events are recruiter/admin only, so a candidate can never
 *      read or inject evaluation data for an interview.
 */

import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import InterviewSession from '../models/InterviewSession.js'
import logger from '../config/logger.js'
import { ACCESS_COOKIE, parseCookies } from '../config/cookies.js'

const RECRUITER_ROLES = ['recruiter', 'admin']

/** Load only the ownership fields needed to authorise a room. */
export const loadInterviewSession = async (sessionId) => {
  if (!sessionId || !mongoose.isValidObjectId(String(sessionId))) return null
  return InterviewSession.findById(sessionId).select('candidate recruiter').lean()
}

/** True when this user is an authorised participant of that session. */
export const isInterviewParticipant = (session, userId, role) => {
  if (!session || !userId) return false
  if (role === 'admin') return true
  return (
    String(session.candidate) === String(userId) ||
    String(session.recruiter) === String(userId)
  )
}

/**
 * Namespace auth middleware. Exported as a factory so it can be unit tested
 * without a live server or database.
 */
export const createInterviewAuthMiddleware = ({
  verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET),
} = {}) => (socket, next) => {
  const cookies = parseCookies(socket.handshake?.headers?.cookie || '')
  const token = socket.handshake?.auth?.token || cookies?.[ACCESS_COOKIE]

  if (!token) return next(new Error('Authentication required'))

  try {
    const decoded = verifyToken(token)
    socket.data = {
      ...(socket.data || {}),
      userId: String(decoded.id),
      role: decoded.role,
    }
    return next()
  } catch {
    return next(new Error('Invalid token'))
  }
}

const deny = (socket, code, message) => {
  socket.emit('interview-error', { code, message })
  logger.warn('[Socket/Interview] Access denied', {
    code,
    userId: socket.data?.userId,
    role: socket.data?.role,
  })
}

export const registerInterviewSockets = (io) => {
  const interviewNS = io.of('/interview')

  interviewNS.use(createInterviewAuthMiddleware())

  interviewNS.on('connection', (socket) => {
    logger.info('[Socket/Interview] Client connected', {
      socketId: socket.id,
      userId: socket.data?.userId,
      role: socket.data?.role,
    })

    // ── Join a session room (authorised against the session document) ─────
    socket.on('join-session', async ({ sessionId } = {}) => {
      try {
        const session = await loadInterviewSession(sessionId)

        if (!session) {
          return deny(socket, 'session_not_found', 'Interview session not found')
        }

        if (!isInterviewParticipant(session, socket.data.userId, socket.data.role)) {
          return deny(socket, 'forbidden', 'You are not a participant in this interview')
        }

        // Leave any previously joined room before switching
        if (socket.data.sessionId && socket.data.sessionId !== String(session._id)) {
          socket.leave(socket.data.sessionId)
        }

        const room = String(session._id)
        socket.join(room)
        socket.data.sessionId = room

        socket.to(room).emit('participant-joined', {
          userId: socket.data.userId,
          role: socket.data.role,
          socketId: socket.id,
        })

        socket.emit('session-joined', { sessionId: room, role: socket.data.role })

        logger.info('[Socket/Interview] Joined session', {
          sessionId: room,
          userId: socket.data.userId,
          role: socket.data.role,
        })
      } catch (err) {
        logger.error('[Socket/Interview] join-session failed', { error: err.message })
        deny(socket, 'join_failed', 'Could not join the interview session')
      }
    })

    // Every room-scoped event resolves its room from the socket, never payload.
    const withRoom = (handler) => (payload = {}) => {
      const room = socket.data?.sessionId
      if (!room) return deny(socket, 'not_in_session', 'Join an interview session first')
      if (payload?.sessionId && String(payload.sessionId) !== room) {
        return deny(socket, 'forbidden', 'Session does not match the joined room')
      }
      return handler(room, payload)
    }

    const withRecruiterRoom = (handler) => withRoom((room, payload) => {
      if (!RECRUITER_ROLES.includes(socket.data?.role)) {
        return deny(socket, 'forbidden', 'Only the interviewer can do that')
      }
      return handler(room, payload)
    })

    // ── Typing indicator ──────────────────────────────────────────────────
    socket.on('typing-start', withRoom((room) => {
      socket.to(room).emit('interviewer-typing', { typing: true })
    }))

    socket.on('typing-stop', withRoom((room) => {
      socket.to(room).emit('interviewer-typing', { typing: false })
    }))

    // ── Candidate sends a message ─────────────────────────────────────────
    socket.on('candidate-message', withRoom((room, { message, timestamp }) => {
      socket.to(room).emit('new-candidate-message', {
        message,
        timestamp: timestamp || new Date().toISOString(),
        senderId: socket.data.userId,
      })
    }))

    // ── AI question delivered to candidate (interviewer only) ─────────────
    socket.on('ai-question', withRecruiterRoom((room, { question, questionIndex }) => {
      interviewNS.to(room).emit('receive-question', { question, questionIndex })
    }))

    // ── Session complete (interviewer only) ───────────────────────────────
    socket.on('session-complete', withRecruiterRoom((room, { summary }) => {
      interviewNS.to(room).emit('interview-finished', {
        summary,
        completedAt: new Date().toISOString(),
      })
    }))

    // ── Score updates are never broadcast to candidates ───────────────────
    socket.on('score-update', withRecruiterRoom((room, { scores }) => {
      interviewNS.to(room).emit('live-scores', scores)
    }))

    // ── Live code sharing between authorised participants ────────────────
    socket.on('code-change', withRoom((room, { code, language }) => {
      socket.to(room).emit('code-change', {
        code,
        language,
        senderId: socket.data.userId,
        timestamp: new Date().toISOString(),
      })
    }))

    socket.on('disconnect', () => {
      const { sessionId, userId } = socket.data || {}
      if (sessionId) {
        socket.to(sessionId).emit('participant-left', { userId, socketId: socket.id })
      }
      logger.info('[Socket/Interview] Client disconnected', { socketId: socket.id })
    })
  })
}
