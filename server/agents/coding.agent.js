/**
 * coding.agent.js
 *
 * Specialized agent for coding assessments.
 * Handles: question generation, code execution, quality analysis.
 */

import { BaseAgent } from './base.agent.js'
import { generateCodingQuestions, evaluateCode } from '../services/ai.service.js'
import logger from '../config/logger.js'

class CodingAgent extends BaseAgent {
  constructor() {
    super({
      name: 'CodingAgent',
      description: 'Generates coding questions, executes code via Judge0, and analyzes code quality',
      tools: [
        'judge0.executeCode',
        'judge0.getLanguages',
        'mongodb.getJob',
        'mongodb.saveScore',
        'notification.send',
      ],
    })
  }

  async _process(task) {
    switch (task.type) {
      case 'generate-questions':
        return this._generateQuestions(task)
      case 'execute-code':
        return this._executeCode(task)
      case 'evaluate-code':
        return this._evaluateCode(task)
      case 'run-test-cases':
        return this._runTestCases(task)
      default:
        throw new Error(`CodingAgent: unknown task type "${task.type}"`)
    }
  }

  /** Generate DSA coding questions for a role */
  async _generateQuestions(task) {
    const { role, difficulty = 'medium', count = 3 } = task
    return generateCodingQuestions(role, difficulty, count)
  }

  /** Execute code via Judge0 MCP tool */
  async _executeCode(task) {
    const { code, language, stdin = '' } = task
    const result = await this.useTool('judge0.executeCode', { code, language, stdin })
    if (!result.success) throw new Error(result.error)
    return result.data
  }

  /** AI code quality evaluation */
  async _evaluateCode(task) {
    const { code, question, language = 'javascript' } = task
    return evaluateCode(code, question, language)
  }

  /** Run code against multiple test cases */
  async _runTestCases(task) {
    const { code, language, testCases } = task
    const results = []
    let passed = 0

    for (const tc of testCases) {
      try {
        const execResult = await this.useTool('judge0.executeCode', {
          code,
          language,
          stdin: tc.input || '',
        })

        if (!execResult.success) {
          results.push({
            input: tc.input,
            expected: tc.output || tc.expectedOutput,
            actual: `Error: ${execResult.error}`,
            passed: false,
          })
          continue
        }

        const actual = (execResult.data.stdout || '').trim()
        const expected = String(tc.output || tc.expectedOutput || '').trim()
        const isPass = execResult.data.accepted && actual === expected

        if (isPass) passed++
        results.push({
          input: tc.input,
          expected,
          actual,
          passed: isPass,
          time: execResult.data.time,
          memory: execResult.data.memory,
        })
      } catch (err) {
        results.push({
          input: tc.input,
          expected: tc.output || tc.expectedOutput,
          actual: `Error: ${err.message}`,
          passed: false,
        })
      }
    }

    return {
      results,
      passed,
      total: testCases.length,
      passRate: testCases.length > 0 ? Math.round((passed / testCases.length) * 100) : 0,
    }
  }
}

export const codingAgent = new CodingAgent()
export default codingAgent
