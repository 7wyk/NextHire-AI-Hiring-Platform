/**
 * ranking.agent.js
 *
 * Specialized agent for candidate ranking and comparison.
 * Combines resume, coding, and interview scores with AI-generated reasoning.
 */

import { BaseAgent } from './base.agent.js'
import { getRankings } from '../services/ranking.service.js'
import logger from '../config/logger.js'

// Lazy Groq init (shared pattern)
let groq = null
const initGroq = async () => {
  if (groq) return groq
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.startsWith('your_')) return null
  try {
    const { ChatGroq } = await import('@langchain/groq')
    groq = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0.3,
    })
    return groq
  } catch { return null }
}

class RankingAgent extends BaseAgent {
  constructor() {
    super({
      name: 'RankingAgent',
      description: 'Combines resume, coding, and interview scores to generate final candidate rankings with AI reasoning',
      tools: [
        'mongodb.getCandidate',
        'mongodb.getJob',
        'mongodb.getApplications',
        'mongodb.getSubmissions',
        'mongodb.getInterviewSessions',
        'mongodb.saveScore',
        'notification.send',
      ],
    })
  }

  async _process(task) {
    switch (task.type) {
      case 'rank-candidates':
        return this._rankCandidates(task)
      case 'compare-candidates':
        return this._compareCandidates(task)
      case 'generate-recommendation':
        return this._generateRecommendation(task)
      default:
        throw new Error(`RankingAgent: unknown task type "${task.type}"`)
    }
  }

  /** Get ranked candidates for a job */
  async _rankCandidates(task) {
    const { jobId, recruiterId, limit = 50 } = task

    // Use existing ranking service (DB-based)
    const rankings = await getRankings(jobId, recruiterId, Number(limit))

    // Enrich top 5 with AI reasoning (non-blocking, best-effort)
    const enriched = await this._enrichWithReasoning(rankings.slice(0, 5), task.jobTitle)

    return {
      rankings: [
        ...enriched,
        ...rankings.slice(5),
      ],
      total: rankings.length,
      generatedAt: new Date().toISOString(),
    }
  }

  /** Compare two specific candidates */
  async _compareCandidates(task) {
    const { candidateA, candidateB, jobId } = task

    const [a, b] = await Promise.all([
      this.useTool('mongodb.getCandidate', { userId: candidateA, jobId }),
      this.useTool('mongodb.getCandidate', { userId: candidateB, jobId }),
    ])

    if (!a.success || !b.success) {
      throw new Error('Could not find both candidates')
    }

    const comparison = {
      candidateA: this._summarizeCandidate(a.data),
      candidateB: this._summarizeCandidate(b.data),
      winner: (a.data?.totalScore || 0) >= (b.data?.totalScore || 0) ? 'A' : 'B',
    }

    // Try AI comparison
    try {
      comparison.aiAnalysis = await this._aiCompare(a.data, b.data)
    } catch {
      comparison.aiAnalysis = 'AI comparison unavailable'
    }

    return comparison
  }

  /** Generate AI recommendation for a single candidate */
  async _generateRecommendation(task) {
    const { userId, jobId } = task

    const candidateResult = await this.useTool('mongodb.getCandidate', { userId, jobId })
    if (!candidateResult.success) throw new Error('Candidate not found')

    const candidate = candidateResult.data
    const score = candidate.totalScore || 0

    let recommendation = 'interview'
    if (score >= 80) recommendation = 'hire'
    else if (score >= 60) recommendation = 'interview'
    else if (score >= 40) recommendation = 'maybe'
    else recommendation = 'reject'

    return {
      recommendation,
      score,
      breakdown: {
        resume: candidate.resumeScore || 0,
        coding: candidate.codeScore || 0,
        interview: candidate.interviewScore || 0,
      },
      reasoning: `Composite score ${score}/100 (resume: ${candidate.resumeScore || 0}, code: ${candidate.codeScore || 0}, interview: ${candidate.interviewScore || 0}). ${recommendation === 'hire' ? 'Strong candidate across all dimensions.' : recommendation === 'reject' ? 'Scores below threshold in multiple areas.' : 'Further evaluation recommended.'}`,
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  _summarizeCandidate(c) {
    return {
      name: c?.name || 'Unknown',
      resumeScore: c?.resumeScore || 0,
      codeScore: c?.codeScore || 0,
      interviewScore: c?.interviewScore || 0,
      totalScore: c?.totalScore || 0,
      skills: c?.skills || [],
    }
  }

  async _enrichWithReasoning(candidates, jobTitle) {
    const client = await initGroq()
    if (!client) return candidates

    try {
      const { HumanMessage, SystemMessage } = await import('@langchain/core/messages')
      const summaries = candidates.map((c, i) =>
        `#${i + 1} ${c.name}: Resume=${c.resumeScore || 0}, Code=${c.codeScore || 0}, Interview=${c.interviewScore || 0}, Total=${c.totalScore || 0}`
      ).join('\n')

      const response = await client.invoke([
        new SystemMessage('You are a hiring advisor. Given candidate scores for a role, provide 1-sentence reasoning for each ranking. Return a JSON array of strings.'),
        new HumanMessage(`Role: ${jobTitle || 'Software Engineer'}\n\nCandidates:\n${summaries}\n\nReturn a JSON array with exactly ${candidates.length} reasoning strings.`),
      ])

      const match = response.content.match(/\[[\s\S]*\]/)
      if (match) {
        const reasons = JSON.parse(match[0])
        return candidates.map((c, i) => ({ ...c, aiReasoning: reasons[i] || '' }))
      }
    } catch (err) {
      logger.warn('[RankingAgent] AI enrichment failed', { error: err.message })
    }

    return candidates
  }

  async _aiCompare(a, b) {
    const client = await initGroq()
    if (!client) return 'AI comparison not available'

    try {
      const { HumanMessage, SystemMessage } = await import('@langchain/core/messages')
      const response = await client.invoke([
        new SystemMessage('You are a hiring advisor. Compare two candidates concisely in 2-3 sentences.'),
        new HumanMessage(`Candidate A: ${a?.name}, skills: ${a?.skills?.join(', ')}, resume: ${a?.resumeScore}, code: ${a?.codeScore}, interview: ${a?.interviewScore}\nCandidate B: ${b?.name}, skills: ${b?.skills?.join(', ')}, resume: ${b?.resumeScore}, code: ${b?.codeScore}, interview: ${b?.interviewScore}`),
      ])
      return response.content.trim()
    } catch {
      return 'AI comparison not available'
    }
  }
}

export const rankingAgent = new RankingAgent()
export default rankingAgent
