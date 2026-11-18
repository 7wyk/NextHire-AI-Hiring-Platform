import test from 'node:test'
import assert from 'node:assert/strict'

import {
  screenResumeWithAI,
  generateCodingQuestions,
  evaluateCode,
  isAiMockMode,
} from '../services/ai.service.js'
import {
  generateResumeBasedQuestions,
  generateInterviewSummary,
  evaluateInterviewAnswer,
  evaluateAnswer,
  normaliseInterviewScore,
} from '../services/interview.service.js'

// These run with no provider configured: every service must report
// unavailability rather than inventing a result.
delete process.env.GROQ_API_KEY
delete process.env.AI_MOCK_MODE
process.env.NODE_ENV = 'test'

const RESUME = 'Experienced backend engineer. Python, Node.js, MongoDB, AWS.'
const JOB = 'Backend Engineer. Python, MongoDB.'

test('resume screening reports unavailability and returns no score', async () => {
  const result = await screenResumeWithAI(RESUME, JOB)

  assert.equal(result.ok, false)
  assert.equal(result.unavailable, true)
  assert.equal('score' in result, false, 'no fabricated score may be returned')
  assert.ok(result.reason)
})

test('coding question generation never substitutes mock questions silently', async () => {
  const result = await generateCodingQuestions('Backend Engineer', 'medium', 3)

  assert.equal(result.ok, false)
  assert.equal(result.unavailable, true)
  assert.equal(result.questions, undefined)
})

test('code review reports unavailability instead of a heuristic score', async () => {
  const result = await evaluateCode('function solution(){return 1}', 'Sum', 'javascript')

  assert.equal(result.ok, false)
  assert.equal(result.unavailable, true)
  assert.equal('score' in result, false)
})

test('interview questions are not replaced by generic stock questions', async () => {
  const result = await generateResumeBasedQuestions({ resumeText: RESUME, jobTitle: 'Backend Engineer' })

  assert.equal(result.ok, false)
  assert.equal(result.unavailable, true)
  assert.equal(result.questions, undefined)
})

test('interview summary is never a fixed fabricated evaluation', async () => {
  const result = await generateInterviewSummary({
    jobTitle: 'Backend Engineer',
    messages: [{ role: 'candidate', content: 'I built an API.' }],
  })

  assert.equal(result.ok, false)
  assert.equal(result.unavailable, true)
  assert.equal(result.overall, undefined)
})

test('an answer that could not be evaluated yields no score', async () => {
  const result = await evaluateInterviewAnswer({
    question: 'Explain indexing.',
    answer: 'An index speeds up lookups.',
    jobTitle: 'Backend Engineer',
  })

  assert.equal(result.ok, false)
  assert.equal(result.unavailable, true)
  assert.equal('score' in result, false)
})

test('an empty answer is a genuine zero, not a missing evaluation', async () => {
  const candidateFlow = await evaluateInterviewAnswer({ question: 'Q', answer: '   ', jobTitle: 'X' })
  assert.equal(candidateFlow.ok, true)
  assert.equal(candidateFlow.score, 0)

  const recruiterFlow = await evaluateAnswer({ question: 'Q', answer: '', jobTitle: 'X' })
  assert.equal(recruiterFlow.ok, true)
  assert.equal(recruiterFlow.score, 0)
})

test('mock mode is opt-in and labelled, and disabled in production', async () => {
  process.env.AI_MOCK_MODE = 'true'
  process.env.NODE_ENV = 'development'

  assert.equal(isAiMockMode(), true)

  const mocked = await screenResumeWithAI(RESUME, JOB)
  assert.equal(mocked.ok, true)
  assert.equal(mocked.mock, true)
  assert.equal(typeof mocked.score, 'number')

  // Same flag in production must not produce synthetic evaluations
  process.env.NODE_ENV = 'production'
  assert.equal(isAiMockMode(), false)

  const blocked = await screenResumeWithAI(RESUME, JOB)
  assert.equal(blocked.ok, false)
  assert.equal(blocked.unavailable, true)

  process.env.NODE_ENV = 'test'
  delete process.env.AI_MOCK_MODE
})

// ── Interview score convention ──────────────────────────────────────────────

test('interview scores are normalised to a single 0-100 scale', () => {
  assert.equal(normaliseInterviewScore(0), 0)
  assert.equal(normaliseInterviewScore(100), 100)
  assert.equal(normaliseInterviewScore(105), 100)
  assert.equal(normaliseInterviewScore(-5), 0)
  assert.equal(normaliseInterviewScore(74.6), 75)
  assert.equal(normaliseInterviewScore('42'), 42)
  assert.equal(normaliseInterviewScore('n/a'), null)
  assert.equal(normaliseInterviewScore(undefined), null)
})

test('a per-answer score is not rescaled anywhere', () => {
  // 8 means 8/100. Multiplying by 10 in one layer was the audit's mismatch.
  assert.equal(normaliseInterviewScore(8), 8)
})
