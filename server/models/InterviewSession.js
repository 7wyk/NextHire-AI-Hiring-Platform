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
  }],
  finalScore:  { type: Number, default: 0 },
  completed:   { type: Boolean, default: false },
  initiatedBy: { type: String, enum: ['recruiter', 'candidate'], default: 'recruiter' },

  startedAt:   { type: Date },
  completedAt: { type: Date },
  durationMin: { type: Number },
}, { timestamps: true })

export default mongoose.model('InterviewSession', interviewSessionSchema)
