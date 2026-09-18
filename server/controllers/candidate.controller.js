/**
 * candidate.controller.js
 *
 * The REAL candidate data lives across three collections:
 *   Application  — who applied to which job (status lives here)
 *   User         — candidate name / email (role = 'candidate')
 *   Submission   — coding test scores per user+job
 *   Candidate    — resume screening data (optional, populated by AI screening)
 *
 * GET /api/candidates aggregates all four into a single unified view.
 */

import mongoose from 'mongoose'
import Application from '../models/Application.js'
import Job         from '../models/Job.js'
import Submission  from '../models/Submission.js'
import Candidate   from '../models/Candidate.js'
import { getRankings } from '../services/ranking.service.js'
import logger from '../config/logger.js'

// v2 Agent System
import { supervisorAgent } from '../agents/supervisor.agent.js'
import { storeHiringDecision } from '../memory/recruiter.memory.js'
import { getCandidateHistory } from '../memory/candidate.memory.js'

const ObjectId = mongoose.Types.ObjectId

// ─── GET /api/candidates ─────────────────────────────────────────────────────
// Returns ALL candidates who applied to the recruiter's jobs,
// with real scores aggregated from Submission + Candidate collections.
// ──────────────────────────────────────────────────────────────────────────────
export const getCandidates = async (req, res) => {
  try {
    const recruiterId = req.user._id
    const { status, job, sort = '-totalScore', page = 1, limit = 50 } = req.query

    // 1. Find all recruiter's job IDs
    const jobFilter = { recruiter: recruiterId }
    if (job) jobFilter._id = new ObjectId(job)
    const recruiterJobs = await Job.find(jobFilter).select('_id title company').lean()
    const jobIds   = recruiterJobs.map(j => j._id)
    const jobMap   = Object.fromEntries(recruiterJobs.map(j => [String(j._id), j]))

    logger.info('[Candidates] Step 1 — recruiter jobs', {
      recruiterId: String(recruiterId),
      jobCount: jobIds.length,
      jobIds: jobIds.map(String),
    })

    if (jobIds.length === 0) {
      logger.warn('[Candidates] No jobs found for recruiter — returning empty', { recruiterId: String(recruiterId) })
      return res.json({ candidates: [], total: 0 })
    }

    // 2. Build application filter
    const appFilter = { job: { $in: jobIds } }
    if (status) appFilter.status = status

    // Debug: count raw applications
    const rawAppCount = await Application.countDocuments(appFilter)
    logger.info('[Candidates] Step 2 — applications found', {
      filter: JSON.stringify(appFilter, null, 0),
      count: rawAppCount,
    })

    if (rawAppCount === 0) {
      logger.warn('[Candidates] No applications found for recruiter jobs — returning empty')
      return res.json({ candidates: [], total: 0 })
    }

    // 3. Aggregate: Application → join User → join best Submission → join Candidate (resume)
    const pipeline = [
      { $match: appFilter },

      // Sort applications by most recent first (so $first picks latest)
      { $sort: { createdAt: -1 } },

      // Group by candidate user — one row per unique candidate
      {
        $group: {
          _id:               '$candidate',                    // userId (ObjectId)
          latestStatus:      { $first: '$status' },           // most recent application status
          applicationsCount: { $sum: 1 },
          jobIds:            { $addToSet: '$job' },
          latestAppId:       { $first: '$_id' },
          appliedAt:         { $first: '$createdAt' },
        },
      },

      // Join User collection for name + email
      {
        $lookup: {
          from:         'users',
          localField:   '_id',
          foreignField: '_id',
          as:           'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },

      // Join Submissions — best submission for this user across recruiter's jobs
      // Use let/pipeline to handle ObjectId comparisons safely
      {
        $lookup: {
          from:     'submissions',
          let:      { uid: '$_id', jids: '$jobIds' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: [{ $toObjectId: '$userId' }, '$$uid'] },
                    // Guard: skip submissions where jobId is null (standalone)
                    { $ne: ['$jobId', null] },
                    { $in: [{ $toObjectId: '$jobId' }, '$$jids'] },
                  ],
                },
              },
            },
            { $sort: { passRate: -1 } },
            { $limit: 1 },           // best submission
          ],
          as: 'bestSubmission',
        },
      },

      // Join Candidate collection (resume screening data — may not exist)
      {
        $lookup: {
          from:     'candidates',
          let:      { uid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ['$createdBy', null] },
                    { $eq: [{ $toObjectId: '$createdBy' }, '$$uid'] },
                  ],
                },
              },
            },
            { $sort: { resumeScore: -1 } },
            { $limit: 1 },
          ],
          as: 'candidateProfile',
        },
      },

      // Project final shape
      {
        $project: {
          _id:               1,
          name:              '$user.name',
          email:             '$user.email',
          currentRole:       { $ifNull: [{ $arrayElemAt: ['$candidateProfile.currentRole', 0] }, null] },
          status:            '$latestStatus',
          applicationsCount: 1,
          jobIds:            1,
          appliedAt:         1,
          latestAppId:       1,

          // Scores
          codeScore: {
            $ifNull: [{ $arrayElemAt: ['$bestSubmission.passRate', 0] }, 0],
          },
          resumeScore: {
            $ifNull: [{ $arrayElemAt: ['$candidateProfile.resumeScore', 0] }, 0],
          },
          interviewScore: {
            $ifNull: [{ $arrayElemAt: ['$candidateProfile.interviewScore', 0] }, 0],
          },

          // Submission metadata
          codingVerdict: { $arrayElemAt: ['$bestSubmission.verdict', 0] },
          codingLanguage: { $arrayElemAt: ['$bestSubmission.language', 0] },
        },
      },

      // Compute weighted totalScore
      {
        $addFields: {
          totalScore: {
            $round: [
              {
                $add: [
                  { $multiply: ['$resumeScore', 0.3] },
                  { $multiply: ['$codeScore', 0.4] },
                  { $multiply: ['$interviewScore', 0.3] },
                ],
              },
              0,
            ],
          },
        },
      },
    ]

    // 4. Sorting
    const sortMap = {
      '-totalScore':    { totalScore: -1 },
      '-resumeScore':   { resumeScore: -1 },
      '-codeScore':     { codeScore: -1 },
      '-createdAt':     { appliedAt: -1 },
      'totalScore':     { totalScore: 1 },
      'name':           { name: 1 },
    }
    pipeline.push({ $sort: sortMap[sort] || { totalScore: -1 } })

    // 5. Pagination
    const skip = (Number(page) - 1) * Number(limit)
    pipeline.push({ $skip: skip }, { $limit: Number(limit) })

    const candidates = await Application.aggregate(pipeline)

    // Debug: log aggregation result
    logger.info('[Candidates] Step 3 — aggregation result', {
      returned: candidates.length,
      sample: candidates.length > 0 ? {
        _id:    String(candidates[0]._id),
        name:   candidates[0].name,
        email:  candidates[0].email,
        codeScore:   candidates[0].codeScore,
        resumeScore: candidates[0].resumeScore,
        totalScore:  candidates[0].totalScore,
        status:      candidates[0].status,
        applicationsCount: candidates[0].applicationsCount,
      } : null,
    })

    // Enrich with job details
    const enriched = candidates.map(c => ({
      ...c,
      jobs: (c.jobIds || []).map(jid => jobMap[String(jid)] || { _id: jid }),
      jobIds: undefined,   // remove raw IDs
    }))

    // Count total (before pagination)
    const countPipeline = [
      { $match: appFilter },
      { $group: { _id: '$candidate' } },
      { $count: 'total' },
    ]
    const countResult = await Application.aggregate(countPipeline)
    const total = countResult[0]?.total || 0

    logger.info('[Candidates] Aggregated — final response', {
      recruiterId: String(recruiterId),
      total,
      returned: enriched.length,
    })

    res.json({
      candidates: enriched,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    })
  } catch (err) {
    logger.error('[Candidates] getCandidates failed', { error: err.message, stack: err.stack })
    res.status(500).json({ message: err.message })
  }
}

// ─── GET /api/candidates/:id ─────────────────────────────────────────────────
// Get single candidate detail (by userId) with full scores
// ──────────────────────────────────────────────────────────────────────────────
export const getCandidate = async (req, res) => {
  try {
    const candidateUserId = req.params.id
    const recruiterId     = req.user._id

    // Get recruiter's jobs
    const recruiterJobs = await Job.find({ recruiter: recruiterId }).select('_id').lean()
    const jobIds = recruiterJobs.map(j => j._id)

    // Get applications for this candidate on recruiter's jobs
    const applications = await Application.find({
      candidate: candidateUserId,
      job:       { $in: jobIds },
    }).populate('job', 'title company').lean()

    if (applications.length === 0) {
      return res.status(404).json({ message: 'Candidate not found' })
    }

    // Get user info
    const User = mongoose.model('User')
    const user = await User.findById(candidateUserId).select('name email').lean()
    if (!user) return res.status(404).json({ message: 'User not found' })

    // Best submission
    const bestSub = await Submission.findOne({
      userId: candidateUserId,
      jobId:  { $in: jobIds },
    }).sort({ passRate: -1 }).lean()

    // Candidate profile (from resume screening)
    const profile = await Candidate.findOne({
      createdBy: candidateUserId,
    }).sort({ resumeScore: -1 }).lean()

    const codeScore      = bestSub?.passRate || 0
    const resumeScore    = profile?.resumeScore || 0
    const interviewScore = profile?.interviewScore || 0
    const totalScore     = Math.round(resumeScore * 0.3 + codeScore * 0.4 + interviewScore * 0.3)

    // Enrich with AI evaluation history (v2 memory)
    let aiHistory = []
    try {
      aiHistory = await getCandidateHistory(candidateUserId)
    } catch { /* non-blocking */ }

    res.json({
      candidate: {
        _id:               candidateUserId,
        name:              user.name,
        email:             user.email,
        currentRole:       profile?.currentRole || null,
        status:            applications[0]?.status || 'applied',
        applicationsCount: applications.length,
        jobs:              applications.map(a => a.job),
        resumeScore,
        codeScore,
        interviewScore,
        totalScore,
        codingVerdict:     bestSub?.verdict || null,
        aiFeedback:        bestSub?.aiFeedback || null,
        aiSummary:         profile?.aiSummary || null,
        strengths:         profile?.strengths || [],
        weaknesses:        profile?.weaknesses || [],
        skills:            profile?.skills || [],
        appliedAt:         applications[0]?.createdAt,
        aiHistory:         aiHistory.slice(0, 10),
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─── PATCH /api/candidates/:id/status ────────────────────────────────────────
// Update candidate status — works on the Application document
// Body: { status, jobId? }
// ──────────────────────────────────────────────────────────────────────────────
export const updateStatus = async (req, res) => {
  try {
    const { status, jobId } = req.body
    const candidateUserId   = req.params.id
    const recruiterId       = req.user._id

    if (!status) return res.status(400).json({ message: 'status is required' })

    // Find the recruiter's jobs
    const jobFilter = { recruiter: recruiterId }
    if (jobId) jobFilter._id = new ObjectId(jobId)
    const recruiterJobs = await Job.find(jobFilter).select('_id').lean()
    const jobIds = recruiterJobs.map(j => j._id)

    // Update the application for this candidate
    const app = await Application.findOneAndUpdate(
      { candidate: candidateUserId, job: { $in: jobIds } },
      { status },
      { new: true, sort: { createdAt: -1 } }
    ).populate('job', 'title company')

    if (!app) return res.status(404).json({ message: 'Application not found' })

    // Also update Candidate doc if it exists (keep in sync)
    await Candidate.updateMany(
      { createdBy: candidateUserId },
      { status },
    )

    // v2: Store hiring decision in recruiter memory (non-blocking)
    storeHiringDecision(recruiterId, candidateUserId, jobId || jobIds[0], {
      status,
      candidateName: user?.name || '',
      jobTitle: app.job?.title || '',
    }).catch(() => {})

    // Build response in the same shape as getCandidates rows
    const User = mongoose.model('User')
    const user = await User.findById(candidateUserId).select('name email').lean()

    res.json({
      candidate: {
        _id:    candidateUserId,
        name:   user?.name || 'Unknown',
        email:  user?.email || '',
        status: app.status,
        jobs:   [app.job],
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─── DELETE /api/candidates/:id ──────────────────────────────────────────────
// Remove candidate from recruiter's view — deletes their Applications
// ──────────────────────────────────────────────────────────────────────────────
export const deleteCandidate = async (req, res) => {
  try {
    const candidateUserId = req.params.id
    const recruiterId     = req.user._id

    const recruiterJobs = await Job.find({ recruiter: recruiterId }).select('_id').lean()
    const jobIds = recruiterJobs.map(j => j._id)

    const result = await Application.deleteMany({
      candidate: candidateUserId,
      job:       { $in: jobIds },
    })

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Candidate not found' })
    }

    res.json({ message: 'Candidate removed', deleted: result.deletedCount })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─── POST /api/candidates (legacy — create candidate profile) ────────────────
export const createCandidate = async (req, res) => {
  try {
    const candidate = await Candidate.create({ ...req.body, createdBy: req.user._id })
    res.status(201).json({ candidate })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─── PUT /api/candidates/:id (legacy — update candidate profile) ─────────────
export const updateCandidate = async (req, res) => {
  try {
    const candidate = await Candidate.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      req.body,
      { new: true, runValidators: true }
    )
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' })
    res.json({ candidate })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─── GET /api/candidates/rankings?jobId=xxx ──────────────────────────────────
export const getCandidateRankings = async (req, res) => {
  try {
    const { jobId, limit = 50 } = req.query
    if (!jobId) return res.status(400).json({ message: 'jobId is required' })

    // v2: Route through ranking agent (falls back to direct service)
    let rankings
    try {
      const agentResult = await supervisorAgent.process({
        type: 'rank-candidates',
        jobId,
        recruiterId: req.user._id,
        limit: Number(limit),
      })
      rankings = agentResult.success && agentResult.data?.rankings
        ? agentResult.data.rankings
        : await getRankings(jobId, req.user._id, Number(limit))
    } catch {
      rankings = await getRankings(jobId, req.user._id, Number(limit))
    }

    res.json({ rankings, total: rankings.length, _agent: 'RankingAgent' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
