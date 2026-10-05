/**
 * socket.js — singleton socket.io-client instance
 *
 * Usage:
 *   import { getSocket, disconnectSocket } from './socket'
 *
 * The socket connects to /notifications namespace and authenticates
 * using the stored JWT token. Call connectSocket() after login.
 */

import { io } from 'socket.io-client'

const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'

let socket = null

/**
 * Get or create the socket connection.
 * Authenticates with the current stored token.
 */
export const getSocket = (token) => {
  if (socket?.connected) return socket

  // Disconnect stale socket if exists
  if (socket) {
    socket.disconnect()
    socket = null
  }

  socket = io(`${BASE_URL}/notifications`, {
    auth:        { token },
    transports:  ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay:    2000,
  })

  socket.on('connect', () => {
    console.log('[Socket] Connected to /notifications')
  })

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message)
  })

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason)
  })

  return socket
}

/**
 * Disconnect and clear the socket.
 * Call on logout.
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
    console.log('[Socket] Manually disconnected')
  }
}

export default { getSocket, disconnectSocket }
