import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildProfileLookup,
  normaliseEmail,
  applyScoreUpdate,
} from '../services/candidateProfile.service.js'

test('a profile lookup is keyed by job + normalised email', () => {
  assert.deepEqual(
    buildProfileLookup({ jobId: 'job-1', email: '  Ada@Example.COM ' }),
    { job: 'job-1', email: 'ada@example.com' }
  )
})

test('an incomplete identity returns null instead of a wildcard query', () => {
  // { email: undefined } is stripped by Mongoose and would match ANY profile —
  // the class of bug that let one candidate's result land on another's row.
  assert.equal(buildProfileLookup({ jobId: 'job-1' }), null)
  assert.equal(buildProfileLookup({ email: 'ada@example.com' }), null)
  assert.equal(buildProfileLookup({}), null)
  assert.equal(buildProfileLookup(), null)
})

test('the lookup never uses recruiter ownership as candidate identity', () => {
  const lookup = buildProfileLookup({ jobId: 'job-1', email: 'ada@example.com' })
  assert.equal(Object.prototype.hasOwnProperty.call(lookup, 'createdBy'), false)
})

test('an unattributable score update is refused, not guessed', async () => {
  assert.equal(await applyScoreUpdate({ jobId: null }), null)
  assert.equal(await applyScoreUpdate({ jobId: 'job-1' }), null)
  assert.equal(await applyScoreUpdate({}), null)
})

test('one candidate on two jobs resolves to two separate profiles', () => {
  const jobA = buildProfileLookup({ jobId: 'job-A', email: 'Ada@Example.com' })
  const jobB = buildProfileLookup({ jobId: 'job-B', email: 'ada@example.com' })

  assert.deepEqual(jobA, { job: 'job-A', email: 'ada@example.com' })
  assert.deepEqual(jobB, { job: 'job-B', email: 'ada@example.com' })
  assert.notDeepEqual(jobA, jobB, 'job-specific scores must not collide')
})

test('two candidates on the same job never share a lookup', () => {
  const first  = buildProfileLookup({ jobId: 'job-A', email: 'first@example.com' })
  const second = buildProfileLookup({ jobId: 'job-A', email: 'second@example.com' })

  assert.notDeepEqual(first, second)
  assert.equal(first.job, second.job)
})

test('email normalisation is trim + lowercase', () => {
  assert.equal(normaliseEmail('  A@B.com '), 'a@b.com')
  assert.equal(normaliseEmail(null), null)
  assert.equal(normaliseEmail(undefined), null)
})
