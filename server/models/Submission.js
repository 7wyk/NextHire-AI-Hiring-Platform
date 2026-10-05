import mongoose from 'mongoose'

const testResultSchema = new mongoose.Schema(
  {
    input:    { type: String },
    expected: { type: String },
    actual:   { type: String },
    passed:   { type: Boolean },
    time:     { type: String },
    memory:   { type: String },
    error:    { type: String },
  },
  { _id: false }
)

const aiFeedbackSchema = new mongoose.Schema(
  {
    codeQuality:     { type: String },              // 'poor' | 'fair' | 'good' | 'excellent'
    timeComplexity:  { type: String },              // e.g. 'O(n)'
    spaceComplexity: { type: String },              // e.g. 'O(1)'
    feedback:        { type: String },              // narrative explanation
    improvements:    [{ type: String }],            // list of suggestions
    score:           { type: Number, default: 0 },  // 0-100
  },
  { _id: false }
)

const submissionSchema = new mongoose.Schema(
  {
    // Who submitted
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Which standalone problem (optional)
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem',
      index: true,
    },
    problemSlug: { type: String },

    // Linked to a job's coding test
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      index: true,
      default: null,
    },

    // Submitted code
    code:     { type: String, required: true },
    language: { type: String, required: true },

    // Execution output
    stdout:        { type: String, default: '' },
    stderr:        { type: String, default: '' },
    compileOutput: { type: String, default: '' },

    // Verdict
    verdict: {
      type: String,
      enum: ['Accepted', 'Partial', 'Wrong Answer', 'Runtime Error', 'Compilation Error', 'Run'],
      default: 'Run',
    },
    status: {
      type: String,
      enum: ['pending', 'done', 'error'],
      default: 'done',
    },

    // Score metrics
    passed:   { type: Number, default: 0 },
    total:    { type: Number, default: 0 },
    passRate: { type: Number, default: 0 },   // 0–100

    // Per-test details
    testResults: [testResultSchema],

    // AI code quality feedback
    aiFeedback: aiFeedbackSchema,

    // Execution metadata
    time:   { type: String },
    memory: { type: String },
  },
  { timestamps: true }
)

// Fast lookup: all submissions by a user for a specific job test
submissionSchema.index({ userId: 1, jobId: 1, createdAt: -1 })
// Standalone problem submissions
submissionSchema.index({ userId: 1, problemId: 1, createdAt: -1 })

export default mongoose.model('Submission', submissionSchema)
