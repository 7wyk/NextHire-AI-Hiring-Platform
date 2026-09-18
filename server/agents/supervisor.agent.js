/**
 * supervisor.agent.js
 *
 * Central orchestrator for the multi-agent system.
 * Receives tasks, decides which specialized agent should execute,
 * coordinates multi-step workflows, and maintains global state.
 */

import { BaseAgent, AgentStatus } from './base.agent.js'
import { resumeAgent } from './resume.agent.js'
import { interviewAgent } from './interview.agent.js'
import { codingAgent } from './coding.agent.js'
import { rankingAgent } from './ranking.agent.js'
import { notificationAgent } from './notification.agent.js'
import logger from '../config/logger.js'

// ── Agent registry ────────────────────────────────────────────────────────────

const agents = {
  resume:       resumeAgent,
  interview:    interviewAgent,
  coding:       codingAgent,
  ranking:      rankingAgent,
  notification: notificationAgent,
}

// ── Task routing map ──────────────────────────────────────────────────────────
// Maps task types to the agent responsible for handling them

const TASK_ROUTES = {
  // Resume tasks → ResumeAgent
  'screen-resume':           'resume',
  'extract-text':            'resume',
  'analyze-resume':          'resume',

  // Interview tasks → InterviewAgent
  'start-interview':         'interview',
  'continue-interview':      'interview',
  'evaluate-answer':         'interview',
  'generate-summary':        'interview',
  'generate-questions':      'interview',
  'evaluate-candidate-answer': 'interview',

  // Coding tasks → CodingAgent
  'generate-coding-questions': 'coding',
  'execute-code':            'coding',
  'evaluate-code':           'coding',
  'run-test-cases':          'coding',

  // Ranking tasks → RankingAgent
  'rank-candidates':         'ranking',
  'compare-candidates':      'ranking',
  'generate-recommendation': 'ranking',

  // Notification tasks → NotificationAgent
  'notify-recruiter':        'notification',
  'notify-candidate':        'notification',
  'broadcast':               'notification',
  'resume-screened':         'notification',
  'test-submitted':          'notification',
  'interview-completed':     'notification',
}

class SupervisorAgent extends BaseAgent {
  constructor() {
    super({
      name: 'SupervisorAgent',
      description: 'Central orchestrator that routes tasks to specialized agents and coordinates multi-step workflows',
      tools: [],  // Supervisor doesn't use MCP tools directly — delegates to child agents
    })
    this.agents = agents
    this.taskQueue = []
  }

  /**
   * Route a task to the appropriate agent.
   * This is the main entry point for all agent operations.
   *
   * @param {object} task - Must include { type: string, ...data }
   * @returns {Promise<object>} - Agent result
   */
  async _process(task) {
    const { type } = task
    if (!type) throw new Error('Task type is required')

    // Determine the target agent
    const agentKey = TASK_ROUTES[type]
    if (!agentKey) {
      throw new Error(`No agent registered for task type: ${type}`)
    }

    const agent = this.agents[agentKey]
    if (!agent) {
      throw new Error(`Agent not found: ${agentKey}`)
    }

    logger.info(`[Supervisor] Routing task "${type}" → ${agent.name}`)

    // Delegate to the specialized agent
    const result = await agent.process(task)

    return {
      ...result,
      routedTo: agent.name,
      routedBy: this.name,
    }
  }

  /**
   * Execute a multi-step workflow.
   * The supervisor coordinates sequential agent calls.
   *
   * @param {object[]} steps - Array of tasks to execute in order
   * @returns {Promise<object[]>} - Array of results
   */
  async executeWorkflow(steps) {
    this._setStatus(AgentStatus.PROCESSING, `Workflow: ${steps.length} steps`)
    const results = []

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      logger.info(`[Supervisor] Workflow step ${i + 1}/${steps.length}: ${step.type}`)

      try {
        const result = await this.process(step)
        results.push(result)

        // Pass data forward if step provides it
        if (result.success && step.passForward && i + 1 < steps.length) {
          Object.assign(steps[i + 1], result.data || {})
        }
      } catch (err) {
        logger.error(`[Supervisor] Workflow step ${i + 1} failed`, { error: err.message })
        results.push({ success: false, error: err.message, step: i + 1 })

        // Stop workflow on critical failure (unless step is marked non-blocking)
        if (!step.nonBlocking) break
      }
    }

    this._setStatus(AgentStatus.IDLE)
    return results
  }

  /**
   * Process a natural language command from the recruiter AI assistant.
   * Uses intent parsing to map to the correct task type.
   *
   * @param {string} message - Recruiter's natural language input
   * @param {object} context - { userId, role, ... }
   * @returns {Promise<object>}
   */
  async handleChat(message, context = {}) {
    const intent = this._parseIntent(message)
    logger.info(`[Supervisor] Chat intent parsed`, { message: message.substring(0, 80), intent })

    if (!intent) {
      return {
        success: true,
        message: 'I can help you with: finding candidates, screening resumes, ranking applicants, generating coding tests, and scheduling interviews. What would you like to do?',
        suggestions: [
          'Find the best candidates for my job',
          'Screen this resume',
          'Generate a coding test',
          'Rank candidates for this role',
        ],
      }
    }

    try {
      const result = await this.process({ ...intent, ...context })
      return {
        success: result.success,
        message: this._formatResponse(intent.type, result),
        data: result.data,
      }
    } catch (err) {
      return {
        success: false,
        message: `I encountered an issue: ${err.message}. Please try again.`,
      }
    }
  }

  // ── Status for monitoring ───────────────────────────────────────────────────

  /** Get status of ALL agents including supervisor */
  getAllAgentStatuses() {
    return {
      supervisor: this.getStatus(),
      agents: Object.entries(this.agents).map(([key, agent]) => ({
        key,
        ...agent.getStatus(),
      })),
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  _parseIntent(message) {
    const lower = message.toLowerCase()

    if (lower.includes('rank') || lower.includes('best candidate') || lower.includes('top candidate')) {
      return { type: 'rank-candidates' }
    }
    if (lower.includes('screen') || lower.includes('resume')) {
      return { type: 'analyze-resume' }
    }
    if (lower.includes('interview')) {
      return { type: 'start-interview' }
    }
    if (lower.includes('coding') || lower.includes('test') || lower.includes('generate')) {
      return { type: 'generate-coding-questions' }
    }
    if (lower.includes('compare')) {
      return { type: 'compare-candidates' }
    }
    if (lower.includes('recommend') || lower.includes('analyze')) {
      return { type: 'generate-recommendation' }
    }

    return null
  }

  _formatResponse(type, result) {
    if (!result.success) return `Task failed: ${result.error}`

    switch (type) {
      case 'rank-candidates':
        return `Found ${result.data?.total || 0} candidates ranked by composite score.`
      case 'analyze-resume':
        return `Resume analyzed. Score: ${result.data?.score || 'N/A'}/100. Recommendation: ${result.data?.recommendation || 'N/A'}.`
      case 'generate-coding-questions':
        return `Generated ${result.data?.length || 0} coding questions.`
      default:
        return 'Task completed successfully.'
    }
  }
}

// Singleton
export const supervisorAgent = new SupervisorAgent()
export default supervisorAgent
