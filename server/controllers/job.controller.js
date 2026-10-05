import Job from '../models/Job.js'

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC / CANDIDATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/jobs/public
 * Anyone (including candidates) can browse active jobs.
 */
export const getPublicJobs = async (req, res) => {
  try {
    const { search, location, type, page = 1, limit = 10 } = req.query

    const filter = { status: 'active' }
    if (search)   filter.$text    = { $search: search }
    if (location) filter.location = new RegExp(location, 'i')
    if (type)     filter.type     = type

    const skip = (Number(page) - 1) * Number(limit)
    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .select('-vectorId')
        .populate('recruiter', 'name company')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Job.countDocuments(filter),
    ])

    res.json({ jobs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECRUITER / ADMIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/jobs
 * Recruiter: returns only their own jobs.
 * Admin: returns all jobs.
 */
export const getJobs = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query

    // Admins see all; recruiters see only their own
    const filter = req.user.role === 'admin' ? {} : { recruiter: req.user._id }
    if (status) filter.status = status
    if (search) filter.$text  = { $search: search }

    const skip = (Number(page) - 1) * Number(limit)
    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .populate('recruiter', 'name email company')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Job.countDocuments(filter),
    ])

    res.json({ jobs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/**
 * POST /api/jobs
 * Recruiter creates a job.
 */
export const createJob = async (req, res) => {
  try {
    const { title, company, location, type, description, requirements, skills, salaryMin, salaryMax } = req.body

    if (!title || !description)
      return res.status(400).json({ message: 'title and description are required' })

    const job = await Job.create({
      title,
      company: company || req.user.company,
      location,
      type,
      description,
      requirements,
      skills,
      salaryMin,
      salaryMax,
      recruiter: req.user._id,
    })

    res.status(201).json({ job })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/**
 * GET /api/jobs/:id
 * Recruiter gets one of their jobs. Admin can get any.
 */
export const getJob = async (req, res) => {
  try {
    const filter = { _id: req.params.id }
    if (req.user.role !== 'admin') filter.recruiter = req.user._id

    const job = await Job.findOne(filter).populate('recruiter', 'name email company')
    if (!job) return res.status(404).json({ message: 'Job not found' })

    res.json({ job })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/**
 * PUT /api/jobs/:id
 * Recruiter updates their job. Admin can update any.
 */
export const updateJob = async (req, res) => {
  try {
    // Strip read-only fields
    const { recruiter, applicantCount, vectorId, ...updates } = req.body

    const filter = { _id: req.params.id }
    if (req.user.role !== 'admin') filter.recruiter = req.user._id

    const job = await Job.findOneAndUpdate(filter, updates, { new: true, runValidators: true })
    if (!job) return res.status(404).json({ message: 'Job not found or access denied' })

    res.json({ job })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/**
 * DELETE /api/jobs/:id
 * Recruiter deletes their job. Admin can delete any.
 */
export const deleteJob = async (req, res) => {
  try {
    const filter = { _id: req.params.id }
    if (req.user.role !== 'admin') filter.recruiter = req.user._id

    const job = await Job.findOneAndDelete(filter)
    if (!job) return res.status(404).json({ message: 'Job not found or access denied' })

    res.json({ message: 'Job deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
