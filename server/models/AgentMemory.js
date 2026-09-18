/**
 * AgentMemory.js
 *
 * Mongoose model for persistent AI memory storage.
 * Stores agent interactions, evaluations, and context for
 * personalized AI experiences across sessions.
 */

import mongoose from 'mongoose'

const agentMemorySchema = new mongoose.Schema({
  // What type of agent created this memory
  agentType: {
    type: String,
    enum: ['resume', 'interview', 'coding', 'ranking', 'notification', 'supervisor'],
    required: true,
    index: true,
  },

  // Who this memory is about / belongs to
  entityType: {
    type: String,
    enum: ['candidate', 'recruiter', 'job', 'session'],
    required: true,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },

  // What kind of memory this is
  memoryType: {
    type: String,
    enum: [
      'evaluation',       // AI evaluation result
      'interaction',      // User interaction record
      'preference',       // User preference / pattern
      'context',          // Contextual information
      'conversation',     // Chat / interview turn
      'decision',         // Recruiter decision (hire/reject/etc.)
      'search',           // Search query and results
      'feedback',         // AI-generated feedback
    ],
    required: true,
    index: true,
  },

  // The actual memory content
  content: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },

  // Optional metadata for filtering / retrieval
  metadata: {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    sessionId: { type: mongoose.Schema.Types.ObjectId },
    score: { type: Number },
    tags: [{ type: String }],
    importance: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
  },

  // Summary for quick retrieval (used in LLM context windows)
  summary: { type: String },

  // TTL: auto-expire old memories (optional, in seconds)
  expiresAt: { type: Date },
}, {
  timestamps: true,
})

// Compound indexes for fast retrieval
agentMemorySchema.index({ entityType: 1, entityId: 1, memoryType: 1 })
agentMemorySchema.index({ agentType: 1, entityId: 1, createdAt: -1 })
agentMemorySchema.index({ 'metadata.jobId': 1, entityId: 1 })

// TTL index — MongoDB auto-deletes documents when expiresAt passes
agentMemorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

// Text index for memory search
agentMemorySchema.index({ summary: 'text' })

export default mongoose.model('AgentMemory', agentMemorySchema)
