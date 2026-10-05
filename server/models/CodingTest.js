import mongoose from 'mongoose'

const testCaseSchema = new mongoose.Schema(
  {
    input:  { type: String, default: '' },
    output: { type: String, required: true },
  },
  { _id: false }
)

const questionSchema = new mongoose.Schema(
  {
    question:   { type: String, required: true },
    testCases:  [testCaseSchema],
    timeLimit:  { type: Number, default: 15 }, // minutes per question
  },
  { _id: false }
)

const codingTestSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    role: { type: String, default: 'Software Engineer' },
    questions: [questionSchema],
    // Tracks when each candidate started the test
    // key = candidateId (string), value = ISO date string
    sessions: {
      type: Map,
      of: String,
      default: {},
    },
  },
  { timestamps: true }
)

// Only one test per job
codingTestSchema.index({ jobId: 1 }, { unique: true })

export default mongoose.model('CodingTest', codingTestSchema)
