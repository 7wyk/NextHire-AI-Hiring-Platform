import CodingTest  from '../models/CodingTest.js'
import Submission   from '../models/Submission.js'
import Job          from '../models/Job.js'
import { generateCodingQuestions, evaluateCode } from '../services/ai.service.js'
import { isJudge0Configured } from '../services/judge0.service.js'
import { assertExecutable, answerLanguage, runTestCase } from '../services/codingExecution.service.js'
import { mapAnswersByQuestionIndex, computeOverallResult } from '../services/codingScoring.service.js'
import { computeAttemptState, summariseAssessmentAvailability, ATTEMPT_STATUS, MAX_ATTEMPTS } from '../services/assessment.service.js'
import { buildRevisionSnapshot, resolveAttempt } from '../services/codingTestVersioning.service.js'
import { updateCodeScore }  from '../services/ranking.service.js'
import logger from '../config/logger.js'

// v2 Agent System
import { supervisorAgent } from '../agents/supervisor.agent.js'
import { storeCodingResult } from '../memory/candidate.memory.js'

// Runtime selection and question mapping live in dedicated services so their
// rules are unit-tested: codingExecution.service.js / codingScoring.service.js.

const sendExecutionUnavailable = (res, err) =>
  res.status(503).json({
    message: err.message,
    executionUnavailable: true,
    reason: err.reason,
  })

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/coding-test/generate            [recruiter only]
// Body: { jobId, role, difficulty, numberOfQuestions }
// ─────────────────────────────────────────────────────────────────────────────
export const generateTest = async (req, res) => {
  try {
    const { jobId, role, difficulty = 'medium', numberOfQuestions = 3 } = req.body

    if (!jobId) return res.status(400).json({ message: 'jobId is required' })
    if (!role)  return res.status(400).json({ message: 'role is required' })

    const validDifficulties = ['easy', 'medium', 'hard']
    if (!validDifficulties.includes(difficulty))
      return res.status(400).json({ message: `difficulty must be one of: ${validDifficulties.join(', ')}` })

    const job = await Job.findOne({ _id: jobId, recruiter: req.user._id })
    if (!job) return res.status(404).json({ message: 'Job not found or access denied' })

    // Generate through the agent system; both paths return the same envelope.
    let generation
    try {
      const agentResult = await supervisorAgent.process({
        type: 'generate-coding-questions',
        role, difficulty, count: numberOfQuestions,
      })
      generation = agentResult.success
        ? agentResult.data
        : await generateCodingQuestions(role, difficulty, numberOfQuestions)
    } catch {
      generation = await generateCodingQuestions(role, difficulty, numberOfQuestions)
    }

    // No silent mock questions: the recruiter is told generation failed.
    if (!generation?.ok) {
      return res.status(503).json({
        message: generation?.message || 'Assessment generation is unavailable right now. No test was created.',
        evaluationUnavailable: true,
        reason: generation?.reason,
      })
    }

    const questions = generation.questions

    // ── Versioned write (CA-06) ──────────────────────────────────────────
    // Replacing questions in place changed the exam under candidates who had
    // already started. The live set is archived as a revision instead, and
    // attempts stay pinned to the revision they began on.
    let test = await CodingTest.findOne({ jobId })
    let archivedRevision = null

    if (!test) {
      test = new CodingTest({
        jobId,
        createdBy: req.user._id,
        difficulty,
        role,
        questions,
        revision: 1,
        versions: [],
        generatedBy: generation.mock ? 'mock' : 'ai',
      })
    } else {
      archivedRevision = Number(test.revision) || 1
      test.versions.push(buildRevisionSnapshot(test))
      // Keep the last five revisions — enough for any realistic in-flight set.
      if (test.versions.length > 5) test.versions = test.versions.slice(-5)

      test.revision    = archivedRevision + 1
      test.createdBy   = req.user._id
      test.difficulty  = difficulty
      test.role        = role
      test.questions   = questions
      test.generatedBy = generation.mock ? 'mock' : 'ai'
    }

    await test.save()

    // Candidates still sitting this test keep the questions they started with.
    const pinnedAttempts = [...(test.attempts?.keys?.() || [])].filter((key) => {
      const attempt = test.attempts.get(key)
      return attempt?.startedAt && !attempt?.submittedAt
    }).length

    res.status(201).json({
      message: generation.mock
        ? 'Coding test generated from synthetic questions (AI mock mode).'
        : 'Coding test generated successfully',
      mock: Boolean(generation.mock),
      archivedRevision,
      revision: test.revision,
      pinnedAttempts,
      test: {
        _id:           test._id,
        jobId:         test.jobId,
        difficulty:    test.difficulty,
        role:          test.role,
        generatedBy:   test.generatedBy,
        revision:      test.revision,
        questionCount: test.questions.length,
        questions:     test.questions.map(q => ({
          question:      q.question,
          timeLimit:     q.timeLimit,
          testCaseCount: q.testCases.length,
          testCases:     q.testCases,
        })),
      },
    })
  } catch (err) {
    logger.error('[CodingTest] generateTest failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/coding-test/:jobId               [candidate only]
// READ-ONLY. Describes the test and the candidate's attempt; it never starts
// the clock, so opening the applications list can no longer burn an attempt.
// ─────────────────────────────────────────────────────────────────────────────
export const getTestForJob = async (req, res) => {
  try {
    const test = await CodingTest.findOne({ jobId: req.params.jobId })
    if (!test) return res.status(404).json({ message: 'No coding test found for this job' })

    res.set('Cache-Control', 'no-store')

    const existingSubmission = await Submission.findOne({
      userId: req.user._id,
      jobId:  req.params.jobId,
    }).select('verdict passRate createdAt')

    if (existingSubmission) {
      return res.status(403).json({
        message: 'You have already submitted this test',
        alreadySubmitted: true,
        submission: {
          verdict:   existingSubmission.verdict,
          passRate:  existingSubmission.passRate,
          createdAt: existingSubmission.createdAt,
        },
      })
    }

    const attempt = resolveAttempt(test, req.user._id)
    const state = computeAttemptState({
      startedAt:   attempt.startedAt,
      submittedAt: attempt.submittedAt,
      questions:   attempt.questions,
    })

    const safeQuestions = attempt.questions.map(q => ({
      question:    q.question,
      timeLimit:   q.timeLimit,
      sampleInput: q.testCases[0]?.input || '',
    }))

    res.json({
      test: {
        _id:        test._id,
        jobId:      test.jobId,
        difficulty: test.difficulty,
        role:       test.role,
        revision:   attempt.revision,
        questions:  safeQuestions,
        // null until the candidate explicitly starts
        startTime:    state.startedAt,
        deadlineAt:   state.deadlineAt,
        remainingMs:  state.remainingMs,
        started:      state.status !== ATTEMPT_STATUS.NOT_STARTED,
        attemptStatus: state.status,
        remainingAttempts: Math.max(0, MAX_ATTEMPTS - (attempt.attemptsUsed || 1)),
        // Lets the editor disable languages this server cannot execute
        runtimes: {
          javascript: 'sandbox',
          judge0:     isJudge0Configured(),
        },
      },
    })
  } catch (err) {
    logger.error('[CodingTest] getTestForJob failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/coding-test/:jobId/start        [candidate only]
// The ONLY place a timer is created. Idempotent: a repeat call returns the
// original start time, so refreshing the page cannot reset the clock, and the
// start time is server-side, so the client cannot choose it.
// ─────────────────────────────────────────────────────────────────────────────
export const startTest = async (req, res) => {
  try {
    const { jobId } = req.params

    const test = await CodingTest.findOne({ jobId })
    if (!test) return res.status(404).json({ message: 'No coding test found for this job' })

    const existingSubmission = await Submission.findOne({ userId: req.user._id, jobId })
      .select('verdict passRate createdAt')

    if (existingSubmission) {
      return res.status(409).json({
        message: 'You have already submitted this test',
        alreadySubmitted: true,
        submission: {
          verdict:   existingSubmission.verdict,
          passRate:  existingSubmission.passRate,
          createdAt: existingSubmission.createdAt,
        },
      })
    }

    const candidateId = String(req.user._id)
    const attempt = resolveAttempt(test, candidateId)
    const maxAttempts = Number(process.env.MAX_ASSESSMENT_ATTEMPTS) > 0
      ? Number(process.env.MAX_ASSESSMENT_ATTEMPTS)
      : 2

    let attemptsUsed = attempt.attemptsUsed || 1
    let revision = Number(test.revision) || 1

    if (attempt.startedAt) {
      const state = computeAttemptState({
        startedAt:   attempt.startedAt,
        submittedAt: attempt.submittedAt,
        questions:   attempt.questions,
      })

      if (state.status !== ATTEMPT_STATUS.EXPIRED) {
        // Already running — never move the clock backwards or forwards.
        return res.json({
          resumed: true,
          startTime:    state.startedAt,
          deadlineAt:   state.deadlineAt,
          remainingMs:  state.remainingMs,
          attemptStatus: state.status,
          revision:     attempt.revision,
          remainingAttempts: Math.max(0, maxAttempts - attemptsUsed),
        })
      }

      // Expired without a submission. Locking the candidate out forever would
      // be unfair (the old read-to-start bug burned attempts), so a bounded
      // restart is allowed, still on the revision they were graded against.
      if (attemptsUsed >= maxAttempts) {
        return res.status(403).json({
          message: 'This assessment attempt has expired. Ask the recruiter to reopen it.',
          attemptsExhausted: true,
          attemptStatus: ATTEMPT_STATUS.EXPIRED,
        })
      }

      attemptsUsed += 1
      revision = attempt.revision
    }

    const startedAt = new Date()
    test.attempts.set(candidateId, {
      startedAt,
      revision,
      submittedAt: null,
      attemptsUsed,
    })
    // Keep the legacy map in sync for older readers.
    test.sessions.set(candidateId, startedAt.toISOString())
    await test.save()

    const state = computeAttemptState({ startedAt, questions: attempt.questions })

    logger.info('[CodingTest] Assessment started', {
      userId: candidateId, jobId: String(jobId), revision, attemptsUsed,
    })

    res.status(201).json({
      resumed: false,
      startTime:    state.startedAt,
      deadlineAt:   state.deadlineAt,
      remainingMs:  state.remainingMs,
      attemptStatus: state.status,
      revision,
      remainingAttempts: Math.max(0, maxAttempts - attemptsUsed),
    })
  } catch (err) {
    logger.error('[CodingTest] startTest failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/coding-test/run                 [candidate only]
// Execute code against test cases for ONE question — does NOT save
// Body: { jobId, questionIndex, code, language }
// ─────────────────────────────────────────────────────────────────────────────
export const runCode = async (req, res) => {
  try {
    const { jobId, questionIndex, code, language = 'javascript' } = req.body

    if (!jobId)                return res.status(400).json({ message: 'jobId is required' })
    if (questionIndex == null)  return res.status(400).json({ message: 'questionIndex is required' })
    if (!code?.trim())         return res.status(400).json({ message: 'code is required' })

    const test = await CodingTest.findOne({ jobId })
    if (!test) return res.status(404).json({ message: 'No coding test found for this job' })

    // Attempt resolution: the questions this candidate started with, and the
    // server-side clock. Running code never starts an attempt.
    const attempt = resolveAttempt(test, req.user._id)
    const state = computeAttemptState({
      startedAt:   attempt.startedAt,
      submittedAt: attempt.submittedAt,
      questions:   attempt.questions,
    })

    if (state.status === ATTEMPT_STATUS.NOT_STARTED) {
      return res.status(409).json({
        message: 'Start the assessment before running code',
        notStarted: true,
      })
    }
    if (state.status === ATTEMPT_STATUS.EXPIRED) {
      return res.status(403).json({ message: 'Time limit exceeded', timeExpired: true })
    }

    const question = attempt.questions[questionIndex]
    if (!question) return res.status(400).json({ message: `Invalid questionIndex: ${questionIndex}` })

    assertExecutable([language])

    const results = []
    for (const tc of question.testCases) {
      const expected = String(tc.output).trim()
      try {
        const { output, error } = await runTestCase({ code, language, input: tc.input })
        results.push({
          input:          tc.input,
          expectedOutput: expected,
          actualOutput:   error || output,
          passed:         !error && output === expected,
          ...(error ? { error: true } : {}),
        })
      } catch (err) {
        if (err.isExecutionUnavailable) throw err
        results.push({
          input:          tc.input,
          expectedOutput: expected,
          actualOutput:   `Error: ${err.message}`,
          passed:         false,
          error:          true,
        })
      }
    }

    const passed = results.filter(r => r.passed).length
    res.json({
      questionIndex,
      results,
      passed,
      total:     results.length,
      allPassed: passed === results.length,
    })
  } catch (err) {
    if (err.isExecutionUnavailable) return sendExecutionUnavailable(res, err)
    logger.error('[CodingTest] runCode failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/coding-test/submit              [candidate only]
// Body: { jobId, answers: [{ questionIndex, code, language }] }
// ─────────────────────────────────────────────────────────────────────────────
export const submitTest = async (req, res) => {
  try {
    const { jobId, answers } = req.body

    if (!jobId) return res.status(400).json({ message: 'jobId is required' })
    if (!Array.isArray(answers) || answers.length === 0)
      return res.status(400).json({ message: 'answers array is required' })

    const test = await CodingTest.findOne({ jobId })
    if (!test) return res.status(404).json({ message: 'No coding test found for this job' })

    // ── Duplicate submission guard ─────────────────────────────────────────
    const existing = await Submission.findOne({ userId: req.user._id, jobId })
    if (existing) {
      return res.status(409).json({
        message:          'You have already submitted this test',
        alreadySubmitted: true,
        verdict:          existing.verdict,
        overallScore:     existing.passRate,
      })
    }

    // ── Attempt + backend-safe timer enforcement ──────────────────────────
    // Graded against the revision the candidate started on, not whatever the
    // recruiter generated in the meantime.
    const candidateId = String(req.user._id)
    const attempt = resolveAttempt(test, candidateId)
    const state = computeAttemptState({
      startedAt:   attempt.startedAt,
      submittedAt: attempt.submittedAt,
      questions:   attempt.questions,
    })

    if (state.status === ATTEMPT_STATUS.NOT_STARTED) {
      return res.status(409).json({
        message: 'Start the assessment before submitting',
        notStarted: true,
      })
    }
    if (state.status === ATTEMPT_STATUS.EXPIRED) {
      return res.status(403).json({
        message:     'Submission rejected: time limit exceeded',
        timeExpired: true,
      })
    }

    const questions = attempt.questions

    // Answers are scored against the question they claim to answer. Mapping by
    // array position attributed one question's code to another question's test
    // cases whenever an answer was omitted or reordered.
    const answerByQuestionIndex = mapAnswersByQuestionIndex(answers)

    // Refuse up-front rather than scoring code that cannot be executed.
    assertExecutable(questions.map((_, idx) => answerLanguage(answerByQuestionIndex.get(idx))))

    // ── Evaluate each answer ───────────────────────────────────────────────
    const testResults = []

    for (let idx = 0; idx < questions.length; idx++) {
      const q        = questions[idx]
      const answer   = answerByQuestionIndex.get(idx) || {}
      const language = answerLanguage(answer)
      const code     = (answer.code || '').trim()
      const total    = q.testCases.length
      let   passed   = 0
      const perCase  = []
      let   executionError = null

      if (code.length > 20) {
        for (const tc of q.testCases) {
          const expected = String(tc.output).trim()

          let output = ''
          let error = null

          try {
            const run = await runTestCase({ code, language, input: tc.input })
            output = run.output
            error = run.error
          } catch (err) {
            if (err.isExecutionUnavailable) throw err
            error = err.message
          }

          const pass = !error && output === expected
          if (pass) passed++
          if (error && !executionError) executionError = error

          perCase.push({
            input:    tc.input,
            expected,
            actual:   error ? `Error: ${error}` : output,
            passed:   pass,
          })
        }
      }

      testResults.push({
        questionIndex: idx,
        question:      q.question,
        passed,
        total,
        score:         total > 0 ? Math.round((passed / total) * 100) : 0,
        language,
        executionError,
        perCase,
      })
    }

    const { totalPassed, totalCases, overallScore, verdict } = computeOverallResult(testResults)

    // ── AI code review (advisory only, never affects the pass rate) ───────
    let aiFeedback = null
    let aiFeedbackUnavailable = false

    const primaryAnswer = answers.find(a => (a?.code || '').trim().length > 20)
    if (primaryAnswer) {
      let review
      try {
        const agentResult = await supervisorAgent.process({
          type: 'evaluate-code',
          code: primaryAnswer.code,
          question: questions[0]?.question || 'Coding assessment',
          language: answerLanguage(primaryAnswer),
        })
        review = agentResult.success
          ? agentResult.data
          : await evaluateCode(primaryAnswer.code, test.questions[0]?.question || 'Coding assessment', answerLanguage(primaryAnswer))
      } catch {
        review = await evaluateCode(primaryAnswer.code, test.questions[0]?.question || 'Coding assessment', answerLanguage(primaryAnswer))
      }

      if (review?.ok) {
        aiFeedback = {
          codeQuality:     review.codeQuality,
          timeComplexity:  review.timeComplexity,
          spaceComplexity: review.spaceComplexity,
          feedback:        review.feedback,
          improvements:    review.improvements || [],
          // Advisory score only; null when the model gave no usable number.
          score:           review.score ?? overallScore,
          mock:            Boolean(review.mock),
        }
      } else {
        aiFeedbackUnavailable = true
        logger.warn('[CodingTest] AI code review unavailable', {
          userId: String(req.user._id), jobId: String(jobId), reason: review?.reason,
        })
      }
    }

    // ── Save submission (unique per candidate + job) ───────────────────────
    let submission
    try {
      submission = await Submission.create({
        userId:   req.user._id,
        jobId,
        code:     answers.map(a => `// Q${Number(a.questionIndex) + 1}\n${a.code}`).join('\n\n---\n\n'),
        language: answerLanguage(answers[0]),
        verdict,
        status:   'done',
        passed:   totalPassed,
        total:    totalCases,
        passRate: overallScore,
        testResults: testResults.flatMap(r => r.perCase.map(tc => ({
          input:    tc.input,
          expected: tc.expected,
          actual:   tc.actual,
          passed:   tc.passed,
        }))),
        aiFeedback,
        testRevision: attempt.revision,
      })

      // Mark the attempt as submitted on the test document (used by the
      // availability summary and by revision pinning).
      test.attempts.set(candidateId, {
        startedAt:   attempt.startedAt ? new Date(attempt.startedAt) : new Date(),
        revision:    attempt.revision,
        submittedAt: new Date(),
      })
      test.save().catch((saveErr) => {
        logger.warn('[CodingTest] Could not persist attempt state', { error: saveErr.message })
      })
    } catch (err) {
      // Unique index backstop for the double-submit race
      if (err?.code === 11000) {
        return res.status(409).json({
          message: 'You have already submitted this test',
          alreadySubmitted: true,
        })
      }
      throw err
    }

    // ── Propagate the score to the candidate's profile for THIS job ────────
    const scoredProfile = await updateCodeScore(req.user._id, jobId, overallScore)
    if (!scoredProfile) {
      logger.error('[CodingTest] Code score could not be persisted', {
        userId: String(req.user._id),
        jobId:  String(jobId),
      })
    }

    // ── Store in AI memory (non-blocking) ──────────────────────────────────
    storeCodingResult(req.user._id, jobId, {
      passRate: overallScore, verdict,
      language: answerLanguage(answers[0]),
      aiFeedback,
    }).catch(() => {})

    // ── Real-time notification (non-blocking) ──────────────────────────────
    try {
      const job = await Job.findById(jobId).select('recruiter title')
      if (job?.recruiter) {
        supervisorAgent.process({
          type: 'test-submitted',
          recruiterId: String(job.recruiter),
          candidateName: req.user.name,
          jobTitle: job.title,
          score: overallScore,
          verdict,
        }).catch(() => {})
      }
    } catch { /* non-blocking */ }

    res.status(201).json({
      submissionId: submission._id,
      verdict,
      overallScore,
      testResults,
      aiFeedback,
      aiFeedbackUnavailable,
      createdAt: submission.createdAt,
    })
  } catch (err) {
    if (err.isExecutionUnavailable) return sendExecutionUnavailable(res, err)
    logger.error('[CodingTest] submitTest failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/coding-test/:jobId/results       [recruiter only]
// ─────────────────────────────────────────────────────────────────────────────
export const getTestResults = async (req, res) => {
  try {
    const job = await Job.findOne({ _id: req.params.jobId, recruiter: req.user._id })
    if (!job) return res.status(404).json({ message: 'Job not found or access denied' })

    const submissions = await Submission.find({ jobId: req.params.jobId })
      .populate('userId', 'name email')
      .sort({ passRate: -1, createdAt: -1 })
      .select('userId verdict passRate passed total createdAt language aiFeedback')

    res.json({ job: { id: job._id, title: job.title }, submissions, total: submissions.length })
  } catch (err) {
    logger.error('[CodingTest] getTestResults failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/coding-test/:jobId/my-submission [candidate only]
// Let candidate view their own submission result
// ─────────────────────────────────────────────────────────────────────────────
export const getMySubmission = async (req, res) => {
  try {
    const submission = await Submission.findOne({
      userId: req.user._id,
      jobId:  req.params.jobId,
    })
    if (!submission) return res.status(404).json({ message: 'No submission found' })
    res.json({ submission })
  } catch (err) {
    logger.error('[CodingTest] getMySubmission failed', { error: err.message })
    res.status(500).json({ message: err.message })
  }
}
