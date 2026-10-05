import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: 100,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 8,
    select: false,
  },
  role: {
    type: String,
    enum: ['recruiter', 'admin', 'candidate'],
    default: 'candidate',
  },
  avatar:       { type: String },
  company:      { type: String },
  isActive:     { type: Boolean, default: true },

  // Refresh token (stored as hashed value)
  refreshToken: { type: String, select: false },

  // Security tracking
  lastLogin:      { type: Date },
  loginAttempts:  { type: Number, default: 0 },
  lockUntil:      { type: Date },

  // Email verification
  isEmailVerified: { type: Boolean, default: false },
  verifyToken:     { type: String, select: false },

  // Password reset
  resetToken:       { type: String,  select: false },
  resetTokenExpiry: { type: Date,    select: false },
}, { timestamps: true })

// Virtual: is account currently locked?
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now())
})

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

export default mongoose.model('User', userSchema)
