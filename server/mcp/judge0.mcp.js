/**
 * judge0.mcp.js
 *
 * MCP tools for code execution via Judge0 CE.
 * Wraps judge0.service for agent consumption.
 */

import { MCPTool, mcpRegistry } from './base.mcp.js'
import { executeCode, LANGUAGES } from '../services/judge0.service.js'

// ── executeCode ───────────────────────────────────────────────────────────────

class ExecuteCodeTool extends MCPTool {
  constructor() {
    super({
      name: 'judge0.executeCode',
      description: 'Execute code against Judge0 CE (or vm sandbox for JS). Returns stdout, stderr, status.',
      parameters: {
        code: 'String — source code to execute',
        language: 'String — language key (javascript, python, java, cpp, etc.)',
        stdin: 'String — optional standard input',
      },
    })
  }

  async _execute({ code, language, stdin = '' }) {
    if (!code) throw new Error('code is required')
    if (!language) throw new Error('language is required')
    if (!LANGUAGES[language]) throw new Error(`Unsupported language: ${language}`)

    return executeCode({ code, languageKey: language, stdin })
  }
}

// ── checkExecution ────────────────────────────────────────────────────────────

class CheckExecutionTool extends MCPTool {
  constructor() {
    super({
      name: 'judge0.checkExecution',
      description: 'Check the status of a previously submitted Judge0 execution by token',
      parameters: {
        token: 'String — Judge0 submission token',
      },
    })
  }

  async _execute({ token }) {
    if (!token) throw new Error('token is required')

    // We use the same service but this tool is mainly for status checks
    // In practice, executeCode already polls to completion
    return { message: 'Use judge0.executeCode — it polls automatically until done', token }
  }
}

// ── getLanguages ──────────────────────────────────────────────────────────────

class GetLanguagesTool extends MCPTool {
  constructor() {
    super({
      name: 'judge0.getLanguages',
      description: 'List all supported programming languages',
      parameters: {},
    })
  }

  async _execute() {
    return Object.entries(LANGUAGES).map(([key, v]) => ({ key, ...v }))
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

export function registerJudge0Tools() {
  mcpRegistry.register(new ExecuteCodeTool())
  mcpRegistry.register(new CheckExecutionTool())
  mcpRegistry.register(new GetLanguagesTool())
}

export default { registerJudge0Tools }
