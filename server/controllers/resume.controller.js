import Candidate from '../models/Candidate.js'
import Application from '../models/Application.js'
import Job from '../models/Job.js'
import { extractTextFromFile } from '../services/parser.service.js'
import { screenResumeWithAI } from '../services/ai.service.js'
import { uploadFile } from '../services/cloudinary.service.js'
import fs from 'fs'
import logger from '../config/logger.js'

// v2 Agent System
import { supervisorAgent } from '../agents/supervisor.agent.js'
import { storeResumeEvaluation } from '../memory/candidate.memory.js'
import { searchCandidates } from '../services/vectorless.service.js'
import { applyResumeResult, normaliseEmail } from '../services/candidateProfile.service.js'

/**
 * POST /api/resume/screen
 * Upload a resume file + jobId → AI screening result.
 * LEGACY: Still supports manual file upload.
 */
export const screenResume = async (req, res) => {
  const filePath = req.file?.path

  try {
    const { jobId, candidateName, candidateEmail } = req.body

    if (!req.file) return res.status(400).json({ message: 'Resume file is required' })
    if (!jobId)    return res.status(400).json({ message: 'jobId is required' })

    // 1. Fetch job description
    const job = await Job.findById(jobId)
    if (!job) return res.status(404).json({ message: 'Job not found' })

    // 2. Extract text from resume (while file is still on disk)
    const resumeText = await extractTextFromFile(filePath)
    if (!resumeText || resumeText.length < 50) {
      return res.status(422).json({ message: 'Could not extract enough text from the file' })
    }

    // 3. Upload resume to Cloudinary (or local fallback)
    let resumePublicId = null
    let resumeUrl      = req.file.filename   // fallback: local temp name

    try {
      const uploadResult = await uploadFile(filePath, 'resumes')
      resumePublicId = uploadResult.publicId
      resumeUrl      = uploadResult.url
    } catch (uploadErr) {
      console.warn('[Resume Screen] Upload skipped:', uploadErr.message)
    }

    // 4. Clean up temp disk file
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)

    // 5. AI screening via Agent System (falls back to direct call)
    const jobDescription = `${job.title} at ${job.company}.\n${job.description}\nRequired skills: ${job.skills?.join(', ')}`
    let aiResult
    try {
      const agentResult = await supervisorAgent.process({
        type: 'analyze-resume',
        resumeText,
        jobDescription,
      })
      aiResult = agentResult.success ? agentResult.data : await screenResumeWithAI(resumeText, jobDescription)
    } catch {
      aiResult = await screenResumeWithAI(resumeText, jobDescription)
    }

    // No fabricated result: if the model did not evaluate, nothing is saved.
    if (!aiResult?.ok) {
      logger.warn('[Resume] Screening unavailable', {
        recruiterId: String(req.user._id), jobId: String(jobId), reason: aiResult?.reason,
      })
      return res.status(503).json({
        message: aiResult?.message || 'AI screening is unavailable right now. No score was recorded.',
        evaluationUnavailable: true,
        reason: aiResult?.reason,
      })
    }

    // 6. Persist through the scoring service — it owns the composite total.
    //    The raw resume score must never be written into `totalScore`: that is
    //    exactly what made a 75-point resume look like a 75/100 candidate.
    const candidate = await applyResumeResult({
      jobId,
      email: normaliseEmail(candidateEmail) || `auto-${Date.now()}@nexthire.ai`,
      name: candidateName || 'Unknown',
      recruiterId: req.user._id,
      resumeScore: aiResult.score,
      resumeFields: {
        resumeText:     resumeText.substring(0, 5000),
        resumeUrl,
        resumePublicId,
        skills:         aiResult.skills || [],
        experience:     aiResult.experience || 0,
        aiSummary:      aiResult.summary || '',
        strengths:      aiResult.strengths || [],
        weaknesses:     aiResult.weaknesses || [],
        ...(aiResult.recommendation === 'hire' || aiResult.recommendation === 'interview'
          ? { status: 'screening' }
          : {}),
      },
    })

    if (!candidate) {
      return res.status(500).json({ message: 'Could not persist the screening result for this candidate' })
    }

    // 7. Store in AI memory (non-blocking)
    storeResumeEvaluation(candidate._id, jobId, aiResult).catch(() => {})

    // NOTE: screening a resume is not an application. Counting it as one
    // inflated `job.applicantCount` (BE-08); the authoritative count is derived
    // from the Application collection instead (see dashboard + reconcile script).

    res.status(201).json({
      candidate,
      aiResult,
      message: `Resume screened successfully. Score: ${aiResult.score}/100`,
      _agent: 'ResumeAgent',
    })
  } catch (err) {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
    console.error('[Resume Screen]', err)
    res.status(500).json({ message: err.message || 'Screening failed' })
  }
}

/**
 * POST /api/resume/screen-application
 * Screen a candidate's resume that was already uploaded during application.
 * No file upload needed — fetches resumeText from Application.
 *
 * Body: { applicationId }  or  { candidateId, jobId }
 */
export const screenFromApplication = async (req, res) => {
  try {
    const { applicationId, candidateId, jobId } = req.body

    // Find the application
    let application
    if (applicationId) {
      application = await Application.findById(applicationId)
        .populate('candidate', 'name email')
        .populate('job', 'title company description skills recruiter')
    } else if (candidateId && jobId) {
      application = await Application.findOne({ candidate: candidateId, job: jobId })
        .populate('candidate', 'name email')
        .populate('job', 'title company description skills recruiter')
    }

    if (!application) {
      return res.status(404).json({ message: 'Application not found' })
    }

    // Verify recruiter owns this job
    if (String(application.job.recruiter) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' })
    }

    // Check resume exists
    if (!application.resumeText || application.resumeText.length < 50) {
      return res.status(404).json({
        message: 'No resume found for this candidate. They may not have uploaded one during application.',
      })
    }

    // Build job description for AI
    const job = application.job
    const jobDescription = `${job.title} at ${job.company}.\n${job.description}\nRequired skills: ${job.skills?.join(', ')}`

    // Run AI screening via Agent System (falls back to direct call)
    let aiResult
    try {
      const agentResult = await supervisorAgent.process({
        type: 'analyze-resume',
        resumeText: application.resumeText,
        jobDescription,
      })
      aiResult = agentResult.success ? agentResult.data : await screenResumeWithAI(application.resumeText, jobDescription)
    } catch {
      aiResult = await screenResumeWithAI(application.resumeText, jobDescription)
    }

    if (!aiResult?.ok) {
      logger.warn('[Resume] Application screening unavailable', {
        recruiterId: String(req.user._id), applicationId: String(application._id), reason: aiResult?.reason,
      })
      return res.status(503).json({
        message: aiResult?.message || 'AI screening is unavailable right now. No score was recorded.',
        evaluationUnavailable: true,
        reason: aiResult?.reason,
      })
    }

    logger.info('[Resume] Screened from application', {
      applicationId: application._id,
      candidate:     application.candidate.name,
      score:         aiResult.score,
    })

    // Update or create the recruiter-owned profile through the scoring service
    const candidate = await applyResumeResult({
      jobId:        application.job._id,
      email:        application.candidate.email,
      name:         application.candidate.name,
      recruiterId:  req.user._id,
      resumeScore:  aiResult.score,
      resumeFields: {
        resumeText:     application.resumeText.substring(0, 5000),
        resumeUrl:      application.resumeUrl,
        resumePublicId: application.resumePublicId,
        skills:         aiResult.skills || [],
        experience:     aiResult.experience || 0,
        aiSummary:      aiResult.summary || '',
        strengths:      aiResult.strengths || [],
        weaknesses:     aiResult.weaknesses || [],
      },
    })

    if (!candidate) {
      return res.status(500).json({ message: 'Could not persist the screening result for this candidate' })
    }

    // Store in AI memory (non-blocking)
    storeResumeEvaluation(candidate._id, application.job._id, aiResult).catch(() => {})

    // Update application status to 'screening'
    if (application.status === 'applied') {
      application.status = 'screening'
      await application.save()
    }

    res.json({
      candidate,
      aiResult,
      application: {
        _id:    application._id,
        status: application.status,
      },
      message: `Resume screened. Score: ${aiResult.score}/100`,
    })
  } catch (err) {
    logger.error('[Resume] screenFromApplication failed', { error: err.message })
    res.status(500).json({ message: err.message || 'Screening failed' })
  }
}

/**
 * POST /api/resume/match
 * Match a job's description against stored candidate data.
 */
export const matchResumes = async (req, res) => {
  try {
    const { jobId, topK = 10, minScore, minExperience, requiredSkills } = req.body
    const job = await Job.findById(jobId)
    if (!job) return res.status(404).json({ message: 'Job not found' })

    // v2: Use vectorless service (MongoDB-native search)
    const vectorlessResults = await searchCandidates(jobId, {
      topK, minScore, minExperience, requiredSkills,
    })

    // Format to preserve backward-compatible response shape
    const matches = vectorlessResults.map(c => ({
      candidateId: c.candidateId,
      score: c.resumeScore || 0,
      relevanceScore: c.relevanceScore || 0,
      skillMatch: c.skillMatch || 0,
      candidate: c,
    }))

    res.json({ matches, count: matches.length, method: 'vectorless' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/**
 * GET /api/resume/history
 * Get all screened resumes for this recruiter
 */
export const getScreeningHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query
    const skip = (page - 1) * limit
    const candidates = await Candidate.find({ createdBy: req.user._id, resumeScore: { $gt: 0 } })
      .populate('job', 'title company')
      .sort('-createdAt')
      .skip(skip)
      .limit(Number(limit))
    res.json({ candidates })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
