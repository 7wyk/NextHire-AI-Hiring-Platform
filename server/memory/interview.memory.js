/**
 * interview.memory.js
 *
 * Memory module for interview-related AI context.
 * Stores: conversation turns, evaluation history, questions asked (to prevent duplicates).
 */

import AgentMemory from '../models/AgentMemory.js'
import logger from '../config/logger.js'

/**
 * Store a conversation turn (question + answer + evaluation).
 */
export const storeConversationTurn = async (sessionId, candidateId, jobId, turn) => {
  try {
    return AgentMemory.create({
      agentType: 'interview',
      entityType: 'session',
      entityId: sessionId,
      memoryType: 'conversation',
      content: {
        question: turn.question,
        answer: turn.answer,
        score: turn.score,
        feedback: turn.feedback,
        category: turn.category,
        turnIndex: turn.turnIndex,
      },
      metadata: {
        jobId,
        score: turn.score,
        tags: [turn.category].filter(Boolean),
      },
      summary: `Q${turn.turnIndex}: "${turn.question?.substring(0, 60)}..." → Score: ${turn.score}/10`,
    })
  } catch (err) {
    logger.error('[InterviewMemory] storeConversationTurn failed', { error: err.message })
    return null
  }
}

/**
 * Store a complete interview session summary.
 */
export const storeInterviewSession = async (sessionId, candidateId, jobId, summary) => {
  try {
    return AgentMemory.create({
      agentType: 'interview',
      entityType: 'candidate',
      entityId: candidateId,
      memoryType: 'evaluation',
      content: {
        sessionId,
        overall: summary.overall,
        technical: summary.technical,
        behavioral: summary.behavioral,
        communication: summary.communication,
        summary: summary.summary,
        strengths: summary.strengths,
        concerns: summary.concerns,
        recommendation: summary.recommendation,
      },
      metadata: {
        jobId,
        sessionId,
        score: summary.overall,
        importance: summary.recommendation === 'hire' ? 'critical' : 'medium',
      },
      summary: `Interview completed. Overall: ${summary.overall}/100. Recommendation: ${summary.recommendation}. ${summary.summary || ''}`,
    })
  } catch (err) {
    logger.error('[InterviewMemory] storeInterviewSession failed', { error: err.message })
    return null
  }
}

/**
 * Get all questions asked to a candidate (across sessions).
 * Used to prevent duplicate questions.
 */
export const getPreviousQuestions = async (candidateId) => {
  try {
    const memories = await AgentMemory.find({
      entityType: 'session',
      memoryType: 'conversation',
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    // Extract unique questions
    const questions = memories
      .map(m => m.content?.question)
      .filter(Boolean)

    return [...new Set(questions)]
  } catch (err) {
    logger.error('[InterviewMemory] getPreviousQuestions failed', { error: err.message })
    return []
  }
}

/**
 * Get interview history for a candidate.
 */
export const getInterviewHistory = async (candidateId, jobId = null) => {
  try {
    const filter = {
      agentType: 'interview',
      entityType: 'candidate',
      entityId: candidateId,
      memoryType: 'evaluation',
    }
    if (jobId) filter['metadata.jobId'] = jobId

    return AgentMemory.find(filter)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
  } catch (err) {
    logger.error('[InterviewMemory] getInterviewHistory failed', { error: err.message })
    return []
  }
}

/**
 * Build interview context string for LLM.
 */
export const buildInterviewContext = async (candidateId, jobId = null) => {
  const memories = await getInterviewHistory(candidateId, jobId)
  if (memories.length === 0) return ''

  const summaries = memories.map(m => m.summary).filter(Boolean)
  return `Previous interviews:\n${summaries.join('\n')}`
}

export default {
  storeConversationTurn,
  storeInterviewSession,
  getPreviousQuestions,
  getInterviewHistory,
  buildInterviewContext,
}
