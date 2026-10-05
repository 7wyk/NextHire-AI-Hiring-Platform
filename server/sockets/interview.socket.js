/**
 * interview.socket.js
 * Real-time Socket.IO handlers for AI interview sessions.
 * Attach to io via: registerInterviewSockets(io)
 */
import logger from '../config/logger.js'

export const registerInterviewSockets = (io) => {
  const interviewNS = io.of('/interview')

  interviewNS.on('connection', (socket) => {
    logger.info('[Socket/Interview] Client connected', { socketId: socket.id })

    // ── Join a session room ───────────────────────────────────────────────
    socket.on('join-session', ({ sessionId, userId, role }) => {
      socket.join(sessionId)
      socket.data = { sessionId, userId, role }

      // Notify room participant joined
      socket.to(sessionId).emit('participant-joined', { userId, role, socketId: socket.id })
      logger.info('[Socket/Interview] Joined session', { sessionId, userId, role })
    })

    // ── Typing indicator ──────────────────────────────────────────────────
    socket.on('typing-start', ({ sessionId }) => {
      socket.to(sessionId).emit('interviewer-typing', { typing: true })
    })

    socket.on('typing-stop', ({ sessionId }) => {
      socket.to(sessionId).emit('interviewer-typing', { typing: false })
    })

    // ── Candidate sends a message ─────────────────────────────────────────
    socket.on('candidate-message', ({ sessionId, message, timestamp }) => {
      // Broadcast to recruiters/observers in the room
      socket.to(sessionId).emit('new-candidate-message', {
        message,
        timestamp: timestamp || new Date().toISOString(),
        senderId: socket.data.userId,
      })
      logger.info('[Socket/Interview] Candidate message', { sessionId })
    })

    // ── AI question delivered to candidate ────────────────────────────────
    socket.on('ai-question', ({ sessionId, question, questionIndex }) => {
      interviewNS.to(sessionId).emit('receive-question', { question, questionIndex })
      logger.info('[Socket/Interview] AI question sent', { sessionId, questionIndex })
    })

    // ── Session complete ──────────────────────────────────────────────────
    socket.on('session-complete', ({ sessionId, summary }) => {
      interviewNS.to(sessionId).emit('interview-finished', {
        summary,
        completedAt: new Date().toISOString(),
      })
      logger.info('[Socket/Interview] Session complete', { sessionId })
    })

    // ── Score update ──────────────────────────────────────────────────────
    socket.on('score-update', ({ sessionId, scores }) => {
      socket.to(sessionId).emit('live-scores', scores)
    })

    // ── Alias: code-change → broadcasts live code to session room ─────────
    // Compatibility alias for simple clients.  Does NOT rename the existing
    // score-update / live-scores events — both continue to work as before.
    socket.on('code-change', ({ sessionId, code, language }) => {
      socket.to(sessionId).emit('code-change', {
        code,
        language,
        senderId: socket.data.userId,
        timestamp: new Date().toISOString(),
      })
    })

    // ── Disconnect ────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const { sessionId, userId } = socket.data || {}
      if (sessionId) {
        socket.to(sessionId).emit('participant-left', { userId, socketId: socket.id })
      }
      logger.info('[Socket/Interview] Client disconnected', { socketId: socket.id })
    })
  })
}
