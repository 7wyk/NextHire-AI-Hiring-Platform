/**
 * candidate.memory.js
 *
 * Memory module for candidate-related AI context.
 * Stores and retrieves: evaluation history, scores, interactions, skill analyses.
 * Uses MongoDB via the AgentMemory model.
 */

import AgentMemory from '../models/AgentMemory.js'
import logger from '../config/logger.js'

/**
 * Store a resume screening result as memory.
 */
export const storeResumeEvaluation = async (candidateId, jobId, evaluation) => {
  try {
    return AgentMemory.create({
      agentType: 'resume',
      entityType: 'candidate',
      entityId: candidateId,
      memoryType: 'evaluation',
      content: {
        score: evaluation.score,
        skills: evaluation.skills,
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        recommendation: evaluation.recommendation,
        experience: evaluation.experience,
      },
      metadata: {
        jobId,
        score: evaluation.score,
        tags: evaluation.skills || [],
        importance: evaluation.score >= 80 ? 'high' : evaluation.score >= 50 ? 'medium' : 'low',
      },
      summary: `Resume score: ${evaluation.score}/100. Skills: ${(evaluation.skills || []).join(', ')}. Recommendation: ${evaluation.recommendation}.`,
    })
  } catch (err) {
    logger.error('[CandidateMemory] storeResumeEvaluation failed', { error: err.message })
    return null
  }
}

/**
 * Store a coding test result.
 */
export const storeCodingResult = async (candidateId, jobId, result) => {
  try {
    return AgentMemory.create({
      agentType: 'coding',
      entityType: 'candidate',
      entityId: candidateId,
      memoryType: 'evaluation',
      content: {
        passRate: result.passRate,
        verdict: result.verdict,
        language: result.language,
        aiFeedback: result.aiFeedback,
      },
      metadata: {
        jobId,
        score: result.passRate,
        tags: [result.language, result.verdict],
        importance: result.passRate >= 80 ? 'high' : 'medium',
      },
      summary: `Coding test: ${result.passRate}% pass rate. Verdict: ${result.verdict}. Language: ${result.language}.`,
    })
  } catch (err) {
    logger.error('[CandidateMemory] storeCodingResult failed', { error: err.message })
    return null
  }
}

/**
 * Store an interview score.
 */
export const storeInterviewResult = async (candidateId, jobId, result) => {
  try {
    return AgentMemory.create({
      agentType: 'interview',
      entityType: 'candidate',
      entityId: candidateId,
      memoryType: 'evaluation',
      content: {
        overall: result.overall,
        technical: result.technical,
        behavioral: result.behavioral,
        communication: result.communication,
        recommendation: result.recommendation,
        strengths: result.strengths,
        concerns: result.concerns,
      },
      metadata: {
        jobId,
        score: result.overall,
        importance: result.recommendation === 'hire' ? 'critical' : 'medium',
      },
      summary: `Interview score: ${result.overall}/100. Recommendation: ${result.recommendation}. Strengths: ${(result.strengths || []).join(', ')}.`,
    })
  } catch (err) {
    logger.error('[CandidateMemory] storeInterviewResult failed', { error: err.message })
    return null
  }
}

/**
 * Get all evaluation memories for a candidate (optionally filtered by job).
 */
export const getCandidateHistory = async (candidateId, jobId = null) => {
  try {
    const filter = {
      entityType: 'candidate',
      entityId: candidateId,
      memoryType: 'evaluation',
    }
    if (jobId) filter['metadata.jobId'] = jobId

    return AgentMemory.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
  } catch (err) {
    logger.error('[CandidateMemory] getCandidateHistory failed', { error: err.message })
    return []
  }
}

/**
 * Build a context summary string for LLM consumption.
 * Condenses a candidate's history into a paragraph for prompt injection.
 */
export const buildCandidateContext = async (candidateId, jobId = null) => {
  const memories = await getCandidateHistory(candidateId, jobId)
  if (memories.length === 0) return ''

  const summaries = memories.map(m => m.summary).filter(Boolean)
  return `Previous evaluations for this candidate:\n${summaries.join('\n')}`
}

export default {
  storeResumeEvaluation,
  storeCodingResult,
  storeInterviewResult,
  getCandidateHistory,
  buildCandidateContext,
}
