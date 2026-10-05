import Application from '../models/Application.js'
import Job from '../models/Job.js'
import { extractTextFromFile } from '../services/parser.service.js'
import { uploadFile } from '../services/cloudinary.service.js'
import fs from 'fs'
import logger from '../config/logger.js'

// ─── CANDIDATE ──────────────────────────────────────────────────────────────

/**
 * POST /api/applications
 * Candidate applies to a job.
 * Accepts multipart/form-data with optional resume file.
 * Fields: jobId, coverLetter (optional), resume (file, optional)
 */
export const applyToJob = async (req, res) => {
  const filePath = req.file?.path

  try {
    const { jobId, coverLetter } = req.body

    if (!jobId)
      return res.status(400).json({ message: 'jobId is required' })

    // Confirm job exists and is active
    const job = await Job.findOne({ _id: jobId, status: 'active' })
    if (!job)
      return res.status(404).json({ message: 'Job not found or no longer active' })

    // ── Process resume if uploaded ────────────────────────────────────────
    let resumeUrl      = null
    let resumePublicId = null
    let resumeText     = null

    if (req.file) {
      // 1. Extract text from PDF/DOC/TXT
      try {
        resumeText = await extractTextFromFile(filePath)
        if (resumeText) resumeText = resumeText.substring(0, 10000) // cap at 10k chars
        logger.info('[Application] Resume text extracted', {
          length: resumeText?.length || 0,
          file:   req.file.originalname,
        })
      } catch (parseErr) {
        logger.warn('[Application] Resume text extraction failed', { error: parseErr.message })
        // Continue without text — file is still uploaded
      }

      // 2. Upload to Cloudinary (or local fallback)
      try {
        const uploaded = await uploadFile(filePath, 'resumes')
        resumeUrl      = uploaded.url
        resumePublicId = uploaded.publicId
      } catch (uploadErr) {
        logger.warn('[Application] Cloudinary upload failed, using local', { error: uploadErr.message })
        // Fallback: serve from local uploads
        resumeUrl = `/uploads/resumes/${req.file.filename}`
        resumePublicId = req.file.filename
      }

      // 3. Clean up temp file (if Cloudinary handled it)
      if (filePath && fs.existsSync(filePath) && resumeUrl?.startsWith('http')) {
        fs.unlinkSync(filePath)
      }
    }

    // ── Create application ───────────────────────────────────────────────
    const application = await Application.create({
      job: jobId,
      candidate: req.user._id,
      coverLetter,
      resumeUrl,
      resumePublicId,
      resumeText,
    })

    // Increment job applicant counter
    await Job.findByIdAndUpdate(jobId, { $inc: { applicantCount: 1 } })

    const populated = await application.populate('job', 'title company location')

    // Real-time notification to recruiter (non-blocking)
    try {
      const pushToUser = req.app.get('pushToUser')
      pushToUser?.(String(job.recruiter), 'new-application', {
        candidateId:   req.user._id,
        candidateName: req.user.name,
        jobId,
        jobTitle:      job.title,
        hasResume:     !!resumeUrl,
      })
    } catch { /* non-blocking */ }

    logger.info('[Application] Created', {
      applicationId: application._id,
      candidate:     req.user.name,
      job:           job.title,
      hasResume:     !!resumeUrl,
      resumeTextLen: resumeText?.length || 0,
    })

    res.status(201).json({ application: populated })
  } catch (err) {
    // Clean up temp file on error
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath) } catch { /* ignore */ }
    }
    // Mongoose duplicate key error
    if (err.code === 11000)
      return res.status(409).json({ message: 'You have already applied to this job' })
    res.status(500).json({ message: err.message })
  }
}

/**
 * GET /api/applications/mine
 * Candidate views their own applications.
 */
export const getMyApplications = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query
    const filter = { candidate: req.user._id }
    if (status) filter.status = status

    const skip = (Number(page) - 1) * Number(limit)
    const [applications, total] = await Promise.all([
      Application.find(filter)
        .populate('job', 'title company location type status')
        .select('-resumeText')   // don't send full text to candidate list view
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Application.countDocuments(filter),
    ])

    res.json({
      applications,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/**
 * GET /api/applications/mine/job-ids
 * Small lookup used by Browse Jobs to mark roles the candidate already applied for.
 */
export const getMyApplicationJobIds = async (req, res) => {
  try {
    const jobIds = await Application.distinct('job', { candidate: req.user._id })
    res.json({ jobIds: jobIds.map(String) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/**
 * DELETE /api/applications/:id
 * Candidate withdraws their application (only if still 'applied').
 */
export const withdrawApplication = async (req, res) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      candidate: req.user._id,
    })

    if (!application)
      return res.status(404).json({ message: 'Application not found' })

    if (application.status !== 'applied')
      return res.status(400).json({ message: 'Cannot withdraw — application is already in review' })

    await application.deleteOne()
    await Job.findByIdAndUpdate(application.job, { $inc: { applicantCount: -1 } })

    res.json({ message: 'Application withdrawn successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─── RECRUITER ──────────────────────────────────────────────────────────────

/**
 * GET /api/applications/job/:jobId
 * Recruiter views all applicants for one of their jobs.
 * Includes resume indicators.
 */
export const getApplicantsByJob = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, sort = '-createdAt' } = req.query

    // Ensure the job belongs to this recruiter
    const job = await Job.findOne({ _id: req.params.jobId, recruiter: req.user._id })
    if (!job)
      return res.status(404).json({ message: 'Job not found or access denied' })

    const filter = { job: req.params.jobId }
    if (status) filter.status = status

    const skip = (Number(page) - 1) * Number(limit)
    const [applications, total] = await Promise.all([
      Application.find(filter)
        .populate('candidate', 'name email avatar')
        .select('-resumeText')   // don't send full text in list view
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Application.countDocuments(filter),
    ])

    res.json({
      job: { id: job._id, title: job.title, company: job.company },
      applications,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/**
 * GET /api/applications/:id/resume
 * Recruiter fetches full resume data for a specific application (for AI screening).
 */
export const getApplicationResume = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('candidate', 'name email')
      .populate('job', 'title company description skills recruiter')

    if (!application)
      return res.status(404).json({ message: 'Application not found' })

    // Verify recruiter owns this job
    if (String(application.job.recruiter) !== String(req.user._id))
      return res.status(403).json({ message: 'Access denied' })

    if (!application.resumeText && !application.resumeUrl) {
      return res.status(404).json({ message: 'No resume found for this application' })
    }

    res.json({
      application: {
        _id:            application._id,
        candidate:      application.candidate,
        job:            application.job,
        resumeUrl:      application.resumeUrl,
        resumeText:     application.resumeText,
        status:         application.status,
      },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/**
 * PATCH /api/applications/:id/status
 * Recruiter updates the status of an application.
 */
export const updateApplicationStatus = async (req, res) => {
  try {
    const { status, recruiterNote } = req.body

    const VALID_STATUSES = ['applied', 'screening', 'interview', 'shortlisted', 'rejected', 'hired']
    if (!status || !VALID_STATUSES.includes(status))
      return res.status(400).json({ message: `status must be one of: ${VALID_STATUSES.join(', ')}` })

    // Verify the application's job belongs to this recruiter
    const application = await Application.findById(req.params.id).populate('job', 'recruiter')
    if (!application)
      return res.status(404).json({ message: 'Application not found' })

    if (String(application.job.recruiter) !== String(req.user._id))
      return res.status(403).json({ message: 'Not authorized to update this application' })

    const update = { status }
    if (recruiterNote !== undefined) update.recruiterNote = recruiterNote

    const updated = await Application.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('candidate', 'name email')
      .populate('job', 'title company')

    res.json({ application: updated })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
