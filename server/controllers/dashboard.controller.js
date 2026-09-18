/**
 * dashboard.controller.js
 *
 * Provides real-time aggregated metrics for the recruiter dashboard.
 * ALL values come from actual database queries — zero mock data.
 *
 * Data sources:
 *   - Job        → recruiter's job postings
 *   - Application → candidate applications (the primary source of truth)
 *   - Candidate  → AI-screened profiles (created during resume screening)
 *   - InterviewSession → completed interviews
 */

import Job from '../models/Job.js'
import Application from '../models/Application.js'
import Candidate from '../models/Candidate.js'
import InterviewSession from '../models/InterviewSession.js'
import logger from '../config/logger.js'

// GET /api/dashboard
export const getDashboardStats = async (req, res) => {
  try {
    const recruiterId = req.user._id

    // ── STEP 1: Get all job IDs owned by this recruiter ────────────────────
    const jobs = await Job.find({ recruiter: recruiterId }).select('_id')
    const jobIds = jobs.map(j => j._id)

    logger.info('[Dashboard] Step 1 — Recruiter jobs', {
      recruiterId: String(recruiterId),
      jobCount: jobIds.length,
      jobIds: jobIds.map(id => String(id)),
    })

    // If recruiter has no jobs, return zeros immediately
    if (jobIds.length === 0) {
      logger.info('[Dashboard] No jobs found for recruiter — returning zeros')
      return res.json({
        applications: 0,
        candidates: 0,
        interviews: 0,
        resumesScreened: 0,
        jobs: 0,
        pipeline: {
          applied: 0, screening: 0, interview: 0,
          shortlisted: 0, hired: 0, rejected: 0,
        },
        recentApplications: [],
        recentJobs: [],
      })
    }

    // ── STEP 2: Count total applications for recruiter's jobs ──────────────
    const applications = await Application.countDocuments({
      job: { $in: jobIds },
    })

    logger.info('[Dashboard] Step 2 — Applications count', { applications })

    // ── STEP 3: Count unique candidates who applied ───────────────────────
    const uniqueCandidateIds = await Application.distinct('candidate', {
      job: { $in: jobIds },
    })
    const candidates = uniqueCandidateIds.length

    logger.info('[Dashboard] Step 3 — Unique candidates', { candidates })

    // ── STEP 4: Resumes screened ──────────────────────────────────────────
    // Source A: Candidate collection (created during manual/AI resume screening)
    //   These have job field set + resumeScore > 0
    const screenedViaCandidate = await Candidate.countDocuments({
      job: { $in: jobIds },
      resumeScore: { $gt: 0 },
    })

    // Source B: Also count by createdBy (recruiter) in case job link is missing
    const screenedByRecruiter = await Candidate.countDocuments({
      createdBy: recruiterId,
      resumeScore: { $gt: 0 },
    })

    // Source C: Applications that have resumeText (resume uploaded during apply)
    const appsWithResume = await Application.countDocuments({
      job: { $in: jobIds },
      resumeText: { $exists: true, $ne: null, $ne: '' },
    })

    // Source D: Applications with status beyond 'applied' (implies screening happened)
    const appsScreened = await Application.countDocuments({
      job: { $in: jobIds },
      status: { $in: ['screening', 'interview', 'shortlisted', 'hired'] },
    })

    // Take the maximum — covers all paths resume data enters the system
    const resumesScreened = Math.max(
      screenedViaCandidate,
      screenedByRecruiter,
      appsWithResume,
      appsScreened
    )

    logger.info('[Dashboard] Step 4 — Resumes screened', {
      screenedViaCandidate,
      screenedByRecruiter,
      appsWithResume,
      appsScreened,
      finalResumesScreened: resumesScreened,
    })

    // ── STEP 5: Completed interviews ──────────────────────────────────────
    // Try both query strategies: by job + completed flag, and by recruiter field
    const interviewsByJob = await InterviewSession.countDocuments({
      job: { $in: jobIds },
      completed: true,
    })

    const interviewsByRecruiter = await InterviewSession.countDocuments({
      recruiter: recruiterId,
      completed: true,
    })

    const interviews = Math.max(interviewsByJob, interviewsByRecruiter)

    logger.info('[Dashboard] Step 5 — Interviews', {
      interviewsByJob,
      interviewsByRecruiter,
      finalInterviews: interviews,
    })

    // ── STEP 6: Pipeline breakdown by application status ──────────────────
    const pipeline = {
      applied: 0, screening: 0, interview: 0,
      shortlisted: 0, hired: 0, rejected: 0,
    }

    const statusCounts = await Application.aggregate([
      { $match: { job: { $in: jobIds } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])

    for (const sc of statusCounts) {
      if (sc._id && pipeline.hasOwnProperty(sc._id)) {
        pipeline[sc._id] = sc.count
      }
    }

    logger.info('[Dashboard] Step 6 — Pipeline', { pipeline })

    // ── STEP 7: Recent applications (last 6) ─────────────────────────────
    const recentApplications = await Application.find({ job: { $in: jobIds } })
      .sort('-createdAt')
      .limit(6)
      .populate('candidate', 'name email')
      .populate('job', 'title company')
      .select('-resumeText')
      .lean()

    // ── STEP 8: Recent jobs with real applicant counts ────────────────────
    const recentJobs = await Job.find({ recruiter: recruiterId })
      .sort('-createdAt')
      .limit(5)
      .lean()

    // Compute real applicant count per job (don't rely on the cached field)
    const jobApplicantCounts = await Application.aggregate([
      { $match: { job: { $in: recentJobs.map(j => j._id) } } },
      { $group: { _id: '$job', count: { $sum: 1 } } },
    ])
    const countMap = {}
    for (const jc of jobApplicantCounts) {
      countMap[String(jc._id)] = jc.count
    }
    for (const j of recentJobs) {
      j.applicantCount = countMap[String(j._id)] || 0
    }

    // ── FINAL: Assemble and return ────────────────────────────────────────
    const result = {
      applications,
      candidates,
      interviews,
      resumesScreened,
      jobs: jobIds.length,
      pipeline,
      recentApplications,
      recentJobs,
    }

    logger.info('[Dashboard] ✅ Final result', {
      recruiterId: String(recruiterId),
      applications,
      candidates,
      interviews,
      resumesScreened,
      jobs: jobIds.length,
    })

    res.json(result)
  } catch (err) {
    logger.error('[Dashboard] ❌ getDashboardStats FAILED', {
      error: err.message,
      stack: err.stack,
      userId: String(req.user?._id),
    })
    res.status(500).json({ message: err.message })
  }
}
