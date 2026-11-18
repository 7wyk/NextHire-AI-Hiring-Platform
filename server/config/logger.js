import winston from 'winston'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logDir = path.join(__dirname, '../logs')

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Log destinations:
 *   - Render (and most PaaS) capture stdout, and the disk is ephemeral. In
 *     production we therefore log JSON to stdout only, unless LOG_TO_FILE is
 *     explicitly enabled on a host with a persistent volume.
 *   - Development keeps the rotating files plus a readable console stream.
 */
const transports = []

if (!isProduction || String(process.env.LOG_TO_FILE).toLowerCase() === 'true') {
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })

  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB rotate
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    })
  )
}

if (isProduction) {
  // Structured single-line logs for the platform's log stream.
  transports.push(new winston.transports.Console({ format: winston.format.json() }))
} else {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
          return `[${timestamp}] ${level}: ${message}${metaStr}`
        })
      ),
    })
  )
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'nexthire-api' },
  transports,
})

// Morgan integration. The default level is 'info', so HTTP access lines are
// emitted at 'info' — otherwise they would be filtered out silently.
logger.stream = {
  write: (message) => logger.info(message.trim(), { channel: 'http' }),
}

export default logger
