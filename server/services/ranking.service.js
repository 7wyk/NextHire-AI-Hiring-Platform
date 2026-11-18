/**
 * ranking.service.js
 *
 * Rankings are computed from the component scores and sorted *after* the
 * composite is known — the stored `totalScore` is never used as a sort key.
 * That was the cause of a candidate with 31 ranking below candidates with 23:
 * Mongo sorted by an outdated stored total, then the response recomputed the
 * number that was displayed.
 *
 * Order of operations (fixed):
 *   1. load the recruiter's candidates for the job
 *   2. resolve interview state from InterviewSession, coding from Submission
 *   3. compute totalScore with the ONE shared formula
 *   4. sort by that computed total (desc), resumeScore, then _id
 *   5. assign rank numbers after sorting
 */

import Candidate from '../models/Candidate.js'
import Submission from '../models/Submission.js'
import InterviewSession from '../models/InterviewSession.js'
import User from '../models/User.js'
import logger from '../config/logger.js'
import {
  weightedTotal,
  applyScoreUpdate,
  normaliseEmail,
} from './candidateProfile.service.js'

// Upper bound on rows pulled before the in-memory sort protects the process
// from an unbounded scan while never truncating a realistic ranking.
const MAX_RANKED_CANDIDATES = 500

/**
 * Deterministic ordering: weighted total desc, then resume score desc, then
 * `_id` ascending so equal candidates keep a stable order between requests.
 */
export const compareByWeightedScore = (a, b) => {
  const total = (Number(b?.totalScore) || 0) - (Number(a?.totalScore) || 0)
  if (total !== 0) return total

  const resume = (Number(b?.resumeScore) || 0) - (Number(a?.resumeScore) || 0)
  if (resume !== 0) return resume

  return String(a?._id ?? '').localeCompare(String(b?._id ?? ''))
}

/**
 * Sort rows and assign final rank numbers. Ranks are assigned only here, after
 * the final sort, so a filtered/searched list can still show its true rank.
 */
export const rankRows = (rows = []) =>
  [...rows]
    .sort(compareByWeightedScore)
    .map((row, index) => ({ ...row, rank: index + 1 }))

/**
 * Recalculate and persist the composite score for a candidate on a job.
 *
 * Identity is resolved by (job, email) inside the scoring service. There is no
 * `createdBy` fallback: that fallback could write one candidate's score onto a
 * recruiter-owned row belonging to somebody else.
 *
 * @param {string} userId   - the candidate's User._id
 * @param {string} jobId    - the Job._id
 * @param {object} update   - { resumeScore?, codeScore?, interviewScore? }
 */
export const recalculateScore = async (userId, jobId, update = {}) => {
  const profile = await applyScoreUpdate({
    candidateUserId: userId,
    jobId,
    updates: update,
  })

  if (!profile) {
    logger.warn('[Ranking] Score update could not be applied', {
      userId: String(userId || ''),
      jobId: String(jobId || ''),
    })
  }

  return profile
}

/** Called after a coding test submission. */
export const updateCodeScore = async (userId, jobId, passRate) =>
  recalculateScore(userId, jobId, { codeScore: passRate })

/** Called after AI resume screening. */
export const updateResumeScore = async (userId, jobId, score) =>
  recalculateScore(userId, jobId, { resumeScore: score })

/**
 * Rankings for one job, scoped to the recruiter who owns the candidates.
 *
 * Returns rows whose `totalScore`, `rank` and sort order always agree.
 */
export const getRankings = async (jobId, recruiterId, limit = 50) => {
  const candidates = await Candidate.find({ job: jobId, createdBy: recruiterId })
    .select('name email skills resumeScore codeScore interviewScore totalScore status resumeUrl resumeText createdAt')
    .limit(MAX_RANKED_CANDIDATES)
    .lean()

  if (candidates.length === 0) return []

  // ── Candidate emails → user ids (submissions are keyed by user id) ───────
  const emails = candidates.map(c => normaliseEmail(c.email)).filter(Boolean)
  const users = await User.find({ email: { $in: emails } }).select('_id email').lean()
  const userIdByEmail = Object.fromEntries(
    users.map(u => [normaliseEmail(u.email), String(u._id)])
  )
  const userIds = Object.values(userIdByEmail)

  const submissions = userIds.length > 0
    ? await Submission.find({ jobId, userId: { $in: userIds } })
        .sort({ passRate: -1 })
        .select('userId passRate verdict createdAt language aiFeedback')
        .lean()
    : []

  const submissionByUserId = {}
  for (const submission of submissions) {
    const key = String(submission.userId)
    if (!submissionByUserId[key] || submission.passRate > submissionByUserId[key].passRate) {
      submissionByUserId[key] = submission
    }
  }

  // ── Interview state comes from InterviewSession, the source of truth ─────
  const sessions = await InterviewSession.find({
    job: jobId,
    initiatedBy: 'candidate',
  }).select('candidate completed finalScore evaluationStatus').lean()

  const sessionUserIds = [...new Set(sessions.map(s => String(s.candidate)))]
  const sessionUsers = sessionUserIds.length > 0
    ? await User.find({ _id: { $in: sessionUserIds } }).select('email').lean()
    : []
  const emailByUserId = Object.fromEntries(
    sessionUsers.map(u => [String(u._id), normaliseEmail(u.email)])
  )

  // A completed session is only a scored interview when the AI evaluated it.
  // Legacy sessions (no status) count when they hold a genuine non-zero score.
  const isEvaluatedSession = (session) =>
    session.completed && (
      session.evaluationStatus === 'evaluated' ||
      (session.evaluationStatus !== 'unavailable' && (Number(session.finalScore) || 0) > 0)
    )

  const interviewByEmail = {}
  for (const session of sessions) {
    const email = emailByUserId[String(session.candidate)]
    if (!email) continue

    const entry = interviewByEmail[email] || { status: 'in_progress', score: null }

    if (isEvaluatedSession(session)) {
      entry.status = 'completed'
      entry.score = Math.max(entry.score ?? 0, Number(session.finalScore) || 0)
    } else if (session.completed && entry.status !== 'completed') {
      // Finished, but nothing was evaluated — must not read as a real zero.
      entry.status = 'unavailable'
    }

    interviewByEmail[email] = entry
  }

  const rows = candidates.map(c => {
    const email = normaliseEmail(c.email)
    const interview = email ? interviewByEmail[email] : undefined

    const interviewStatus = interview?.status
      || ((c.interviewScore || 0) > 0 ? 'completed' : 'not_started')
    const interviewScore = interview?.status === 'completed'
      ? (interview.score || 0)
      : (interview?.status === 'unavailable' ? 0 : (c.interviewScore || 0))

    const submission = email ? (submissionByUserId[userIdByEmail[email]] || null) : null

    return {
      _id: c._id,
      name: c.name,
      email: c.email,
      skills: c.skills || [],
      status: c.status,
      resumeUrl: c.resumeUrl,
      resumeScore: c.resumeScore || 0,
      codeScore: c.codeScore || 0,
      interviewScore,
      interviewStatus,
      // Presence, not magnitude: a genuine zero is still "completed".
      resumeStatus: c.resumeText || (c.resumeScore || 0) > 0 ? 'completed' : 'not_evaluated',
      codingStatus: submission ? 'completed' : 'not_taken',
      totalScore: weightedTotal({
        resumeScore: c.resumeScore,
        codeScore: c.codeScore,
        interviewScore,
      }),
      submission,
      jobId,
      createdAt: c.createdAt,
    }
  })

  return rankRows(rows).slice(0, Number(limit) || 50)
}
