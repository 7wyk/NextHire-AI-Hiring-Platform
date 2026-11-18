import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createInterviewAuthMiddleware,
  isInterviewParticipant,
} from '../sockets/interview.socket.js'

const socketWith = (token) => ({ handshake: { auth: token ? { token } : {} }, data: {} })

const runMiddleware = (middleware, socket) => {
  let error = 'next-not-called'
  middleware(socket, (err) => { error = err })
  return error
}

test('an unauthenticated socket is rejected', () => {
  const error = runMiddleware(createInterviewAuthMiddleware(), socketWith(null))
  assert.equal(error?.message, 'Authentication required')
})

test('a socket with a bad token is rejected', () => {
  const middleware = createInterviewAuthMiddleware({
    verifyToken: () => { throw new Error('jwt malformed') },
  })
  const error = runMiddleware(middleware, socketWith('not-a-jwt'))
  assert.equal(error?.message, 'Invalid token')
})

test('a valid token is accepted and identity comes from the token', () => {
  const socket = socketWith('valid')
  const middleware = createInterviewAuthMiddleware({
    // Even if a client sent its own userId, the server uses the token's.
    verifyToken: () => ({ id: 'user-1', role: 'candidate' }),
  })

  const error = runMiddleware(middleware, socket)

  assert.equal(error, undefined)
  assert.equal(socket.data.userId, 'user-1')
  assert.equal(socket.data.role, 'candidate')
})

test('a token cannot inject a mismatched identity', () => {
  const socket = socketWith('valid')
  socket.handshake.auth.userId = 'someone-else'
  socket.handshake.auth.role = 'admin'

  createInterviewAuthMiddleware({
    verifyToken: () => ({ id: 'real-user', role: 'candidate' }),
  })(socket, () => {})

  assert.equal(socket.data.userId, 'real-user')
  assert.equal(socket.data.role, 'candidate')
})

test('only the session candidate, recruiter or an admin can join', () => {
  const session = { candidate: 'cand-1', recruiter: 'rec-1' }

  assert.equal(isInterviewParticipant(session, 'cand-1', 'candidate'), true)
  assert.equal(isInterviewParticipant(session, 'rec-1', 'recruiter'), true)
  assert.equal(isInterviewParticipant(session, 'admin-1', 'admin'), true)

  assert.equal(isInterviewParticipant(session, 'other-1', 'candidate'), false)
  assert.equal(isInterviewParticipant(session, 'other-1', 'recruiter'), false)
  assert.equal(isInterviewParticipant(null, 'cand-1', 'candidate'), false)
  assert.equal(isInterviewParticipant(session, null, 'candidate'), false)
})

test('a second recruiter is not authorised for another recruiter\'s session', () => {
  const session = { candidate: 'cand-1', recruiter: 'rec-1' }
  assert.equal(isInterviewParticipant(session, 'rec-2', 'recruiter'), false)
})
