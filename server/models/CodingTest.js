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

// Archived question set, created every time the recruiter regenerates.
const versionSchema = new mongoose.Schema(
  {
    revision:    { type: Number, required: true },
    role:        { type: String },
    difficulty:  { type: String },
    generatedBy: { type: String },
    questions:   [questionSchema],
    createdAt:   { type: Date, default: Date.now },
  },
  { _id: false }
)

// One candidate's attempt on this test.
const attemptSchema = new mongoose.Schema(
  {
    startedAt:   { type: Date },
    revision:    { type: Number },
    submittedAt: { type: Date },
    // Number of starts used (an abandoned, expired attempt can be restarted
    // within the configured cap).
    attemptsUsed: { type: Number, default: 1 },
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
    // Provenance of the questions: 'mock' is only possible when the server is
    // running in explicit AI_MOCK_MODE (never production).
    generatedBy: {
      type: String,
      enum: ['ai', 'mock'],
      default: 'ai',
    },
    questions: [questionSchema],

    // ── Versioning (CA-06) ─────────────────────────────────────────────────
    // Regenerating a test used to replace `questions` under candidates who had
    // already started. Each generation now bumps `revision`; the previous
    // question set is archived in `versions`, and every attempt is pinned to
    // the revision that was live when it started.
    revision: { type: Number, default: 1, min: 1 },
    versions: [versionSchema],

    // Per-candidate attempt: start time + the revision it is graded against.
    attempts: {
      type: Map,
      of: attemptSchema,
      default: {},
    },

    // Legacy start map (pre-versioning). Kept so in-flight attempts survive the
    // upgrade; new starts are written to `attempts`.
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
