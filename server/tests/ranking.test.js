import test from 'node:test'
import assert from 'node:assert/strict'

import { rankRows, compareByWeightedScore } from '../services/ranking.service.js'
import { weightedTotal } from '../services/candidateProfile.service.js'

const row = (id, name, resumeScore, codeScore, interviewScore, jobId = 'job-A') => ({
  _id: id,
  name,
  jobId,
  resumeScore,
  codeScore,
  interviewScore,
  totalScore: weightedTotal({ resumeScore, codeScore, interviewScore }),
})

test('highest weighted score appears first', () => {
  const ranked = rankRows([
    row('a', 'A', 75, 0, 0),
    row('b', 'B', 70, 0, 0),
    row('c', 'C', 82, 20, 20),
  ])

  assert.deepEqual(ranked.map(r => r.name), ['C', 'A', 'B'])
  assert.deepEqual(ranked.map(r => r.totalScore), [39, 23, 21])
})

test('rank numbers match the sorted order and are assigned last', () => {
  const ranked = rankRows([
    row('a', 'A', 75, 0, 0),
    row('b', 'B', 70, 0, 0),
    row('c', 'C', 82, 20, 20),
  ])

  assert.deepEqual(ranked.map(r => r.rank), [1, 2, 3])
})

test('regression: the 31 candidate ranks above the 23 candidates', () => {
  // Mirrors the live data that exposed the bug: four resume-only profiles and
  // one candidate with a completed interview.
  const ranked = rankRows([
    row('1', 'sathwik', 75, 0, 0),
    row('2', 'sujith', 70, 0, 0),
    row('3', 'prajwal', 75, 0, 0),
    row('4', 'chethan', 75, 0, 0),
    row('5', 'hardik', 82, 0, 20),
  ])

  assert.equal(ranked[0].name, 'hardik')
  assert.equal(ranked[0].totalScore, 31)
  assert.equal(ranked[0].rank, 1)

  for (let i = 0; i < ranked.length - 1; i++) {
    assert.ok(
      ranked[i].totalScore >= ranked[i + 1].totalScore,
      `displayed scores out of order at ${i}: ${ranked[i].totalScore} < ${ranked[i + 1].totalScore}`
    )
  }
})

test('equal scores have a deterministic order (resume score, then _id)', () => {
  const a = row('aaa', 'A', 75, 0, 0)
  const b = row('bbb', 'B', 75, 0, 0)

  const forward = rankRows([a, b]).map(r => r._id)
  const reverse = rankRows([b, a]).map(r => r._id)

  assert.deepEqual(forward, ['aaa', 'bbb'])
  assert.deepEqual(forward, reverse)
})

test('equal totals prefer the higher resume score', () => {
  // 60 resume + 0 code = 18 total; 40 resume + 15 code = 12 + 6 = 18 total
  const ranked = rankRows([
    row('low ', 'lowResume', 40, 15, 0),
    row('high', 'highResume', 60, 0, 0),
  ])

  assert.equal(ranked[0].totalScore, ranked[1].totalScore)
  assert.equal(ranked[0].name, 'highResume')
})

test('searching does not modify a candidate\'s actual rank', () => {
  const ranked = rankRows([
    row('a', 'A', 90, 0, 0),
    row('b', 'B', 80, 0, 0),
    row('c', 'C', 70, 0, 0),
    row('d', 'D', 60, 0, 0),
  ])

  const searchHit = ranked.filter(r => r.name === 'D')

  assert.equal(searchHit.length, 1)
  assert.equal(searchHit[0].rank, 4)
})

test('ranking rows stay scoped to their own job', () => {
  const ranked = rankRows([
    row('1', 'A', 90, 0, 0, 'job-A'),
    row('2', 'B', 80, 0, 0, 'job-B'),
  ])

  const jobA = ranked.filter(r => r.jobId === 'job-A')
  const jobB = ranked.filter(r => r.jobId === 'job-B')

  assert.deepEqual(jobA.map(r => r.name), ['A'])
  assert.deepEqual(jobB.map(r => r.name), ['B'])
})

test('comparator orders descending and tolerates string totals', () => {
  assert.ok(compareByWeightedScore({ totalScore: 23 }, { totalScore: 31 }) > 0)
  assert.ok(compareByWeightedScore({ totalScore: '42' }, { totalScore: 50 }) > 0)
  assert.ok(compareByWeightedScore({ _id: 'a' }, { _id: 'b' }) < 0)
})
