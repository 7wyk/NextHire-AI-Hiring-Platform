import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isEvaluatedAnswer,
  scoreInterviewAnswers,
} from '../services/interviewScoring.service.js'
import InterviewSession from '../models/InterviewSession.js'

const answer = (answerText, score, evaluated = true) => ({ answerText, score, evaluated })

test('final score is the mean of evaluated answers, already on 0-100', () => {
  const result = scoreInterviewAnswers([
    answer('a', 80),
    answer('b', 60),
    answer('c', 0),
  ])

  assert.equal(result.finalScore, 47) // (80 + 60 + 0) / 3 = 46.67
  assert.equal(result.evaluatedCount, 3)
  assert.equal(result.evaluationStatus, 'evaluated')
})

test('a genuine zero is counted, not dropped', () => {
  const result = scoreInterviewAnswers([answer('a', 0), answer('b', 0)])

  assert.equal(result.finalScore, 0)
  assert.equal(result.evaluatedCount, 2)
  assert.equal(result.evaluationStatus, 'evaluated')
})

test('answers that could not be evaluated are excluded from the average', () => {
  const result = scoreInterviewAnswers([
    answer('a', 80, true),
    answer('b', 0, false),   // AI unavailable
    answer('', 0, true),     // skipped
  ])

  assert.equal(result.finalScore, 80)
  assert.equal(result.evaluatedCount, 1)
  assert.equal(result.evaluationStatus, 'evaluated')
})

test('an interview with nothing evaluated gets no score and an explicit status', () => {
  const result = scoreInterviewAnswers([
    answer('a', 0, false),
    answer('b', 0, false),
  ])

  assert.equal(result.finalScore, 0)
  assert.equal(result.evaluatedCount, 0)
  assert.equal(result.evaluationStatus, 'unavailable')
})

test('an empty answer list is unavailable, not a zero score', () => {
  assert.deepEqual(scoreInterviewAnswers([]), {
    finalScore: 0,
    evaluatedCount: 0,
    evaluationStatus: 'unavailable',
  })
})

test('scores are clamped before averaging', () => {
  const result = scoreInterviewAnswers([answer('a', 500), answer('b', -20)])

  assert.equal(result.finalScore, 50) // (100 + 0) / 2
})

test('isEvaluatedAnswer mirrors the persistence rule', () => {
  assert.equal(isEvaluatedAnswer(answer('hello', 10)), true)
  assert.equal(isEvaluatedAnswer(answer('hello', 0, false)), false)
  assert.equal(isEvaluatedAnswer(answer('   ', 10)), false)
  assert.equal(isEvaluatedAnswer({}), false)
})

test('only candidate-initiated sessions are capped at one per job', () => {
  const indexes = InterviewSession.schema.indexes()
  const unique = indexes.find(([fields, options]) =>
    fields.candidate === 1 && fields.job === 1 && options?.unique
  )

  assert.ok(unique, 'a unique candidate/job index is required')
  assert.deepEqual(unique[1].partialFilterExpression, { initiatedBy: 'candidate' })
})
