import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolvePort, DEFAULT_PORT } from '../config/port.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const authSource = fs.readFileSync(
  path.join(here, '../controllers/auth.controller.js'),
  'utf8'
)

// ── Password reset tokens ──────────────────────────────────────────────────

test('a reset token is never printed, logged or returned in a response', () => {
  assert.equal(authSource.includes('PASSWORD RESET LINK'), false)
  assert.equal(
    /console\.log\([^)]*(rawToken|resetUrl|token)/i.test(authSource),
    false,
    'a console.log call appears to print reset material'
  )
  assert.equal(
    /logger\.\w+\([^)]*rawToken/.test(authSource),
    false,
    'a logger call appears to include the raw reset token'
  )
  assert.equal(
    /res\.(json|send)\([^)]*(rawToken|resetUrl)/.test(authSource),
    false,
    'the reset token must never be echoed to the client'
  )
  // The raw token exists only in the emailed link and in the hash computation.
  const rawTokenLines = authSource
    .split('\n')
    .filter((line) => line.includes('rawToken'))
  for (const line of rawTokenLines) {
    assert.ok(
      /reset-password\?token=|createHash|randomBytes/.test(line),
      `unexpected use of the raw reset token: ${line.trim()}`
    )
  }
})

test('the reset link is built from the configured client origin and emailed', () => {
  // Delivery is now real, so the URL is constructed — but only from CLIENT_URL
  // and only for the mail transport.
  assert.ok(authSource.includes('/reset-password?token='))
  assert.ok(authSource.includes('CLIENT_URL') || authSource.includes('FRONTEND_URL'))
  assert.ok(authSource.includes('buildPasswordResetEmail'))
})

test('reset responses stay generic (no account enumeration)', () => {
  assert.ok(authSource.includes('If that email exists, a reset link has been sent.'))
})

test('reset storage is still hashed with an expiry', () => {
  assert.ok(authSource.includes("crypto.createHash('sha256').update(rawToken)"))
  assert.ok(authSource.includes('resetTokenExpiry'))
})

// ── Port configuration ─────────────────────────────────────────────────────

test('PORT=0 no longer binds an ephemeral port', () => {
  assert.equal(resolvePort('0'), DEFAULT_PORT)
  assert.equal(resolvePort(0), DEFAULT_PORT)
})

test('a valid PORT from the environment is honoured', () => {
  assert.equal(resolvePort('5000'), 5000)
  assert.equal(resolvePort('8080'), 8080)
  assert.equal(resolvePort(3000), 3000)
})

test('invalid PORT values fall back instead of crashing', () => {
  assert.equal(resolvePort(undefined), DEFAULT_PORT)
  assert.equal(resolvePort(''), DEFAULT_PORT)
  assert.equal(resolvePort('not-a-port'), DEFAULT_PORT)
  assert.equal(resolvePort('65536'), DEFAULT_PORT)
  assert.equal(resolvePort('-1'), DEFAULT_PORT)
  assert.equal(resolvePort(5000.5), DEFAULT_PORT)
})
