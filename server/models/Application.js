import mongoose from 'mongoose'

const applicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: [true, 'Job reference is required'],
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Candidate reference is required'],
    },
    coverLetter: {
      type: String,
      maxlength: [2000, 'Cover letter cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: ['applied', 'screening', 'interview', 'shortlisted', 'rejected', 'hired'],
      default: 'applied',
    },

    // ── Resume (single source of truth) ─────────────────────────────────────
    resumeUrl:      { type: String },   // Cloudinary URL or local path
    resumePublicId: { type: String },   // Cloudinary public_id or local filename
    resumeText:     { type: String },   // Extracted plain text (for AI screening)

    // Recruiter notes — not visible to candidate
    recruiterNote: { type: String, maxlength: 1000, select: false },
  },
  { timestamps: true }
)

// One candidate can only apply once per job
applicationSchema.index({ job: 1, candidate: 1 }, { unique: true })

// Text index on resumeText for search/matching
applicationSchema.index({ resumeText: 'text' })

export default mongoose.model('Application', applicationSchema)
