import test from 'node:test'
import assert from 'node:assert/strict'

import {
  weightedTotal,
  clampScore,
  SCORE_WEIGHTS,
} from '../services/candidateProfile.service.js'

test('official weights are 30/40/30', () => {
  assert.deepEqual(SCORE_WEIGHTS, { resume: 0.3, code: 0.4, interview: 0.3 })
})

test('resume-only score', () => {
  assert.equal(weightedTotal({ resumeScore: 75 }), 23) // 22.5
})

test('resume + coding score', () => {
  assert.equal(weightedTotal({ resumeScore: 75, codeScore: 50 }), 43) // 22.5 + 20
})

test('resume + interview score', () => {
  assert.equal(weightedTotal({ resumeScore: 60, interviewScore: 60 }), 36) // 18 + 18
})

test('all three assessment scores', () => {
  assert.equal(weightedTotal({ resumeScore: 80, codeScore: 70, interviewScore: 90 }), 79) // 24 + 28 + 27
})

test('a genuine zero is still a zero, not a missing value', () => {
  assert.equal(weightedTotal({ resumeScore: 0, codeScore: 0, interviewScore: 0 }), 0)
})

test('missing components contribute zero without throwing', () => {
  assert.equal(weightedTotal({}), 0)
  assert.equal(weightedTotal(), 0)
  assert.equal(weightedTotal({ codeScore: 100 }), 40)
})

test('rounding is Math.round on the weighted sum', () => {
  assert.equal(weightedTotal({ resumeScore: 85 }), 26) // 25.5
  assert.equal(weightedTotal({ resumeScore: 5 }), 2)   // 1.5
  assert.equal(weightedTotal({ resumeScore: 1 }), 0)   // 0.3
})

test('numeric strings are accepted, non-numbers are treated as zero', () => {
  assert.equal(weightedTotal({ resumeScore: '75' }), 23)
  assert.equal(weightedTotal({ resumeScore: 'not-a-number' }), 0)
})

test('component scores are clamped to 0-100', () => {
  assert.equal(clampScore(150), 100)
  assert.equal(clampScore(-5), 0)
  assert.equal(clampScore('42'), 42)
  assert.equal(clampScore(undefined), 0)
  assert.equal(clampScore('abc'), 0)
  assert.equal(weightedTotal({ resumeScore: 150 }), 30)
})

test('the audit example: 82/20/20 is 39 under 30/40/30, not 43', () => {
  // 24.6 + 8 + 6 = 38.6 → 39. The audit's illustrative table said 43, which
  // does not match the official formula; the formula is authoritative.
  assert.equal(weightedTotal({ resumeScore: 82, codeScore: 20, interviewScore: 20 }), 39)
})
