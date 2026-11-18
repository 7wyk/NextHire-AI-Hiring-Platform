/**
 * assessment.service.js
 *
 * Pure functions describing a candidate's coding-assessment attempt.
 *
 * They exist because the old GET endpoint STARTED the timer as a side effect of
 * merely reading the test — so opening "My applications" burned a candidate's
 * attempt. Reading now describes state; only an explicit start creates it.
 */

export const ATTEMPT_STATUS = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  EXPIRED: 'expired',
  SUBMITTED: 'submitted',
})

// Extra time allowed past the deadline to cover network latency before a late
// submission is refused outright.
export const SUBMIT_GRACE_MS = 30_000

/** Starts allowed per candidate per test when an attempt is abandoned. */
export const MAX_ATTEMPTS = (() => {
  const configured = Number(process.env.MAX_ASSESSMENT_ATTEMPTS)
  return Number.isFinite(configured) && configured > 0 ? configured : 2
})()

const DEFAULT_QUESTION_MINUTES = 15

/** Total allowed time for a test, in milliseconds. */
export const totalTimeLimitMs = (questions = []) =>
  questions.reduce(
    (sum, q) => sum + (Number(q?.timeLimit) || DEFAULT_QUESTION_MINUTES) * 60 * 1000,
    0
  )

const toTime = (value) => {
  if (!value) return null
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * @param {object}   input
 * @param {string}   input.startedAt    ISO date the attempt started (null if never)
 * @param {string}   input.submittedAt  ISO date of an existing submission
 * @param {Array}    input.questions    questions of the revision the attempt is pinned to
 * @param {number}   input.now          epoch ms (injectable for tests)
 * @returns {{status:string, startedAt:string|null, deadlineAt:string|null, remainingMs:number, expired:boolean, limitMs:number}}
 */
export const computeAttemptState = ({
  startedAt = null,
  submittedAt = null,
  questions = [],
  now = Date.now(),
} = {}) => {
  const limitMs = totalTimeLimitMs(questions)

  if (submittedAt) {
    return {
      status: ATTEMPT_STATUS.SUBMITTED,
      startedAt: startedAt ? new Date(startedAt).toISOString() : null,
      deadlineAt: null,
      remainingMs: 0,
      expired: false,
      limitMs,
    }
  }

  const start = toTime(startedAt)
  if (start === null) {
    return {
      status: ATTEMPT_STATUS.NOT_STARTED,
      startedAt: null,
      deadlineAt: null,
      remainingMs: limitMs,
      expired: false,
      limitMs,
    }
  }

  const deadline = start + limitMs
  const expired = now > deadline + SUBMIT_GRACE_MS

  return {
    status: expired ? ATTEMPT_STATUS.EXPIRED : ATTEMPT_STATUS.IN_PROGRESS,
    startedAt: new Date(start).toISOString(),
    deadlineAt: new Date(deadline).toISOString(),
    remainingMs: Math.max(0, deadline - now),
    expired,
    limitMs,
  }
}

/**
 * Read-only assessment summary attached to a candidate's application list.
 * `hasTest` alone means "a test exists"; `testAvailable` also requires that the
 * job is still active and the candidate has not submitted yet.
 */
export const summariseAssessmentAvailability = ({
  hasTest = false,
  questions = [],
  startedAt = null,
  submitted = null,
  jobActive = true,
  attemptsUsed = 1,
  maxAttempts = MAX_ATTEMPTS,
  now = Date.now(),
} = {}) => {
  const state = computeAttemptState({
    startedAt,
    submittedAt: submitted?.createdAt || submitted?.submittedAt || null,
    questions,
    now,
  })

  const remainingAttempts = Math.max(0, maxAttempts - (Number(attemptsUsed) || 1))
  const expired = state.status === ATTEMPT_STATUS.EXPIRED
  const submittedAlready = state.status === ATTEMPT_STATUS.SUBMITTED

  return {
    hasTest: Boolean(hasTest),
    testAvailable:
      Boolean(hasTest) &&
      Boolean(jobActive) &&
      !submittedAlready &&
      (!expired || remainingAttempts > 0),
    alreadySubmitted: submittedAlready,
    attemptStatus: state.status,
    remainingAttempts: submittedAlready ? 0 : remainingAttempts,
    startedAt: state.startedAt,
    deadlineAt: state.deadlineAt,
    remainingMs: state.remainingMs,
    questionCount: questions.length,
    submittedAt: submitted?.createdAt || submitted?.submittedAt || null,
    score: submitted?.passRate ?? null,
    verdict: submitted?.verdict ?? null,
  }
}
