import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  parseCookies,
  setAuthCookies,
  clearAuthCookies,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
} from '../config/cookies.js'
import { RATE_LIMITS } from '../middlewares/rateLimit.middleware.js'
import {
  stripMongoOperators,
  requireObjectId,
  csrfProtection,
} from '../middlewares/security.middleware.js'
import { sendEmail, buildPasswordResetEmail } from '../services/email.service.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const routesDir = path.join(__dirname, '../routes')

// ── Cookies (SEC-04) ─────────────────────────────────────────────────────────

test('cookie header parsing handles multiple cookies and encoding', () => {
  const cookies = parseCookies('a=1; nh_access=abc.def; nh_csrf=x%20y')
  assert.equal(cookies.a, '1')
  assert.equal(cookies.nh_access, 'abc.def')
  assert.equal(cookies.nh_csrf, 'x y')
})

test('parseCookies tolerates a missing or empty header', () => {
  assert.deepEqual(parseCookies(undefined), {})
  assert.deepEqual(parseCookies(''), {})
})

const fakeRes = () => {
  const set = []
  return {
    set,
    cookie(name, value, options) { set.push({ name, value, options }) },
    clearCookie(name, options) { set.push({ name, value: null, options }) },
  }
}

test('session cookies are HttpOnly and carry the CSRF token separately', () => {
  const res = fakeRes()
  setAuthCookies(res, { accessToken: 'a', refreshToken: 'r', csrfToken: 'c' })

  const access = res.set.find((c) => c.name === ACCESS_COOKIE)
  const refresh = res.set.find((c) => c.name === REFRESH_COOKIE)
  const csrf = res.set.find((c) => c.name === CSRF_COOKIE)

  assert.equal(access.options.httpOnly, true)
  assert.equal(refresh.options.httpOnly, true)
  // The CSRF cookie must be readable by the client so it can be echoed back.
  assert.equal(csrf.options.httpOnly, false)
})

test('cookie security flags follow NODE_ENV', () => {
  const previous = process.env.NODE_ENV

  process.env.NODE_ENV = 'production'
  const prod = fakeRes()
  setAuthCookies(prod, { accessToken: 'a', refreshToken: 'r', csrfToken: 'c' })
  assert.equal(prod.set[0].options.secure, true)
  assert.equal(prod.set[0].options.sameSite, 'none')

  process.env.NODE_ENV = 'development'
  const dev = fakeRes()
  setAuthCookies(dev, { accessToken: 'a', refreshToken: 'r', csrfToken: 'c' })
  assert.equal(dev.set[0].options.secure, false)
  assert.equal(dev.set[0].options.sameSite, 'lax')

  process.env.NODE_ENV = previous
})

test('logout clears all three cookies', () => {
  const res = fakeRes()
  clearAuthCookies(res)
  assert.deepEqual(res.set.map((c) => c.name).sort(), [ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE])
})

// ── CSRF ─────────────────────────────────────────────────────────────────────

const runCsrf = (req) => {
  let status = 200
  let body = null
  const res = {
    status(code) { status = code; return this },
    json(payload) { body = payload; return this },
  }
  let nextCalled = false
  csrfProtection(req, res, () => { nextCalled = true })
  return { status, body, nextCalled }
}

test('a cookie-authenticated mutation without a CSRF header is rejected', () => {
  const result = runCsrf({
    method: 'POST',
    path: '/api/applications',
    headers: {},
    cookies: { nh_access: 'token' },
  })

  assert.equal(result.nextCalled, false)
  assert.equal(result.status, 403)
})

test('a mismatched CSRF token is rejected', () => {
  const result = runCsrf({
    method: 'DELETE',
    path: '/api/applications/1',
    headers: { 'x-csrf-token': 'wrong' },
    cookies: { nh_access: 'token', [CSRF_COOKIE]: 'right' },
  })

  assert.equal(result.status, 403)
})

test('a matching CSRF token allows the mutation', () => {
  const result = runCsrf({
    method: 'PATCH',
    path: '/api/applications/1/status',
    headers: { 'x-csrf-token': 'right' },
    cookies: { nh_access: 'token', [CSRF_COOKIE]: 'right' },
  })

  assert.equal(result.nextCalled, true)
})

test('Bearer requests and safe methods are never CSRF-checked', () => {
  assert.equal(runCsrf({
    method: 'POST', path: '/api/x', headers: { authorization: 'Bearer t' }, cookies: {},
  }).nextCalled, true)

  assert.equal(runCsrf({
    method: 'GET', path: '/api/x', headers: {}, cookies: { nh_access: 't' },
  }).nextCalled, true)
})

// ── NoSQL injection / ObjectId guards ────────────────────────────────────────

test('Mongo operators and dotted keys are stripped from input', () => {
  const cleaned = stripMongoOperators({
    email: { $ne: null },
    'a.b': 1,
    nested: { $where: 'this.password', keep: 'yes' },
  })

  assert.deepEqual(cleaned, { email: {}, nested: { keep: 'yes' } })
})

test('malformed ObjectId params are rejected before reaching Mongo', () => {
  let status = 200
  const res = { status(code) { status = code; return this }, json() { return this } }

  requireObjectId('id')({ params: { id: 'not-an-id' } }, res, () => {
    throw new Error('should not call next')
  })
  assert.equal(status, 400)
})

test('valid ObjectId params pass through', () => {
  let called = false
  requireObjectId('id')({ params: { id: '6ac201da70fcd2d31630e0e6' } }, {}, () => { called = true })
  assert.equal(called, true)
})

// ── Rate limiting (BE-09) ────────────────────────────────────────────────────

test('the agent monitor budget exceeds the real polling volume', () => {
  // 12 polls/minute for 15 minutes = 180; the budget must clear that easily.
  assert.ok(RATE_LIMITS.agentMonitor.max >= 600)
  assert.ok(RATE_LIMITS.agentMonitor.max < RATE_LIMITS.global.max)
})

test('authentication and password reset have tight budgets', () => {
  assert.ok(RATE_LIMITS.auth.max <= 30)
  assert.ok(RATE_LIMITS.passwordReset.max <= 10)
  assert.ok(RATE_LIMITS.passwordReset.windowMs >= 15 * 60 * 1000)
})

// ── Email ────────────────────────────────────────────────────────────────────

test('email is reported as unsent when no transport is configured', async () => {
  const saved = { resend: process.env.RESEND_API_KEY, host: process.env.SMTP_HOST }
  delete process.env.RESEND_API_KEY
  delete process.env.SMTP_HOST

  const result = await sendEmail({ to: 'someone@example.com', subject: 'Hi', text: 'Body' })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'not_configured')

  process.env.RESEND_API_KEY = saved.resend
  process.env.SMTP_HOST = saved.host
  if (!saved.resend) delete process.env.RESEND_API_KEY
  if (!saved.host) delete process.env.SMTP_HOST
})

test('email rejects an incomplete message instead of pretending to send', async () => {
  const result = await sendEmail({ to: '', subject: 'Hi', text: 'Body' })
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'invalid_message')
})

test('reset emails escape user-controlled values', () => {
  const mail = buildPasswordResetEmail({
    name: '<script>alert(1)</script>',
    resetUrl: 'https://app.example.com/reset?token=abc&x=1',
  })

  assert.ok(!mail.html.includes('<script>'))
  assert.ok(mail.html.includes('&lt;script&gt;'))
  assert.ok(mail.subject.includes('Reset'))
})

// ── Route authorization (SEC-05 / SEC-07) ────────────────────────────────────

const readRoute = (file) => fs.readFileSync(path.join(routesDir, file), 'utf8')

test('candidate records cannot be created or edited by non-staff', () => {
  const source = readRoute('candidate.routes.js')

  assert.match(source, /\.post\(authorize\('recruiter', 'admin'\), createCandidate\)/)
  assert.match(source, /authorize\('recruiter', 'admin'\), updateCandidate/)
  assert.match(source, /authorize\('recruiter', 'admin'\), deleteCandidate/)
})

test('agent routes require a recruiter or admin', () => {
  const source = readRoute('agent.routes.js')
  assert.match(source, /router\.use\(protect, authorize\('recruiter', 'admin'\)\)/)
})

test('recruiter interview sessions are staff-only', () => {
  const source = readRoute('interview.routes.js')
  assert.match(source, /const staff = authorize\('recruiter', 'admin'\)/)
  assert.match(source, /router\.post\('\/sessions',\s+staff/)
  assert.match(source, /router\.get\('\/sessions',\s+staff/)
})

test('every route file outside the auth/upload allowlist declares authorization', () => {
  const allowlist = new Set(['auth.routes.js', 'upload.routes.js'])

  for (const file of fs.readdirSync(routesDir).filter((f) => f.endsWith('.routes.js'))) {
    if (allowlist.has(file)) continue
    const source = readRoute(file)
    assert.ok(
      source.includes("authorize(") || source.includes('authorize('),
      `${file} declares no role authorization`
    )
  }
})

test('resume files are ownership-checked, not merely authenticated', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../controllers/upload.controller.js'),
    'utf8'
  )
  assert.match(source, /canAccessCandidate/)
  assert.match(source, /Access denied/)
})
