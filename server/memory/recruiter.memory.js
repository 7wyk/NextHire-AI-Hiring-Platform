/**
 * recruiter.memory.js
 *
 * Memory module for recruiter-related AI context.
 * Stores: search patterns, hiring decisions, preferences, actions.
 * Powers the Recruiter AI Assistant with personalized recommendations.
 */

import AgentMemory from '../models/AgentMemory.js'
import logger from '../config/logger.js'

/**
 * Store a recruiter's hiring decision.
 */
export const storeHiringDecision = async (recruiterId, candidateId, jobId, decision) => {
  try {
    return AgentMemory.create({
      agentType: 'ranking',
      entityType: 'recruiter',
      entityId: recruiterId,
      memoryType: 'decision',
      content: {
        candidateId,
        decision: decision.status, // hired, rejected, shortlisted, etc.
        reason: decision.reason || '',
        candidateName: decision.candidateName || '',
        jobTitle: decision.jobTitle || '',
      },
      metadata: {
        jobId,
        tags: [decision.status],
        importance: decision.status === 'hired' ? 'critical' : 'medium',
      },
      summary: `${decision.status} ${decision.candidateName || 'candidate'} for ${decision.jobTitle || 'role'}. ${decision.reason || ''}`,
    })
  } catch (err) {
    logger.error('[RecruiterMemory] storeHiringDecision failed', { error: err.message })
    return null
  }
}

/**
 * Store a search query the recruiter performed.
 */
export const storeSearchQuery = async (recruiterId, query) => {
  try {
    return AgentMemory.create({
      agentType: 'supervisor',
      entityType: 'recruiter',
      entityId: recruiterId,
      memoryType: 'search',
      content: {
        query: query.text || '',
        filters: query.filters || {},
        resultCount: query.resultCount || 0,
      },
      metadata: {
        jobId: query.jobId || undefined,
        tags: query.tags || [],
      },
      summary: `Searched: "${query.text}". Found ${query.resultCount || 0} results.`,
      // Auto-expire searches after 30 days
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
  } catch (err) {
    logger.error('[RecruiterMemory] storeSearchQuery failed', { error: err.message })
    return null
  }
}

/**
 * Store a recruiter preference / pattern observation.
 */
export const storePreference = async (recruiterId, preference) => {
  try {
    // Upsert — update if same preference type exists
    return AgentMemory.findOneAndUpdate(
      {
        entityType: 'recruiter',
        entityId: recruiterId,
        memoryType: 'preference',
        'content.key': preference.key,
      },
      {
        agentType: 'supervisor',
        entityType: 'recruiter',
        entityId: recruiterId,
        memoryType: 'preference',
        content: {
          key: preference.key,
          value: preference.value,
          observedCount: (preference.observedCount || 0) + 1,
        },
        summary: `Preference: ${preference.key} = ${preference.value}`,
      },
      { upsert: true, new: true }
    )
  } catch (err) {
    logger.error('[RecruiterMemory] storePreference failed', { error: err.message })
    return null
  }
}

/**
 * Store a recruiter action (any significant action).
 */
export const storeAction = async (recruiterId, action) => {
  try {
    return AgentMemory.create({
      agentType: action.agentType || 'supervisor',
      entityType: 'recruiter',
      entityId: recruiterId,
      memoryType: 'interaction',
      content: {
        action: action.type,
        target: action.target || '',
        details: action.details || {},
      },
      metadata: {
        jobId: action.jobId || undefined,
        tags: [action.type],
      },
      summary: `Action: ${action.type}. ${action.target || ''}`,
      // Auto-expire actions after 90 days
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    })
  } catch (err) {
    logger.error('[RecruiterMemory] storeAction failed', { error: err.message })
    return null
  }
}

/**
 * Get recruiter's recent activity.
 */
export const getRecruiterHistory = async (recruiterId, limit = 20) => {
  try {
    return AgentMemory.find({
      entityType: 'recruiter',
      entityId: recruiterId,
    })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean()
  } catch (err) {
    logger.error('[RecruiterMemory] getRecruiterHistory failed', { error: err.message })
    return []
  }
}

/**
 * Get recruiter's hiring patterns for a job.
 */
export const getHiringPatterns = async (recruiterId, jobId = null) => {
  try {
    const filter = {
      entityType: 'recruiter',
      entityId: recruiterId,
      memoryType: 'decision',
    }
    if (jobId) filter['metadata.jobId'] = jobId

    const decisions = await AgentMemory.find(filter).lean()

    const patterns = {
      totalDecisions: decisions.length,
      hired: decisions.filter(d => d.content?.decision === 'hired').length,
      rejected: decisions.filter(d => d.content?.decision === 'rejected').length,
      shortlisted: decisions.filter(d => d.content?.decision === 'shortlisted').length,
    }

    return patterns
  } catch (err) {
    logger.error('[RecruiterMemory] getHiringPatterns failed', { error: err.message })
    return { totalDecisions: 0, hired: 0, rejected: 0, shortlisted: 0 }
  }
}

/**
 * Build context string for the recruiter AI assistant.
 */
export const buildRecruiterContext = async (recruiterId) => {
  const history = await getRecruiterHistory(recruiterId, 10)
  if (history.length === 0) return ''

  const summaries = history.map(m => m.summary).filter(Boolean)
  return `Recruiter's recent activity:\n${summaries.join('\n')}`
}

export default {
  storeHiringDecision,
  storeSearchQuery,
  storePreference,
  storeAction,
  getRecruiterHistory,
  getHiringPatterns,
  buildRecruiterContext,
}
