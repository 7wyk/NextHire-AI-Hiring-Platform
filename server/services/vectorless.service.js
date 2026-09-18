/**
 * vectorless.service.js
 *
 * MongoDB-native candidate search — replaces Pinecone vector similarity.
 *
 * Uses:
 *   - MongoDB text indexes on resumeText, skills, name
 *   - Aggregation pipelines with weighted scoring
 *   - Metadata filtering (experience, education, role, score thresholds)
 *
 * Feature flag: Set USE_VECTORLESS=true (default) to use this instead of Pinecone.
 */

import Candidate from '../models/Candidate.js'
import Application from '../models/Application.js'
import Job from '../models/Job.js'
import logger from '../config/logger.js'

// Feature flag — defaults to true (vectorless mode)
const USE_VECTORLESS = process.env.USE_VECTORLESS !== 'false'

/**
 * Search candidates matching a job description using MongoDB.
 *
 * @param {string} jobId   - Job._id to match against
 * @param {object} opts
 * @param {number} opts.topK           - Max results (default 10)
 * @param {number} opts.minScore       - Minimum resumeScore filter (default 0)
 * @param {number} opts.minExperience  - Minimum years of experience (default 0)
 * @param {string[]} opts.requiredSkills - Mandatory skills filter
 * @returns {Promise<Array>}
 */
export const searchCandidates = async (jobId, opts = {}) => {
  const { topK = 10, minScore = 0, minExperience = 0, requiredSkills = [] } = opts

  try {
    const job = await Job.findById(jobId).lean()
    if (!job) throw new Error('Job not found')

    // Build search terms from job
    const searchTerms = [
      job.title,
      ...(job.skills || []),
      ...(job.requirements || []),
    ].join(' ')

    // ── Strategy 1: MongoDB $text search ──────────────────────────────────
    let candidates = []
    try {
      const textFilter = {
        $text: { $search: searchTerms },
      }

      // Apply metadata filters
      if (minScore > 0) textFilter.resumeScore = { $gte: minScore }
      if (minExperience > 0) textFilter.experience = { $gte: minExperience }
      if (requiredSkills.length > 0) {
        textFilter.skills = { $in: requiredSkills }
      }

      candidates = await Candidate.find(
        textFilter,
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(Number(topK))
        .populate('job', 'title company')
        .lean()
    } catch (textErr) {
      logger.warn('[Vectorless] Text search failed, falling back to skill match', {
        error: textErr.message,
      })
    }

    // ── Strategy 2: Skill-based matching (fallback) ───────────────────────
    if (candidates.length === 0) {
      const skillFilter = {
        $or: [
          { skills: { $in: job.skills || [] } },
          { resumeText: { $regex: job.title.split(' ')[0], $options: 'i' } },
        ],
      }
      if (minScore > 0) skillFilter.resumeScore = { $gte: minScore }
      if (minExperience > 0) skillFilter.experience = { $gte: minExperience }

      candidates = await Candidate.find(skillFilter)
        .sort({ resumeScore: -1, totalScore: -1 })
        .limit(Number(topK))
        .populate('job', 'title company')
        .lean()
    }

    // ── Compute relevance scores ──────────────────────────────────────────
    const results = candidates.map(c => {
      const skillOverlap = (c.skills || []).filter(s =>
        (job.skills || []).some(js => js.toLowerCase() === s.toLowerCase())
      ).length
      const totalJobSkills = (job.skills || []).length || 1
      const skillMatch = Math.round((skillOverlap / totalJobSkills) * 100)

      return {
        candidateId: c._id,
        name: c.name,
        email: c.email,
        skills: c.skills || [],
        experience: c.experience || 0,
        resumeScore: c.resumeScore || 0,
        codeScore: c.codeScore || 0,
        interviewScore: c.interviewScore || 0,
        totalScore: c.totalScore || 0,
        skillMatch,
        relevanceScore: Math.round(
          (c.resumeScore || 0) * 0.4 + skillMatch * 0.4 + (c.experience || 0) * 2
        ),
        job: c.job,
        status: c.status,
      }
    })

    // Sort by relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore)

    logger.info('[Vectorless] Search completed', {
      jobId,
      jobTitle: job.title,
      found: results.length,
      topScore: results[0]?.relevanceScore || 0,
    })

    return results
  } catch (err) {
    logger.error('[Vectorless] searchCandidates failed', { error: err.message })
    return []
  }
}

/**
 * Advanced aggregation pipeline for candidate matching.
 * Joins Application + Candidate + Submission data for richer results.
 *
 * @param {string} jobId
 * @param {object} filters
 * @returns {Promise<Array>}
 */
export const aggregateCandidateMatch = async (jobId, filters = {}) => {
  const {
    minResumeScore = 0,
    minCodeScore = 0,
    minTotalScore = 0,
    skills = [],
    status,
    limit = 20,
  } = filters

  try {
    const matchStage = { job: (await import('mongoose')).default.Types.ObjectId.createFromHexString(jobId) }
    if (minResumeScore > 0) matchStage.resumeScore = { $gte: minResumeScore }
    if (minCodeScore > 0) matchStage.codeScore = { $gte: minCodeScore }
    if (minTotalScore > 0) matchStage.totalScore = { $gte: minTotalScore }
    if (skills.length > 0) matchStage.skills = { $in: skills }
    if (status) matchStage.status = status

    const pipeline = [
      { $match: matchStage },

      // Compute weighted composite score
      {
        $addFields: {
          compositeScore: {
            $round: [{
              $add: [
                { $multiply: [{ $ifNull: ['$resumeScore', 0] }, 0.3] },
                { $multiply: [{ $ifNull: ['$codeScore', 0] }, 0.4] },
                { $multiply: [{ $ifNull: ['$interviewScore', 0] }, 0.3] },
              ],
            }, 0],
          },
        },
      },

      { $sort: { compositeScore: -1, resumeScore: -1 } },
      { $limit: Number(limit) },

      // Join job details
      {
        $lookup: {
          from: 'jobs',
          localField: 'job',
          foreignField: '_id',
          as: 'jobDetails',
        },
      },
      { $unwind: { path: '$jobDetails', preserveNullAndEmptyArrays: true } },

      // Project final shape
      {
        $project: {
          name: 1, email: 1, skills: 1, experience: 1,
          resumeScore: 1, codeScore: 1, interviewScore: 1,
          totalScore: 1, compositeScore: 1,
          status: 1, aiSummary: 1, strengths: 1, weaknesses: 1,
          jobTitle: '$jobDetails.title',
          jobCompany: '$jobDetails.company',
          createdAt: 1,
        },
      },
    ]

    return Candidate.aggregate(pipeline)
  } catch (err) {
    logger.error('[Vectorless] aggregateCandidateMatch failed', { error: err.message })
    return []
  }
}

/**
 * Find similar candidates (candidates with overlapping skills).
 *
 * @param {string} candidateId - Reference candidate
 * @param {number} limit - Max results
 * @returns {Promise<Array>}
 */
export const findSimilarCandidates = async (candidateId, limit = 5) => {
  try {
    const reference = await Candidate.findById(candidateId).lean()
    if (!reference) throw new Error('Reference candidate not found')

    if (!reference.skills || reference.skills.length === 0) {
      return []
    }

    return Candidate.find({
      _id: { $ne: candidateId },
      skills: { $in: reference.skills },
    })
      .sort({ totalScore: -1 })
      .limit(Number(limit))
      .select('name email skills resumeScore totalScore status')
      .lean()
  } catch (err) {
    logger.error('[Vectorless] findSimilarCandidates failed', { error: err.message })
    return []
  }
}

/**
 * Check if vectorless mode is active.
 */
export const isVectorlessMode = () => USE_VECTORLESS

export default {
  searchCandidates,
  aggregateCandidateMatch,
  findSimilarCandidates,
  isVectorlessMode,
}
