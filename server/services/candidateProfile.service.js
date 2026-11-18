/**
 * candidateProfile.service.js
 *
 * Single source of truth for candidate assessment scores.
 *
 * One Candidate document = one candidate on one job, OWNED by the recruiter who
 * screened them (`createdBy` is a recruiter User id). The candidate themselves
 * is only identified by `email`. Every lookup here therefore keys on
 * (job, email) — never on `createdBy` with a candidate user id.
 *
 * Formula (unchanged):
 *   totalScore = round(resumeScore × 0.30 + codeScore × 0.40 + interviewScore × 0.30)
 *
 * Nothing else may compute a composite score. `weightedTotal` is the only
 * implementation; controllers, MCP tools and the ranking service call it.
 */

import Candidate from '../models/Candidate.js'
import Job from '../models/Job.js'
import User from '../models/User.js'
import logger from '../config/logger.js'

// The single scoring formula used across the product.
export const SCORE_WEIGHTS = { resume: 0.3, code: 0.4, interview: 0.3 }

// Fields that feed the composite. Listing them here keeps every writer aligned.
export const SCORE_FIELDS = ['resumeScore', 'codeScore', 'interviewScore']

/** Component scores live on a 0–100 scale; clamp anything a caller sends. */
export const clampScore = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.max(0, Math.min(100, num))
}

/**
 * The composite score. Always rounds with Math.round, always uses the 30/40/30
 * weights, and clamps each component first so the result is always 0–100.
 * Missing components contribute zero.
 */
export const weightedTotal = ({ resumeScore = 0, codeScore = 0, interviewScore = 0 } = {}) =>
  Math.round(
    clampScore(resumeScore) * SCORE_WEIGHTS.resume +
    clampScore(codeScore) * SCORE_WEIGHTS.code +
    clampScore(interviewScore) * SCORE_WEIGHTS.interview
  )

export const normaliseEmail = (email) => (email ? String(email).trim().toLowerCase() : null)

/**
 * The only shape used to resolve a candidate profile. Returning null when the
 * identity is incomplete prevents the classic "findOne({ email: undefined })"
 * bug, where Mongoose drops the undefined key and matches *any* profile.
 */
export const buildProfileLookup = ({ jobId, email } = {}) => {
  const address = normaliseEmail(email)
  if (!jobId || !address) return null
  return { job: jobId, email: address }
}

/** The recruiter-owned profile for this candidate on this job, if present. */
export const findProfileForJob = async ({ jobId, email }) => {
  const lookup = buildProfileLookup({ jobId, email })
  if (!lookup) return null
  return Candidate.findOne(lookup)
}

const resolveOwnerId = async ({ recruiterId, jobId }) => {
  if (recruiterId) return recruiterId
  const job = await Job.findById(jobId).select('recruiter').lean()
  return job?.recruiter || null
}

/**
 * The single persistence path for assessment scores.
 *
 * - Resolves the profile by (job, email); the candidate's user id is only used
 *   to look their email up, never as an ownership key.
 * - Creates the profile when the assessment produced a result before any
 *   resume screening happened, so the result is visible to the recruiter.
 * - Clamps components to 0–100 and recomputes totalScore from them.
 *
 * Returns the saved profile, or null when the identity could not be resolved
 * (the caller decides how to surface that — it is never silently scored).
 */
export const applyScoreUpdate = async ({
  candidateUserId = null,
  jobId = null,
  email = null,
  name = null,
  recruiterId = null,
  updates = {},
  extraFields = {},
  createIfMissing = true,
} = {}) => {
  try {
    if (!jobId) {
      logger.warn('[CandidateProfile] Score update without jobId was rejected')
      return null
    }

    let address = normaliseEmail(email)
    let displayName = name || null

    if (!address && candidateUserId) {
      const user = await User.findById(candidateUserId).select('name email').lean()
      address = normaliseEmail(user?.email)
      displayName = displayName || user?.name || null
    }

    if (!address) {
      logger.warn('[CandidateProfile] Cannot resolve candidate identity for score update', {
        candidateUserId: String(candidateUserId || ''),
        jobId: String(jobId),
      })
      return null
    }

    let profile = await Candidate.findOne({ job: jobId, email: address })

    if (!profile) {
      if (!createIfMissing) return null
      const owner = await resolveOwnerId({ recruiterId, jobId })
      if (!owner) {
        logger.warn('[CandidateProfile] Cannot create profile without an owning recruiter', {
          jobId: String(jobId),
          email: address,
        })
        return null
      }
      profile = new Candidate({
        name: displayName || address.split('@')[0],
        email: address,
        job: jobId,
        createdBy: owner,
      })
      logger.info('[CandidateProfile] Creating profile for assessment result', {
        email: address,
        jobId: String(jobId),
      })
    }

    for (const [field, value] of Object.entries(extraFields)) {
      if (value !== undefined) profile[field] = value
    }

    for (const field of SCORE_FIELDS) {
      if (updates[field] === undefined) continue
      profile[field] = clampScore(updates[field])
    }

    // Recompute — never trust a caller-supplied total.
    profile.totalScore = weightedTotal(profile)

    await profile.save()

    logger.info('[CandidateProfile] Assessment score persisted', {
      profileId: String(profile._id),
      jobId: String(jobId),
      resumeScore: profile.resumeScore,
      codeScore: profile.codeScore,
      interviewScore: profile.interviewScore,
      totalScore: profile.totalScore,
    })

    return profile
  } catch (err) {
    logger.error('[CandidateProfile] applyScoreUpdate failed', {
      error: err.message,
      stack: err.stack,
    })
    return null
  }
}

/** Resume screening result (resume stage). */
export const applyResumeResult = ({
  candidateUserId = null,
  jobId,
  email = null,
  name = null,
  recruiterId = null,
  resumeScore,
  resumeFields = {},
}) =>
  applyScoreUpdate({
    candidateUserId,
    jobId,
    email,
    name,
    recruiterId,
    updates: { resumeScore },
    extraFields: resumeFields,
  })

/** Coding assessment result (code stage). */
export const applyCodeResult = ({
  candidateUserId = null,
  jobId,
  email = null,
  name = null,
  recruiterId = null,
  codeScore,
}) =>
  applyScoreUpdate({
    candidateUserId,
    jobId,
    email,
    name,
    recruiterId,
    updates: { codeScore },
  })

/** AI interview result (interview stage). */
export const applyInterviewResult = ({
  candidateUserId = null,
  jobId,
  email = null,
  candidateName = null,
  name = null,
  recruiterId = null,
  interviewScore,
}) =>
  applyScoreUpdate({
    candidateUserId,
    jobId,
    email,
    name: candidateName || name,
    recruiterId,
    updates: { interviewScore },
  })
