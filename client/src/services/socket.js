/**
 * socket.js — singleton socket.io-client instance
 *
 * Usage:
 *   import { getSocket, disconnectSocket } from './socket'
 *
 * The socket connects to the /notifications namespace and authenticates with
 * the same HttpOnly session cookie the REST API uses — no token is available
 * to JavaScript (SEC-04), so `withCredentials` carries the session instead.
 */

import { io } from 'socket.io-client'

const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'

let socket = null

/**
 * Get or create the socket connection.
 * The handshake carries the session cookie; the server verifies it.
 */
export const getSocket = () => {
  if (socket?.connected) return socket

  // Disconnect stale socket if exists
  if (socket) {
    socket.disconnect()
    socket = null
  }

  socket = io(`${BASE_URL}/notifications`, {
    withCredentials: true,
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
