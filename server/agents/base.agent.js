/**
 * base.agent.js
 *
 * Base class for all agents in the NextHire AI v2 multi-agent system.
 *
 * Provides:
 *   - State management (idle → processing → using_tool → completed/error)
 *   - MCP tool access via the shared registry
 *   - LLM invocation helpers
 *   - Task history tracking
 *   - Memory integration hooks
 */

import logger from '../config/logger.js'
import { mcpRegistry } from '../mcp/base.mcp.js'

// ── Agent status enum ─────────────────────────────────────────────────────────
export const AgentStatus = {
  IDLE:       'idle',
  PROCESSING: 'processing',
  USING_TOOL: 'using_tool',
  COMPLETED:  'completed',
  ERROR:      'error',
}

export class BaseAgent {
  /**
   * @param {object} opts
   * @param {string} opts.name         - Agent identifier
   * @param {string} opts.description  - What this agent does
   * @param {string[]} opts.tools      - MCP tool names this agent can use
   */
  constructor({ name, description, tools = [] }) {
    this.name = name
    this.description = description
    this.allowedTools = tools

    // State
    this.status = AgentStatus.IDLE
    this.currentTask = null
    this.currentTool = null
    this.lastResult = null
    this.lastError = null

    // History
    this.taskHistory = []
    this.maxHistory = 50

    // Metrics
    this.totalTasks = 0
    this.successCount = 0
    this.errorCount = 0
    this.startedAt = new Date()
  }

  // ── State transitions ───────────────────────────────────────────────────────

  _setStatus(status, detail = null) {
    const prev = this.status
    this.status = status
    if (detail) this.currentTask = detail
    logger.info(`[Agent:${this.name}] ${prev} → ${status}`, { detail })
  }

  // ── Tool access ─────────────────────────────────────────────────────────────

  /**
   * Execute an MCP tool by name.
   * Only tools listed in this.allowedTools can be called.
   */
  async useTool(toolName, params = {}) {
    if (!this.allowedTools.includes(toolName)) {
      throw new Error(`Agent ${this.name} is not authorized to use tool: ${toolName}`)
    }

    this._setStatus(AgentStatus.USING_TOOL, `Using ${toolName}`)
    this.currentTool = toolName

    const result = await mcpRegistry.execute(toolName, params)

    this.currentTool = null
    return result
  }

  // ── Main execution pipeline ─────────────────────────────────────────────────

  /**
   * Process a task. Subclasses override _process().
   * This wrapper manages state, history, and error handling.
   *
   * @param {object} task - Task payload
   * @returns {Promise<object>} - Result
   */
  async process(task) {
    const taskId = `${this.name}-${Date.now()}`
    const startTime = Date.now()
    this.totalTasks++

    this._setStatus(AgentStatus.PROCESSING, task.type || 'unknown')

    try {
      const result = await this._process(task)
      const duration = Date.now() - startTime

      this.successCount++
      this.lastResult = result
      this.lastError = null
      this._setStatus(AgentStatus.COMPLETED)

      // Record in history
      this._addToHistory({
        taskId,
        type: task.type,
        status: 'success',
        duration,
        timestamp: new Date(),
      })

      logger.info(`[Agent:${this.name}] Task completed`, {
        taskId, type: task.type, duration: `${duration}ms`,
      })

      // Reset to idle after a brief moment
      setTimeout(() => {
        if (this.status === AgentStatus.COMPLETED) {
          this._setStatus(AgentStatus.IDLE)
        }
      }, 2000)

      return {
        success: true,
        agent: this.name,
        taskId,
        data: result,
        duration,
      }
    } catch (err) {
      const duration = Date.now() - startTime
      this.errorCount++
      this.lastError = err.message
      this._setStatus(AgentStatus.ERROR, err.message)

      this._addToHistory({
        taskId,
        type: task.type,
        status: 'error',
        error: err.message,
        duration,
        timestamp: new Date(),
      })

      logger.error(`[Agent:${this.name}] Task failed`, {
        taskId, type: task.type, error: err.message,
      })

      // Reset to idle after error
      setTimeout(() => {
        if (this.status === AgentStatus.ERROR) {
          this._setStatus(AgentStatus.IDLE)
        }
      }, 5000)

      return {
        success: false,
        agent: this.name,
        taskId,
        error: err.message,
        duration,
      }
    }
  }

  /**
   * Override in subclass — the actual task logic.
   * @param {object} task
   * @returns {Promise<any>}
   */
  async _process(task) {
    throw new Error(`BaseAgent._process() not implemented for ${this.name}`)
  }

  // ── History management ──────────────────────────────────────────────────────

  _addToHistory(entry) {
    this.taskHistory.unshift(entry)
    if (this.taskHistory.length > this.maxHistory) {
      this.taskHistory = this.taskHistory.slice(0, this.maxHistory)
    }
  }

  // ── Status reporting ────────────────────────────────────────────────────────

  /** Full status object for monitoring dashboards */
  getStatus() {
    return {
      name: this.name,
      description: this.description,
      status: this.status,
      currentTask: this.currentTask,
      currentTool: this.currentTool,
      metrics: {
        totalTasks: this.totalTasks,
        successCount: this.successCount,
        errorCount: this.errorCount,
        successRate: this.totalTasks > 0
          ? Math.round((this.successCount / this.totalTasks) * 100)
          : 100,
      },
      lastResult: this.lastResult ? { success: true } : null,
      lastError: this.lastError,
      recentHistory: this.taskHistory.slice(0, 5),
      allowedTools: this.allowedTools,
      startedAt: this.startedAt,
    }
  }
}

export default BaseAgent
