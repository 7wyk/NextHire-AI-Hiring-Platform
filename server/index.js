import 'dotenv/config'  // ← must be first; loads .env before any other module
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import mongoose from 'mongoose'
import { createServer } from 'http'
import { Server as SocketIO } from 'socket.io'

import connectDB from './config/db.js'
import logger from './config/logger.js'
import { resolvePort } from './config/port.js'
import { cookieParser } from './config/cookies.js'
import { globalLimiter, agentMonitorLimiter } from './middlewares/rateLimit.middleware.js'
import { sanitizeInput, csrfProtection } from './middlewares/security.middleware.js'
import { isEmailConfigured, emailMode } from './services/email.service.js'
import { isJudge0Configured } from './services/judge0.service.js'
import { isAiMockMode } from './services/ai.service.js'

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

/**
 * Allowed browser origins. Production runs the client on Vercel and the API on
 * Render, so this must be an explicit list — never `*`, because the app uses
 * credentialed cookies. Comma-separate CORS_ORIGINS for extra origins.
 */
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  ...(process.env.CORS_ORIGINS || '').split(','),
]
  .map((value) => (value || '').trim().replace(/\/$/, ''))
  .filter(Boolean)

if (allowedOrigins.length === 0) {
  allowedOrigins.push('http://localhost:5173')
}

const primaryOrigin = allowedOrigins[0]

const corsOptions = {
  origin(origin, callback) {
    // Same-origin, server-to-server and curl requests carry no Origin header.
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true)
    return callback(new Error(`Origin ${origin} is not allowed by CORS`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
  exposedHeaders: ['Retry-After'],
}

// ── Socket.IO ──────────────────────────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
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

// Render (and any reverse proxy) terminates TLS in front of the app. Without
// this, rate limits would key on the proxy IP and every user would share one
// bucket.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1))

// ── Security Middleware ────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))
app.use(cors(corsOptions))

// Parse cookies before authentication: the browser sends its session that way.
app.use(cookieParser)
// Drop Mongo operators ($ne, $where, dotted keys) from untrusted input.
app.use(sanitizeInput)
// Cookie-authenticated mutations must echo the CSRF cookie (double submit).
app.use(csrfProtection)

// Broad safety net. Route-specific limiters below are the real budgets; this
// one exists so a runaway client cannot hammer the process (BE-09).
app.use(globalLimiter)

// ── Body / Logging Middleware ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Serve uploaded files (local fallback when Cloudinary is not configured).
// In production uploads live in Cloudinary/object storage — Render's disk is
// ephemeral — so this only matters for local development.
app.use('/uploads', express.static('uploads'))

// HTTP access logs: pretty in development, one JSON line in production so
// Render's log stream stays parseable.
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: logger.stream,
  skip: (req) => req.path === '/api/health', // health checks would flood logs
}))

// Request-ID middleware for tracing
app.use((req, _res, next) => {
  req.requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  next()
})

// ── API Routes ─────────────────────────────────────────────────────────────
// Per-class limiters are applied inside the routers themselves.
app.use('/api/auth', authRoutes)
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
// The agent monitor polls every 5s; it has its own generous budget.
app.use('/api/agents', agentMonitorLimiter, agentRoutes)

// ── Health Check ───────────────────────────────────────────────────────────
// `check=full` also reports the database handshake, which is what a Render
// health check should use.
app.get('/api/health', (req, res) => {
  const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'][
    mongoose.connection.readyState
  ] || 'unknown'

  const body = {
    status: dbState === 'connected' || dbState === 'connecting' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'NextHire AI API',
    version: process.env.npm_package_version || '2.0.0',
    env: process.env.NODE_ENV || 'development',
    uptimeSeconds: Math.round(process.uptime()),
    database: dbState,
    features: {
      ai: process.env.GROQ_API_KEY ? 'groq' : (isAiMockMode() ? 'mock' : 'unavailable'),
      codeExecution: isJudge0Configured() ? 'judge0+sandbox' : 'sandbox-only',
      email: isEmailConfigured() ? emailMode() : 'disabled',
    },
  }

  if (req.query.check === 'full' && dbState !== 'connected') {
    return res.status(503).json(body)
  }

  res.json(body)
})

// ── 404 Handler ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

// ── Global Error Handler ───────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500

  logger.error('[Unhandled Error]', {
    message: err.message,
    stack: err.stack,
    requestId: req.requestId,
    path: req.path,
    method: req.method,
    status,
  })

  // CORS rejections and malformed JSON should not read as server faults.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body', requestId: req.requestId })
  }
  if (err.message?.includes('not allowed by CORS')) {
    return res.status(403).json({ message: 'Origin not allowed', requestId: req.requestId })
  }

  res.status(status).json({
    // Internal error details leak implementation specifics in production.
    message: status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (err.message || 'Internal Server Error'),
    requestId: req.requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
})

// ── Start Server ───────────────────────────────────────────────────────────
// `PORT=0` is truthy and used to bind an ephemeral port, which silently broke
// the Vite /api proxy (hard-wired to 5000). Invalid or zero values now fall
// back to 5000; deployments still control the port through the environment.
const PORT = resolvePort(process.env.PORT)

httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 NextHire AI v2 Server started`, {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    url: `http://0.0.0.0:${PORT}`,
    corsOrigins: allowedOrigins,
    architecture: 'Multi-Agent + MCP + Vectorless',
  })
})

// ── Graceful shutdown ──────────────────────────────────────────────────────
// Render sends SIGTERM on deploy/restart. Finish in-flight requests, then close
// the database connection so no writes are cut off mid-flight.
let shuttingDown = false

const shutdown = async (signal) => {
  if (shuttingDown) return
  shuttingDown = true

  logger.info('[Server] Shutting down', { signal })

  const forceExit = setTimeout(() => {
    logger.error('[Server] Forced exit after shutdown timeout')
    process.exit(1)
  }, 10_000)
  forceExit.unref()

  io.close()
  httpServer.close(async () => {
    try {
      await mongoose.connection.close()
      logger.info('[Server] Closed cleanly')
    } catch (err) {
      logger.error('[Server] Error closing database', { error: err.message })
    } finally {
      clearTimeout(forceExit)
      process.exit(0)
    }
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('unhandledRejection', (reason) => {
  logger.error('[Server] Unhandled promise rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
  })
})

export default app  // needed for Jest supertest
