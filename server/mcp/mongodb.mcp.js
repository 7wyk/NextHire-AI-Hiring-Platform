/**
 * mongodb.mcp.js
 *
 * MCP tools for MongoDB database operations.
 * Provides structured access to Candidate, Job, Application, and score data.
 */

import { MCPTool, mcpRegistry } from './base.mcp.js'
import Candidate from '../models/Candidate.js'
import Job from '../models/Job.js'
import Application from '../models/Application.js'
import Submission from '../models/Submission.js'
import InterviewSession from '../models/InterviewSession.js'
import User from '../models/User.js'
import { normaliseEmail, applyScoreUpdate } from '../services/candidateProfile.service.js'

// ── getCandidate ──────────────────────────────────────────────────────────────

class GetCandidateTool extends MCPTool {
  constructor() {
    super({
      name: 'mongodb.getCandidate',
      description: 'Fetch a candidate profile by ID or by userId + jobId lookup',
      parameters: {
        candidateId: 'ObjectId — direct Candidate._id lookup',
        userId: 'ObjectId — User._id of the candidate',
        jobId: 'ObjectId — Job._id (used with userId for compound lookup)',
      },
    })
  }

  async _execute({ candidateId, userId, jobId }) {
    if (candidateId) {
      return Candidate.findById(candidateId).lean()
    }
    if (userId) {
      // `createdBy` is the RECRUITER who owns the profile. A candidate user id
      // there matched nothing (or the wrong row), so resolve the candidate's
      // email and look the recruiter-owned profile up on (email[, job]).
      const user = await User.findById(userId).select('email').lean()
      const email = normaliseEmail(user?.email)
      if (!email) throw new Error(`Candidate user not found: ${userId}`)

      const filter = { email }
      if (jobId) filter.job = jobId
      return Candidate.findOne(filter).sort({ resumeScore: -1 }).lean()
    }
    throw new Error('candidateId or userId required')
  }
}

// ── getJob ─────────────────────────────────────────────────────────────────────

class GetJobTool extends MCPTool {
  constructor() {
    super({
      name: 'mongodb.getJob',
      description: 'Fetch a job posting by ID with full details',
      parameters: {
        jobId: 'ObjectId — Job._id',
      },
    })
  }

  async _execute({ jobId }) {
    if (!jobId) throw new Error('jobId is required')
    const job = await Job.findById(jobId).lean()
    if (!job) throw new Error(`Job not found: ${jobId}`)
    return job
  }
}

// ── getApplications ───────────────────────────────────────────────────────────

class GetApplicationsTool extends MCPTool {
  constructor() {
    super({
      name: 'mongodb.getApplications',
      description: 'Query applications with flexible filters',
      parameters: {
        jobId: 'ObjectId — filter by job',
        candidateId: 'ObjectId — filter by candidate user',
        status: 'String — filter by status',
        limit: 'Number — max results (default 50)',
      },
    })
  }

  async _execute({ jobId, candidateId, status, limit = 50 }) {
    const filter = {}
    if (jobId) filter.job = jobId
    if (candidateId) filter.candidate = candidateId
    if (status) filter.status = status

    return Application.find(filter)
      .populate('candidate', 'name email')
      .populate('job', 'title company')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean()
  }
}

// ── saveScore ─────────────────────────────────────────────────────────────────

class SaveScoreTool extends MCPTool {
  constructor() {
    super({
      name: 'mongodb.saveScore',
      description: 'Persist AI scores for a candidate on a job',
      parameters: {
        userId: 'ObjectId — candidate User._id',
        jobId: 'ObjectId — Job._id',
        resumeScore: 'Number 0-100',
        codeScore: 'Number 0-100',
        interviewScore: 'Number 0-100',
      },
    })
  }

  async _execute({ userId, jobId, resumeScore, codeScore, interviewScore }) {
    if (!userId || !jobId) throw new Error('userId and jobId are required')

    // One write path: the scoring service resolves the profile by (job, email),
    // clamps the components and recomputes the composite with the shared
    // formula. No local weights, no `createdBy` identity lookup.
    const profile = await applyScoreUpdate({
      candidateUserId: userId,
      jobId,
      updates: { resumeScore, codeScore, interviewScore },
    })

    if (!profile) {
      throw new Error('Candidate record could not be resolved for this user and job')
    }

    return profile.toObject()
  }
}

// ── getSubmissions ────────────────────────────────────────────────────────────

class GetSubmissionsTool extends MCPTool {
  constructor() {
    super({
      name: 'mongodb.getSubmissions',
      description: 'Fetch code submissions for a user on a job',
      parameters: {
        userId: 'ObjectId — User._id',
        jobId: 'ObjectId — Job._id',
      },
    })
  }

  async _execute({ userId, jobId }) {
    const filter = {}
    if (userId) filter.userId = userId
    if (jobId) filter.jobId = jobId
    return Submission.find(filter).sort({ passRate: -1 }).limit(10).lean()
  }
}

// ── getInterviewSessions ──────────────────────────────────────────────────────

class GetInterviewSessionsTool extends MCPTool {
  constructor() {
    super({
      name: 'mongodb.getInterviewSessions',
      description: 'Fetch interview sessions for a candidate or job',
      parameters: {
        candidateId: 'ObjectId — candidate User._id',
        jobId: 'ObjectId — Job._id',
        status: 'String — session status filter',
      },
    })
  }

  async _execute({ candidateId, jobId, status }) {
    const filter = {}
    if (candidateId) filter.candidate = candidateId
    if (jobId) filter.job = jobId
    if (status) filter.status = status
    return InterviewSession.find(filter)
      .populate('candidate', 'name email')
      .populate('job', 'title')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
  }
}

// ── Register all MongoDB MCP tools ────────────────────────────────────────────

export function registerMongoDBTools() {
  mcpRegistry.register(new GetCandidateTool())
  mcpRegistry.register(new GetJobTool())
  mcpRegistry.register(new GetApplicationsTool())
  mcpRegistry.register(new SaveScoreTool())
  mcpRegistry.register(new GetSubmissionsTool())
  mcpRegistry.register(new GetInterviewSessionsTool())
}

export default { registerMongoDBTools }
