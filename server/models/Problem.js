import mongoose from 'mongoose'

const testCaseSchema = new mongoose.Schema({
  input:          { type: String, default: '' },
  expectedOutput: { type: String, required: true },
  isHidden:       { type: Boolean, default: false },
  explanation:    { type: String },
})

const problemSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  slug:        { type: String, unique: true, lowercase: true },
  description: { type: String, required: true },
  difficulty:  { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  tags:        [{ type: String }],
  constraints: { type: String },
  examples: [{
    input:       { type: String },
    output:      { type: String },
    explanation: { type: String },
  }],
  testCases:    [testCaseSchema],
  starterCode: {
    javascript: { type: String, default: '// Write your solution here\nfunction solution(input) {\n  \n}' },
    python:     { type: String, default: '# Write your solution here\ndef solution(input):\n    pass' },
    java:       { type: String, default: 'public class Solution {\n    public static void main(String[] args) {\n        \n    }\n}' },
    cpp:        { type: String, default: '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}' },
  },
  timeLimit:    { type: Number, default: 2000 },  // ms
  memoryLimit:  { type: Number, default: 256 },   // MB
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isPublic:     { type: Boolean, default: true },
}, { timestamps: true })

// Auto-generate slug
problemSchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }
  next()
})

export default mongoose.model('Problem', problemSchema)
