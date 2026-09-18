/**
 * agent.routes.js
 *
 * API routes for the multi-agent system.
 * Provides: agent status monitoring, recruiter AI assistant chat,
 * and agent-powered operations.
 */

import { Router } from 'express'
import { protect } from '../middlewares/auth.middleware.js'
import { supervisorAgent } from '../agents/supervisor.agent.js'
import { mcpRegistry } from '../mcp/base.mcp.js'
import { searchCandidates } from '../services/vectorless.service.js'
import logger from '../config/logger.js'

const router = Router()

// All agent routes require authentication
router.use(protect)

// ─── GET /api/agents/status ──────────────────────────────────────────────────
// Returns status of all agents (for Agent Monitor dashboard)
// ──────────────────────────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  try {
    const statuses = supervisorAgent.getAllAgentStatuses()
    res.json(statuses)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── GET /api/agents/:agentName/status ───────────────────────────────────────
// Returns status of a specific agent
// ──────────────────────────────────────────────────────────────────────────────
router.get('/:agentName/status', (req, res) => {
  try {
    const statuses = supervisorAgent.getAllAgentStatuses()
    const agent = statuses.agents.find(a => a.key === req.params.agentName)

    if (!agent) {
      return res.status(404).json({ message: `Agent not found: ${req.params.agentName}` })
    }

    res.json(agent)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── GET /api/agents/tools ───────────────────────────────────────────────────
// List all registered MCP tools
// ──────────────────────────────────────────────────────────────────────────────
router.get('/tools', (req, res) => {
  try {
    const tools = mcpRegistry.listTools()
    res.json({ tools, total: tools.length })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// ─── POST /api/agents/chat ───────────────────────────────────────────────────
// Recruiter AI Assistant — natural language chat interface
// Body: { message: string, jobId?: string }
// ──────────────────────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const { message, jobId } = req.body

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ message: 'Message is required' })
    }

    logger.info('[Agent Chat] Request received', {
      userId: req.user._id,
      message: message.substring(0, 100),
    })

    const result = await supervisorAgent.handleChat(message, {
      userId: req.user._id,
      role: req.user.role,
      jobId,
      recruiterId: req.user._id,
    })

    res.json(result)
  } catch (err) {
    logger.error('[Agent Chat] Failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
})

// ─── POST /api/agents/execute ────────────────────────────────────────────────
// Execute a specific agent task (advanced API)
// Body: { type: string, ...taskData }
// ──────────────────────────────────────────────────────────────────────────────
router.post('/execute', async (req, res) => {
  try {
    const task = req.body
    if (!task.type) {
      return res.status(400).json({ message: 'Task type is required' })
    }

    // Inject user context
    task.userId = task.userId || req.user._id
    task.recruiterId = task.recruiterId || req.user._id

    logger.info('[Agent Execute] Task submitted', {
      type: task.type,
      userId: req.user._id,
    })

    const result = await supervisorAgent.process(task)
    res.json(result)
  } catch (err) {
    logger.error('[Agent Execute] Failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
})

// ─── POST /api/agents/search-candidates ──────────────────────────────────────
// Vectorless candidate search via agent
// Body: { jobId, topK?, minScore?, minExperience?, requiredSkills? }
// ──────────────────────────────────────────────────────────────────────────────
router.post('/search-candidates', async (req, res) => {
  try {
    const { jobId, topK, minScore, minExperience, requiredSkills } = req.body

    if (!jobId) {
      return res.status(400).json({ message: 'jobId is required' })
    }

    const results = await searchCandidates(jobId, {
      topK, minScore, minExperience, requiredSkills,
    })

    res.json({
      candidates: results,
      total: results.length,
      method: 'vectorless',
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
