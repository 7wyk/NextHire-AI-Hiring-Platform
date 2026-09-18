import 'dotenv/config'  // ← must be first; loads .env before any other module
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { createServer } from 'http'
import { Server as SocketIO } from 'socket.io'
import rateLimit from 'express-rate-limit'

import connectDB from './config/db.js'
import logger from './config/logger.js'

// ── v2 Agent System ────────────────────────────────────────────────────────
import { registerMongoDBTools } from './mcp/mongodb.mcp.js'
import { registerResumeTools } from './mcp/resume.mcp.js'
import { registerJudge0Tools } from './mcp/judge0.mcp.js'
import { registerCloudinaryTools } from './mcp/cloudinary.mcp.js'
import { registerNotificationTools, setSocketHelpers } from './mcp/notification.mcp.js'
import agentRoutes from './routes/agent.routes.js'
import { registerInterviewSockets } from './sockets/interview.socket.js'
import { registerNotificationSockets } from './sockets/notification.socket.js'

// Route imports
import authRoutes from './routes/auth.routes.js'
import candidateRoutes from './routes/candidate.routes.js'
import jobRoutes from './routes/job.routes.js'
import applicationRoutes from './routes/application.routes.js'
import resumeRoutes from './routes/resume.routes.js'
import codeRoutes from './routes/code.routes.js'
import interviewRoutes from './routes/interview.routes.js'
import aiRoutes from './routes/ai.routes.js'
import uploadRoutes from './routes/upload.routes.js'
import codingTestRoutes from './routes/codingTest.routes.js'
import dashboardRoutes from './routes/dashboard.routes.js'


// ── App bootstrap ──────────────────────────────────────────────────────────
const app = express()
const httpServer = createServer(app)

const CLIENT_ORIGIN = process.env.CLIENT_URL || 'http://localhost:5173'

// ── Socket.IO ──────────────────────────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
})

// Make io accessible in controllers via req.app.get('io')
app.set('io', io)

// Register namespaced socket handlers
registerInterviewSockets(io)
const { pushToUser, broadcastToRecruiters } = registerNotificationSockets(io)
app.set('pushToUser', pushToUser)
app.set('broadcastToRecruiters', broadcastToRecruiters)

// Inject Socket helpers into notification MCP tools (decoupled boot)
setSocketHelpers(pushToUser, broadcastToRecruiters)

// ── Database ───────────────────────────────────────────────────────────────
connectDB()

// ── Register MCP Tools (after DB ready) ────────────────────────────────────
registerMongoDBTools()
registerResumeTools()
registerJudge0Tools()
registerCloudinaryTools()
registerNotificationTools()
logger.info('✅ MCP tools registered')

// ── Security Middleware ────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))
app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))

// Global rate limiter (200 req / 15 min per IP)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests — slow down.' },
}))

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many auth attempts. Try again later.' },
})

// ── Body / Logging Middleware ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Serve uploaded files (local fallback when Cloudinary not configured)
app.use('/uploads', express.static('uploads'))

// Morgan → Winston
app.use(morgan('combined', { stream: logger.stream }))

// Request-ID middleware for tracing
app.use((req, _res, next) => {
  req.requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  next()
})

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/candidates', candidateRoutes)
app.use('/api/jobs', jobRoutes)
app.use('/api/applications', applicationRoutes)
app.use('/api/resume', resumeRoutes)
app.use('/api/code', codeRoutes)
app.use('/api/interview', interviewRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/coding-test', codingTestRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/agents', agentRoutes)

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'NextHire AI API',
    version: process.env.npm_package_version || '2.0.0',
    env: process.env.NODE_ENV || 'development',
    architecture: 'multi-agent-mcp-vectorless',
  })
})

// ── 404 Handler ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

// ── Global Error Handler ───────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error('[Unhandled Error]', {
    message: err.message,
    stack: err.stack,
    requestId: req.requestId,
    path: req.path,
    method: req.method,
  })
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    requestId: req.requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
})

// ── Start Server ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000

httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 NextHire AI v2 Server started`, {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    url: `http://0.0.0.0:${PORT}`,
    architecture: 'Multi-Agent + MCP + Vectorless',
  })
})

export default app  // needed for Jest supertest
