/**
 * notification.mcp.js
 *
 * MCP tools for real-time notifications via Socket.IO.
 * Agents call these to push updates to users.
 *
 * NOTE: The Socket.IO helpers (pushToUser, broadcastToRecruiters) are
 * injected at boot time via setSocketHelpers(). This decouples the MCP
 * tool from the Express app lifecycle.
 */

import { MCPTool, mcpRegistry } from './base.mcp.js'
import logger from '../config/logger.js'

// ── Socket helpers (injected from index.js) ───────────────────────────────────
let _pushToUser = null
let _broadcastToRecruiters = null

export function setSocketHelpers(pushToUser, broadcastToRecruiters) {
  _pushToUser = pushToUser
  _broadcastToRecruiters = broadcastToRecruiters
  logger.info('[MCP/Notification] Socket helpers injected')
}

// ── sendNotification ──────────────────────────────────────────────────────────

class SendNotificationTool extends MCPTool {
  constructor() {
    super({
      name: 'notification.send',
      description: 'Push a real-time notification to a specific user via Socket.IO',
      parameters: {
        userId: 'String — target user ID',
        event: 'String — event name (e.g. "resume-screened", "test-submitted")',
        payload: 'Object — notification data',
      },
    })
  }

  async _execute({ userId, event, payload = {} }) {
    if (!userId) throw new Error('userId is required')
    if (!event) throw new Error('event is required')

    if (!_pushToUser) {
      logger.warn('[MCP/Notification] Socket not initialized — notification queued only')
      return { sent: false, reason: 'Socket.IO not yet initialized' }
    }

    _pushToUser(String(userId), event, payload)
    return { sent: true, userId, event }
  }
}

// ── broadcastToRecruiters ─────────────────────────────────────────────────────

class BroadcastTool extends MCPTool {
  constructor() {
    super({
      name: 'notification.broadcast',
      description: 'Broadcast a notification to all connected recruiters',
      parameters: {
        event: 'String — event name',
        payload: 'Object — notification data',
      },
    })
  }

  async _execute({ event, payload = {} }) {
    if (!event) throw new Error('event is required')

    if (!_broadcastToRecruiters) {
      logger.warn('[MCP/Notification] Socket not initialized — broadcast skipped')
      return { sent: false, reason: 'Socket.IO not yet initialized' }
    }

    _broadcastToRecruiters(event, payload)
    return { sent: true, event }
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

export function registerNotificationTools() {
  mcpRegistry.register(new SendNotificationTool())
  mcpRegistry.register(new BroadcastTool())
}

export default { registerNotificationTools, setSocketHelpers }
