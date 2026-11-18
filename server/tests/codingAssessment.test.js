import test from 'node:test'
import assert from 'node:assert/strict'

import {
  mapAnswersByQuestionIndex,
  computeOverallResult,
} from '../services/codingScoring.service.js'
import { assertExecutable, answerLanguage } from '../services/codingExecution.service.js'
import { runJavaScript } from '../services/sandbox.service.js'
import { ExecutionUnavailableError } from '../services/judge0.service.js'
import Submission from '../models/Submission.js'

// No Judge0 configured in tests
delete process.env.JUDGE0_API_KEY

// ── Question mapping ────────────────────────────────────────────────────────

test('answers are matched by questionIndex, not array position', () => {
  const reordered = [
    { questionIndex: 2, code: 'third', language: 'javascript' },
    { questionIndex: 0, code: 'first', language: 'javascript' },
  ]

  const map = mapAnswersByQuestionIndex(reordered)

  assert.equal(map.get(0).code, 'first')
  assert.equal(map.get(2).code, 'third')
  assert.equal(map.get(1), undefined)
})

test('a duplicate questionIndex cannot overwrite the first answer', () => {
  const map = mapAnswersByQuestionIndex([
    { questionIndex: 1, code: 'original' },
    { questionIndex: 1, code: 'injected' },
  ])

  assert.equal(map.get(1).code, 'original')
})

test('malformed indices are ignored instead of shifting the mapping', () => {
  const map = mapAnswersByQuestionIndex([
    { code: 'no index' },
    { questionIndex: 'abc', code: 'not a number' },
    { questionIndex: -1, code: 'negative' },
    { questionIndex: 1.5, code: 'fractional' },
    { questionIndex: 0, code: 'valid' },
  ])

  assert.equal(map.size, 1)
  assert.equal(map.get(0).code, 'valid')
})

test('language defaults to javascript only when absent', () => {
  assert.equal(answerLanguage({}), 'javascript')
  assert.equal(answerLanguage({ language: 'python' }), 'python')
})

// ── Pass rate ───────────────────────────────────────────────────────────────

test('skipped questions stay in the denominator', () => {
  // Q1 answered perfectly, Q2 and Q3 submitted empty: 3 of 9 cases pass.
  const result = computeOverallResult([
    { passed: 3, total: 3 },
    { passed: 0, total: 3 },
    { passed: 0, total: 3 },
  ])

  assert.equal(result.totalCases, 9)
  assert.equal(result.totalPassed, 3)
  assert.equal(result.overallScore, 33)
  assert.notEqual(result.overallScore, 100, 'skipping questions must not inflate the score')
  assert.equal(result.verdict, 'Wrong Answer')
})

test('pass rate and verdict boundaries', () => {
  assert.deepEqual(computeOverallResult([{ passed: 3, total: 3 }]), {
    totalPassed: 3, totalCases: 3, overallScore: 100, verdict: 'Accepted',
  })
  assert.equal(computeOverallResult([{ passed: 2, total: 3 }]).verdict, 'Partial')
  assert.equal(computeOverallResult([{ passed: 0, total: 0 }]).overallScore, 0)
  assert.equal(computeOverallResult([]).overallScore, 0)
})

test('one assessment submission per candidate and job is enforced by the database', () => {
  const indexes = Submission.schema.indexes()
  const unique = indexes.find(([fields, options]) =>
    fields.userId === 1 && fields.jobId === 1 && options?.unique
  )

  assert.ok(unique, 'a unique (userId, jobId) index is required')
  assert.deepEqual(unique[1].partialFilterExpression, { jobId: { $type: 'objectId' } })
})

// ── Runtime selection ───────────────────────────────────────────────────────

test('javascript is always executable', () => {
  assert.doesNotThrow(() => assertExecutable(['javascript']))
})

test('a language without Judge0 is refused instead of run as JavaScript', () => {
  assert.throws(
    () => assertExecutable(['python']),
    (err) => err instanceof ExecutionUnavailableError && err.reason === 'not_configured'
  )
})

test('an unknown language is refused', () => {
  assert.throws(
    () => assertExecutable(['cobol']),
    (err) => err instanceof ExecutionUnavailableError && err.reason === 'unsupported_language'
  )
})

// ── Sandbox isolation ───────────────────────────────────────────────────────

test('javascript runs in the sandbox and returns its output', async () => {
  const { output, error } = await runJavaScript({
    code: 'function solution(n) { return n * 2 }',
    input: '21',
  })

  assert.equal(error, null)
  assert.equal(output, '42')
})

test('sandboxed code cannot see the process object or environment', async () => {
  const { output } = await runJavaScript({
    code: 'function solution() { return typeof process }',
    input: '',
  })

  assert.equal(output, 'undefined')
})

test('the Function-constructor escape is blocked', async () => {
  const { output, error } = await runJavaScript({
    code: 'function solution() { return this.constructor.constructor("return process.env")() }',
    input: '',
  })

  assert.ok(error, 'escaping via the Function constructor must fail')
  assert.equal(output, '')
})

test('runaway code is stopped by the timeout', async () => {
  const { error } = await runJavaScript({
    code: 'function solution() { while (true) {} }',
    input: '',
  })

  assert.ok(error, 'an infinite loop must not hang the request')
})
