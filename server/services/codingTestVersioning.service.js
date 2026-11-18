/**
 * codingTestVersioning.service.js
 *
 * A recruiter regenerating a test used to overwrite `questions` in place, which
 * silently changed the exam under a candidate who had already started it: their
 * submitted code was then graded against different questions and test cases.
 *
 * Every generation now bumps `revision` and archives the previous question set
 * in `versions`. An attempt is pinned to the revision that was current when it
 * started, and is always graded against that snapshot.
 */

const cloneQuestions = (questions = []) =>
  questions.map((q) => ({
    question: q.question,
    timeLimit: Number(q.timeLimit) || 15,
    testCases: (q.testCases || []).map((tc) => ({
      input: tc.input ?? '',
      output: tc.output,
    })),
  }))

/** Question set to archive before replacing the live questions. */
export const buildRevisionSnapshot = (test) => ({
  revision: Number(test?.revision) || 1,
  role: test?.role || 'Software Engineer',
  difficulty: test?.difficulty || 'medium',
  generatedBy: test?.generatedBy || 'ai',
  questions: cloneQuestions(test?.questions),
  createdAt: new Date(),
})

/**
 * Resolve the attempt for one candidate.
 *
 * Always returns the questions that attempt must be graded against plus the
 * start time. Legacy documents (start recorded in `sessions` before attempts
 * existed) are honoured so no in-flight candidate loses their attempt.
 */
export const resolveAttempt = (test, candidateId) => {
  const key = String(candidateId)
  const currentRevision = Number(test?.revision) || 1

  const attempt = test?.attempts?.get ? test.attempts.get(key) : null
  const legacyStartedAt = test?.sessions?.get ? test.sessions.get(key) : null

  const startedAt = attempt?.startedAt || legacyStartedAt || null
  const revision = Number(attempt?.revision) || currentRevision

  let questions = test?.questions || []
  if (revision !== currentRevision) {
    const snapshot = (test?.versions || []).find((v) => Number(v.revision) === revision)
    if (snapshot?.questions?.length) questions = snapshot.questions
  }

  return {
    startedAt: startedAt ? new Date(startedAt).toISOString() : null,
    revision,
    currentRevision,
    questions: cloneQuestions(questions),
    pinnedToOlderRevision: revision !== currentRevision,
    submittedAt: attempt?.submittedAt || null,
    attemptsUsed: Number(attempt?.attemptsUsed) || 1,
    // True when the start came from the pre-versioning `sessions` map; the next
    // write upgrades it to a real attempt.
    legacy: Boolean(!attempt && legacyStartedAt),
  }
}

/** True when a candidate has started this test and has not submitted yet. */
export const hasActiveAttempt = (test, candidateId) => {
  const { startedAt, submittedAt } = resolveAttempt(test, candidateId)
  return Boolean(startedAt) && !submittedAt
}
