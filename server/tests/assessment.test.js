import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ATTEMPT_STATUS,
  SUBMIT_GRACE_MS,
  totalTimeLimitMs,
  computeAttemptState,
  summariseAssessmentAvailability,
} from '../services/assessment.service.js'
import {
  buildRevisionSnapshot,
  resolveAttempt,
  hasActiveAttempt,
} from '../services/codingTestVersioning.service.js'

const QUESTIONS = [
  { question: 'Q1', timeLimit: 10, testCases: [{ input: '1', output: '2' }] },
  { question: 'Q2', timeLimit: 5, testCases: [{ input: '3', output: '4' }] },
]

const minutesToMs = (m) => m * 60 * 1000

// ── Time budget ──────────────────────────────────────────────────────────────

test('the time budget is the sum of the per-question limits', () => {
  assert.equal(totalTimeLimitMs(QUESTIONS), minutesToMs(15))
})

test('a missing per-question limit falls back to 15 minutes', () => {
  assert.equal(totalTimeLimitMs([{ question: 'Q' }]), minutesToMs(15))
})

// ── Attempt state ────────────────────────────────────────────────────────────

test('reading an unstarted test reports not_started and does not consume time', () => {
  const state = computeAttemptState({ questions: QUESTIONS, now: 1_000_000 })

  assert.equal(state.status, ATTEMPT_STATUS.NOT_STARTED)
  assert.equal(state.startedAt, null)
  assert.equal(state.remainingMs, minutesToMs(15))
})

test('starting the attempt fixes a deadline and counts down', () => {
  const start = Date.now()
  const state = computeAttemptState({ startedAt: start, questions: QUESTIONS, now: start + 60_000 })

  assert.equal(state.status, ATTEMPT_STATUS.IN_PROGRESS)
  assert.equal(state.remainingMs, minutesToMs(14))
  assert.equal(new Date(state.deadlineAt).getTime(), start + minutesToMs(15))
})

test('the clock keeps running across reads (reloading cannot reset it)', () => {
  const start = Date.now() - minutesToMs(10)
  const first = computeAttemptState({ startedAt: start, questions: QUESTIONS, now: Date.now() })
  const second = computeAttemptState({ startedAt: start, questions: QUESTIONS, now: Date.now() + 30_000 })

  assert.ok(second.remainingMs < first.remainingMs)
  assert.equal(second.deadlineAt, first.deadlineAt)
})

test('past the deadline plus grace the attempt is expired', () => {
  const start = Date.now() - minutesToMs(15) - SUBMIT_GRACE_MS - 1000
  const state = computeAttemptState({ startedAt: start, questions: QUESTIONS, now: Date.now() })

  assert.equal(state.status, ATTEMPT_STATUS.EXPIRED)
  assert.equal(state.expired, true)
  assert.equal(state.remainingMs, 0)
})

test('a submitted attempt reports submitted regardless of time left', () => {
  const state = computeAttemptState({
    startedAt: new Date().toISOString(),
    submittedAt: new Date().toISOString(),
    questions: QUESTIONS,
  })

  assert.equal(state.status, ATTEMPT_STATUS.SUBMITTED)
  assert.equal(state.remainingMs, 0)
})

// ── Application list summary ─────────────────────────────────────────────────

test('an application with no test reports hasTest false', () => {
  const summary = summariseAssessmentAvailability({ hasTest: false })

  assert.equal(summary.hasTest, false)
  assert.equal(summary.testAvailable, false)
  assert.equal(summary.attemptStatus, ATTEMPT_STATUS.NOT_STARTED)
})

test('an available, unstarted test is advertised without starting it', () => {
  const summary = summariseAssessmentAvailability({ hasTest: true, questions: QUESTIONS })

  assert.equal(summary.testAvailable, true)
  assert.equal(summary.startedAt, null)
  assert.equal(summary.attemptStatus, ATTEMPT_STATUS.NOT_STARTED)
  assert.equal(summary.remainingMs, minutesToMs(15))
})

test('a submitted test is reported with its real score', () => {
  const summary = summariseAssessmentAvailability({
    hasTest: true,
    questions: QUESTIONS,
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    submitted: { createdAt: new Date().toISOString(), passRate: 0, verdict: 'Wrong Answer' },
  })

  assert.equal(summary.alreadySubmitted, true)
  assert.equal(summary.testAvailable, false)
  // A genuine 0 is surfaced as 0, not as "missing".
  assert.equal(summary.score, 0)
})

test('an abandoned, expired attempt can be restarted within the cap', () => {
  const startedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const first = summariseAssessmentAvailability({
    hasTest: true, questions: QUESTIONS, startedAt, attemptsUsed: 1, maxAttempts: 2,
  })
  assert.equal(first.attemptStatus, ATTEMPT_STATUS.EXPIRED)
  assert.equal(first.remainingAttempts, 1)
  assert.equal(first.testAvailable, true, 'one restart must remain available')

  const exhausted = summariseAssessmentAvailability({
    hasTest: true, questions: QUESTIONS, startedAt, attemptsUsed: 2, maxAttempts: 2,
  })
  assert.equal(exhausted.remainingAttempts, 0)
  assert.equal(exhausted.testAvailable, false, 'the cap must stop endless retakes')
})

test('a test on an inactive job is not offered', () => {
  const summary = summariseAssessmentAvailability({
    hasTest: true, questions: QUESTIONS, jobActive: false,
  })
  assert.equal(summary.testAvailable, false)
})

// ── Revision pinning (CA-06) ─────────────────────────────────────────────────

const makeTest = (overrides = {}) => ({
  revision: 1,
  questions: QUESTIONS.map((q) => ({ ...q })),
  versions: [],
  attempts: new Map(),
  sessions: new Map(),
  ...overrides,
})

test('starting an attempt pins it to the current revision', () => {
  const startedAt = new Date().toISOString()
  const testDoc = makeTest({ attempts: new Map([['c1', { startedAt, revision: 1 }]]) })
  const attempt = resolveAttempt(testDoc, 'c1')

  assert.equal(attempt.revision, 1)
  assert.equal(attempt.pinnedToOlderRevision, false)
  assert.equal(attempt.questions.length, 2)
})

test('a candidate keeps their questions after the recruiter regenerates', () => {
  const startedAt = new Date().toISOString()

  // Revision 1 is live when the candidate starts.
  const doc = makeTest({ attempts: new Map([['c1', { startedAt, revision: 1 }]]) })

  // Recruiter regenerates: archive revision 1, publish revision 2.
  const snapshot = buildRevisionSnapshot(doc)
  doc.versions = [snapshot]
  doc.revision = 2
  doc.questions = [{ question: 'BRAND NEW', timeLimit: 20, testCases: [{ input: '9', output: '9' }] }]

  const attempt = resolveAttempt(doc, 'c1')
  assert.equal(attempt.revision, 1)
  assert.equal(attempt.pinnedToOlderRevision, true)
  assert.deepEqual(attempt.questions.map((q) => q.question), ['Q1', 'Q2'])

  // A candidate who starts now gets the new revision.
  assert.deepEqual(
    resolveAttempt(doc, 'c2').questions.map((q) => q.question),
    ['BRAND NEW']
  )
})

test('legacy sessions map is still honoured so in-flight attempts survive', () => {
  const startedAt = new Date(Date.now() - 60_000).toISOString()
  const doc = makeTest({ sessions: new Map([['legacy', startedAt]]) })

  const attempt = resolveAttempt(doc, 'legacy')
  assert.equal(attempt.startedAt, startedAt)
  assert.equal(attempt.legacy, true)
  assert.equal(hasActiveAttempt(doc, 'legacy'), true)
})

test('a submitted attempt is not active', () => {
  const doc = makeTest({
    attempts: new Map([['c1', {
      startedAt: new Date().toISOString(),
      revision: 1,
      submittedAt: new Date().toISOString(),
    }]]),
  })
  assert.equal(hasActiveAttempt(doc, 'c1'), false)
})

test('archived snapshots are deep copies, not references to the live questions', () => {
  const doc = makeTest()
  const snapshot = buildRevisionSnapshot(doc)

  doc.questions[0].question = 'MUTATED'
  assert.equal(snapshot.questions[0].question, 'Q1')
  assert.equal(snapshot.revision, 1)
})
