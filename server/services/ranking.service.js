/**
 * ranking.service.js
 *
 * Computes a candidate's composite score after each stage:
 *   totalScore = (resumeScore × 0.3) + (codeScore × 0.4) + (interviewScore × 0.3)
 *
 * Automatically called after:
 *   - Resume screening (resume stage)
 *   - Coding test submission (code stage)
 *   - Interview completion (interview stage) [future]
 *
 * Lookup strategy: Candidate is identified by (userId, jobId) pair.
 * If no Candidate doc exists, creates one with minimal data.
 */

import Candidate from '../models/Candidate.js'
import Submission from '../models/Submission.js'
import logger from '../config/logger.js'

const WEIGHTS = { resume: 0.3, code: 0.4, interview: 0.3 }

/**
 * Recalculate and persist the composite score for a candidate on a job.
 *
 * @param {string} userId   - The candidate's User._id
 * @param {string} jobId    - The Job._id
 * @param {object} update   - Partial score update: { resumeScore?, codeScore?, interviewScore? }
 */
export const recalculateScore = async (userId, jobId, update = {}) => {
  try {
    // Find or create the Candidate record
    let candidate = await Candidate.findOne({ createdBy: userId, job: jobId })
      || await Candidate.findOne({ email: { $exists: true }, job: jobId })

    if (!candidate) {
      // Can't create without required fields — just log and return
      logger.warn('[Ranking] No Candidate record to update', { userId, jobId })
      return null
    }

    // Apply any passed-in score updates
    if (update.resumeScore    !== undefined) candidate.resumeScore    = update.resumeScore
    if (update.codeScore      !== undefined) candidate.codeScore      = update.codeScore
    if (update.interviewScore !== undefined) candidate.interviewScore = update.interviewScore

    // Recalculate weighted total
    candidate.totalScore = Math.round(
      (candidate.resumeScore    || 0) * WEIGHTS.resume    +
      (candidate.codeScore      || 0) * WEIGHTS.code      +
      (candidate.interviewScore || 0) * WEIGHTS.interview
    )

    await candidate.save()

    logger.info('[Ranking] Score recalculated', {
      candidateId:    candidate._id,
      resumeScore:    candidate.resumeScore,
      codeScore:      candidate.codeScore,
      interviewScore: candidate.interviewScore,
      totalScore:     candidate.totalScore,
    })

    return candidate
  } catch (err) {
    logger.error('[Ranking] recalculateScore failed', { userId, jobId, error: err.message })
    return null
  }
}

/**
 * Update code score specifically — called after a coding test submission.
 * Finds the best (highest passRate) submission for this user+job.
 *
 * @param {string} userId
 * @param {string} jobId
 * @param {number} passRate  - 0-100, from the submission
 */
export const updateCodeScore = async (userId, jobId, passRate) => {
  return recalculateScore(userId, jobId, { codeScore: passRate })
}

/**
 * Update resume score — called after AI resume screening.
 *
 * @param {string} userId
 * @param {string} jobId
 * @param {number} score  - 0-100, from AI screening
 */
export const updateResumeScore = async (userId, jobId, score) => {
  return recalculateScore(userId, jobId, { resumeScore: score })
}

/**
 * GET rankings for a job — sorted by totalScore desc.
 * Returns enriched candidate list.
 *
 * @param {string} jobId
 * @param {string} recruiterId   - Ensure recruiter owns the data
 * @param {number} limit
 */
export const getRankings = async (jobId, recruiterId, limit = 50) => {
  const candidates = await Candidate.find({ job: jobId, createdBy: recruiterId })
    .select('name email skills resumeScore codeScore interviewScore totalScore status resumeUrl createdAt')
    .sort({ totalScore: -1, resumeScore: -1 })
    .limit(limit)
    .lean()

  // Attach latest submission data
  const userIds = candidates.map(c => c.createdBy || c._id)
  const submissions = await Submission.find({ jobId, userId: { $in: userIds } })
    .sort({ passRate: -1 })
    .select('userId passRate verdict createdAt language aiFeedback')
    .lean()

  const submissionMap = {}
  for (const s of submissions) {
    const key = String(s.userId)
    // Keep only best submission per user
    if (!submissionMap[key] || s.passRate > submissionMap[key].passRate) {
      submissionMap[key] = s
    }
  }

  return candidates.map((c, idx) => ({
    rank:       idx + 1,
    ...c,
    submission: submissionMap[String(c._id)] || null,
  }))
}
