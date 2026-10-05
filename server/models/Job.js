import mongoose from 'mongoose'

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: 150,
  },
  company: { type: String, required: true, trim: true },
  location: { type: String, default: 'Remote' },
  type: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'internship'],
    default: 'full-time',
  },
  description: { type: String, required: true },
  requirements: [{ type: String }],
  skills: [{ type: String }],
  salaryMin: { type: Number },
  salaryMax: { type: Number },
  status: {
    type: String,
    enum: ['draft', 'active', 'closed'],
    default: 'active',
  },
  recruiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  applicantCount: { type: Number, default: 0 },
  // Pinecone vector ID for RAG matching
  vectorId: { type: String },
}, { timestamps: true })

jobSchema.index({ title: 'text', description: 'text', skills: 'text' })

export default mongoose.model('Job', jobSchema)
