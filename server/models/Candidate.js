import mongoose from 'mongoose'

const candidateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String },
  location: { type: String },

  // Resume
  resumeUrl:      { type: String },   // Cloudinary secure URL or local path
  resumePublicId: { type: String },   // Cloudinary public_id (or local path for fallback)
  resumeText:     { type: String },   // extracted raw text

  // Skills & background
  skills: [{ type: String }],
  experience: { type: Number, default: 0 }, // years
  currentRole: { type: String },
  education: { type: String },
  linkedIn: { type: String },
  github: { type: String },

  // AI Scores
  resumeScore: { type: Number, min: 0, max: 100, default: 0 },
  codeScore:   { type: Number, min: 0, max: 100, default: 0 },
  interviewScore: { type: Number, min: 0, max: 100, default: 0 },
  totalScore:  { type: Number, min: 0, max: 100, default: 0 },

  // AI Feedback
  aiSummary: { type: String },
  strengths:  [{ type: String }],
  weaknesses: [{ type: String }],

  // Status
  status: {
    type: String,
    enum: ['applied', 'screening', 'interview', 'shortlisted', 'rejected', 'hired'],
    default: 'applied',
  },

  // Relations
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

// Text index for free MongoDB-based resume matching
candidateSchema.index({ resumeText: 'text', skills: 'text', name: 'text' })

// Compound index for fast lookups
candidateSchema.index({ email: 1, job: 1 })
candidateSchema.index({ createdBy: 1, resumeScore: -1 })

export default mongoose.model('Candidate', candidateSchema)
