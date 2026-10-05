/**
 * base.mcp.js
 *
 * Model Context Protocol (MCP) Tool base class.
 * All MCP tools extend this to provide a standardized interface
 * for agents to interact with external services.
 *
 * Each tool has:
 *   - name, description, parameters schema
 *   - execute() method that wraps the underlying service call
 *   - Built-in logging, timing, and error handling
 */

import logger from '../config/logger.js'

export class MCPTool {
  /**
   * @param {object} opts
   * @param {string} opts.name         - Tool identifier (e.g. 'mongodb.getCandidate')
   * @param {string} opts.description  - Human-readable description
   * @param {object} opts.parameters   - JSON-schema-like parameter definitions
   */
  constructor({ name, description, parameters = {} }) {
    this.name = name
    this.description = description
    this.parameters = parameters
    this.executionCount = 0
    this.lastExecutedAt = null
    this.lastError = null
  }

  /**
   * Execute the tool. Subclasses override _execute().
   * This wrapper adds logging, timing, and error normalization.
   */
  async execute(params = {}) {
    const startTime = Date.now()
    this.executionCount++

    logger.info(`[MCP] ${this.name} — executing`, {
      params: Object.keys(params),
      executionCount: this.executionCount,
    })

    try {
      const result = await this._execute(params)
      const duration = Date.now() - startTime
      this.lastExecutedAt = new Date()
      this.lastError = null

      logger.info(`[MCP] ${this.name} — completed`, { duration: `${duration}ms` })

      return {
        success: true,
        data: result,
        tool: this.name,
        duration,
      }
    } catch (err) {
      const duration = Date.now() - startTime
      this.lastError = err.message
      this.lastExecutedAt = new Date()

      logger.error(`[MCP] ${this.name} — failed`, {
        error: err.message,
        duration: `${duration}ms`,
      })

      return {
        success: false,
        error: err.message,
        tool: this.name,
        duration,
      }
    }
  }

  /**
   * Override in subclass — the actual tool logic.
   * @param {object} params
   * @returns {Promise<any>}
   */
  async _execute(params) {
    throw new Error(`MCPTool._execute() not implemented for ${this.name}`)
  }

  /** Tool metadata for agent consumption */
  describe() {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
      stats: {
        executionCount: this.executionCount,
        lastExecutedAt: this.lastExecutedAt,
        lastError: this.lastError,
      },
    }
  }
}

/**
 * MCP Tool Registry — agents look up tools by name here.
 */
export class MCPRegistry {
  constructor() {
    /** @type {Map<string, MCPTool>} */
    this.tools = new Map()
  }

  /** Register a tool instance */
  register(tool) {
    if (!(tool instanceof MCPTool)) {
      throw new Error('Only MCPTool instances can be registered')
    }
    this.tools.set(tool.name, tool)
    logger.info(`[MCP Registry] Registered tool: ${tool.name}`)
  }

  /** Get a tool by name */
  getTool(name) {
    return this.tools.get(name) || null
  }

  /** Execute a tool by name */
  async execute(name, params = {}) {
    const tool = this.tools.get(name)
    if (!tool) {
      return { success: false, error: `Tool not found: ${name}` }
    }
    return tool.execute(params)
  }

  /** List all registered tools (for agent introspection) */
  listTools() {
    return Array.from(this.tools.values()).map(t => t.describe())
  }

  /** Get stats for all tools */
  getStats() {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      executionCount: t.executionCount,
      lastExecutedAt: t.lastExecutedAt,
      lastError: t.lastError,
    }))
  }
}

// Singleton registry — shared across the entire server
export const mcpRegistry = new MCPRegistry()

export default { MCPTool, MCPRegistry, mcpRegistry }
