import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  role:      { type: String, enum: ['interviewer', 'candidate'], required: true },
  content:   { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  category:  { type: String },           // technical | behavioral | system-design
  difficulty:{ type: String },           // easy | medium | hard
  score:     { type: Number },           // AI evaluation score for candidate's answer
  feedback:  { type: String },           // AI feedback on the answer
})

const interviewSessionSchema = new mongoose.Schema({
  candidate:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',      required: true },
  job:         { type: mongoose.Schema.Types.ObjectId, ref: 'Job',       required: true },
  recruiter:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',      required: true },
  jobTitle:    { type: String },
  messages:    [messageSchema],
  status:      { type: String, enum: ['pending', 'active', 'completed', 'abandoned'], default: 'pending' },
  round:       { type: Number, default: 1 },
  questionCount: { type: Number, default: 0 },

  // Scores per dimension (recruiter-initiated flow)
  scores: {
    technical:   { type: Number, default: 0 },
    behavioral:  { type: Number, default: 0 },
    communication: { type: Number, default: 0 },
    overall:     { type: Number, default: 0 },
  },

  // Final AI summary (recruiter-initiated flow)
  summary:     { type: String },
  strengths:   [String],
  concerns:    [String],
  recommendation: { type: String, enum: ['hire', 'interview-next', 'reject', 'pending'], default: 'pending' },

  // ── Candidate-initiated interview fields ─────────────────────────────────
  answers: [{
    question:   { type: String },
    answerText: { type: String, default: '' },
    score:      { type: Number, default: 0 },
    feedback:   { type: String, default: '' },
    // False only when AI evaluation failed: the answer is kept but must not be
    // counted as a genuine zero in the final average.
    evaluated:  { type: Boolean, default: true },
  }],
  finalScore:  { type: Number, default: 0 },
  // Whether the final score came from a real AI evaluation. 'unavailable'
  // means the interview finished but nothing could be evaluated — the score
  // must not be presented as a real (zero) result.
  evaluationStatus: {
    type: String,
    enum: ['pending', 'evaluated', 'unavailable'],
    default: 'pending',
  },
  completed:   { type: Boolean, default: false },
  initiatedBy: { type: String, enum: ['recruiter', 'candidate'], default: 'recruiter' },

  startedAt:   { type: Date },
  // When a recruiter books the interview, the candidate is told this slot.
  scheduledAt: { type: Date },
  completedAt: { type: Date },
  durationMin: { type: Number },
}, { timestamps: true })

// Recruiter workspace resolves a candidate's interview state per job
interviewSessionSchema.index({ job: 1, candidate: 1, initiatedBy: 1 })
// One candidate-initiated interview per candidate per job. Recruiter-initiated
// rounds are untouched because of the partial filter.
interviewSessionSchema.index(
  { candidate: 1, job: 1 },
  {
    unique: true,
    partialFilterExpression: { initiatedBy: 'candidate' },
    name: 'unique_candidate_interview_per_job',
  }
)
interviewSessionSchema.index({ completed: 1, completedAt: -1 })

export default mongoose.model('InterviewSession', interviewSessionSchema)
