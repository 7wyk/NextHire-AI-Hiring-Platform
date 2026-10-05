import CodingTest  from '../models/CodingTest.js'
import Submission   from '../models/Submission.js'
import Job          from '../models/Job.js'
import { generateCodingQuestions, evaluateCode } from '../services/ai.service.js'
import { executeCode } from '../services/judge0.service.js'
import { updateCodeScore }  from '../services/ranking.service.js'
import vm from 'node:vm'

// v2 Agent System
import { supervisorAgent } from '../agents/supervisor.agent.js'
import { storeCodingResult } from '../memory/candidate.memory.js'

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

    // v2: Route through agent system (falls back to direct call)
    let questions
    try {
      const agentResult = await supervisorAgent.process({
        type: 'generate-coding-questions',
        role, difficulty, count: numberOfQuestions,
      })
      questions = agentResult.success ? agentResult.data : await generateCodingQuestions(role, difficulty, numberOfQuestions)
    } catch {
      questions = await generateCodingQuestions(role, difficulty, numberOfQuestions)
    }

    const test = await CodingTest.findOneAndUpdate(
      { jobId },
      { jobId, createdBy: req.user._id, difficulty, role, questions },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    res.status(201).json({
      message: 'Coding test generated successfully',
      test: {
        _id:           test._id,
        jobId:         test.jobId,
        difficulty:    test.difficulty,
        role:          test.role,
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
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/coding-test/:jobId               [candidate only]
// Records startTime for this candidate; strips expected outputs from response
// ─────────────────────────────────────────────────────────────────────────────
export const getTestForJob = async (req, res) => {
  try {
    const test = await CodingTest.findOne({ jobId: req.params.jobId })
    if (!test) return res.status(404).json({ message: 'No coding test found for this job' })

    const candidateId = String(req.user._id)

    // Check if already submitted — prevent re-taking
    const existingSubmission = await Submission.findOne({
      userId: req.user._id,
      jobId:  req.params.jobId,
    })
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

    // Record start time only on first access
    if (!test.sessions.get(candidateId)) {
      test.sessions.set(candidateId, new Date().toISOString())
      await test.save()
    }

    const startTime = test.sessions.get(candidateId)

    const safeQuestions = test.questions.map(q => ({
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
        questions:  safeQuestions,
        startTime,
      },
    })
  } catch (err) {
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

    // Timer check
    const candidateId = String(req.user._id)
    const startTime   = test.sessions.get(candidateId)
    if (startTime) {
      const totalTimeLimitMs = test.questions.reduce(
        (sum, q) => sum + (q.timeLimit || 15) * 60 * 1000, 0
      )
      const elapsed = Date.now() - new Date(startTime).getTime()
      if (elapsed > totalTimeLimitMs + 30_000) {
        return res.status(403).json({ message: 'Time limit exceeded', timeExpired: true })
      }
    }

    const question = test.questions[questionIndex]
    if (!question) return res.status(400).json({ message: `Invalid questionIndex: ${questionIndex}` })

    // ── Execution: Judge0 (if key set) or vm sandbox (JS only) ────────────
    const results = await Promise.all(
      question.testCases.map(async tc => {
        try {
          let actualStr

          if (process.env.JUDGE0_API_KEY && language !== 'javascript') {
            // Judge0 path for non-JS languages
            const exec = await executeCode({ code, languageKey: language, stdin: tc.input })
            actualStr = (exec.stdout || exec.stderr || '').trim()
          } else {
            // vm sandbox for JavaScript
            actualStr = String(executeJS(code, tc.input)).trim()
          }

          const expected = String(tc.output).trim()
          return {
            input:          tc.input,
            expectedOutput: expected,
            actualOutput:   actualStr,
            passed:         actualStr === expected,
          }
        } catch (err) {
          return {
            input:          tc.input,
            expectedOutput: String(tc.output).trim(),
            actualOutput:   `Error: ${err.message}`,
            passed:         false,
            error:          true,
          }
        }
      })
    )

    const passed = results.filter(r => r.passed).length
    res.json({
      questionIndex,
      results,
      passed,
      total:     results.length,
      allPassed: passed === results.length,
    })
  } catch (err) {
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

    // ── Backend-safe timer enforcement ────────────────────────────────────
    const candidateId = String(req.user._id)
    const startTime   = test.sessions.get(candidateId)
    if (startTime) {
      const totalTimeLimitMs = test.questions.reduce(
        (sum, q) => sum + (q.timeLimit || 15) * 60 * 1000, 0
      )
      const elapsed = Date.now() - new Date(startTime).getTime()
      if (elapsed > totalTimeLimitMs + 30_000) {
        return res.status(403).json({
          message:     'Submission rejected: time limit exceeded',
          timeExpired: true,
        })
      }
    }

    // ── Evaluate each answer ───────────────────────────────────────────────
    const testResults = await Promise.all(
      answers.map(async (answer, idx) => {
        const q = test.questions[idx]
        if (!q) return { questionIndex: idx, passed: 0, total: 0, score: 0 }

        const code     = (answer.code || '').trim()
        const language = answer.language || 'javascript'
        const total    = q.testCases.length
        let   passed   = 0
        const perCase  = []

        if (code.length > 20) {
          for (const tc of q.testCases) {
            try {
              let actualStr

              if (process.env.JUDGE0_API_KEY && language !== 'javascript') {
                const exec = await executeCode({ code, languageKey: language, stdin: tc.input })
                actualStr = (exec.stdout || '').trim()
              } else {
                actualStr = String(executeJS(code, tc.input)).trim()
              }

              const expected = String(tc.output).trim()
              const pass = actualStr === expected
              if (pass) passed++
              perCase.push({
                input:    tc.input,
                expected,
                actual:   actualStr,
                passed:   pass,
              })
            } catch (e) {
              perCase.push({
                input:    tc.input,
                expected: String(tc.output).trim(),
                actual:   `Error: ${e.message}`,
                passed:   false,
              })
            }
          }
        }

        return {
          questionIndex: idx,
          question:      q.question,
          passed,
          total,
          score:         total > 0 ? Math.round((passed / total) * 100) : 0,
          language,
          perCase,
        }
      })
    )

    const totalPassed = testResults.reduce((s, r) => s + r.passed, 0)
    const totalCases  = testResults.reduce((s, r) => s + r.total,  0)
    const overallScore = totalCases > 0 ? Math.round((totalPassed / totalCases) * 100) : 0
    const verdict =
      overallScore === 100 ? 'Accepted'    :
      overallScore >= 50   ? 'Partial'     : 'Wrong Answer'

    // ── AI code quality feedback via Agent (falls back to direct) ──────────
    let aiFeedback = null
    try {
      const primaryAnswer = answers[0]
      if (primaryAnswer?.code?.trim().length > 20) {
        try {
          const agentResult = await supervisorAgent.process({
            type: 'evaluate-code',
            code: primaryAnswer.code,
            question: test.questions[0]?.question || 'Coding assessment',
            language: primaryAnswer.language || 'javascript',
          })
          aiFeedback = agentResult.success ? agentResult.data : await evaluateCode(
            primaryAnswer.code, test.questions[0]?.question || 'Coding assessment', primaryAnswer.language || 'javascript'
          )
        } catch {
          aiFeedback = await evaluateCode(
            primaryAnswer.code, test.questions[0]?.question || 'Coding assessment', primaryAnswer.language || 'javascript'
          )
        }
      }
    } catch { /* non-blocking */ }

    // ── Save submission ────────────────────────────────────────────────────
    const submission = await Submission.create({
      userId:   req.user._id,
      jobId,
      code:     answers.map(a => `// Q${a.questionIndex + 1}\n${a.code}`).join('\n\n---\n\n'),
      language: answers[0]?.language || 'javascript',
      verdict,
      status:   'done',
      passed:   totalPassed,
      total:    totalCases,
      passRate: overallScore,
      testResults: testResults.flatMap(r => r.perCase?.map(tc => ({
        input:    tc.input,
        expected: tc.expected,
        actual:   tc.actual,
        passed:   tc.passed,
      })) || []),
      aiFeedback: aiFeedback ? {
        codeQuality:     aiFeedback.codeQuality,
        timeComplexity:  aiFeedback.timeComplexity,
        spaceComplexity: aiFeedback.spaceComplexity,
        feedback:        aiFeedback.feedback,
        improvements:    aiFeedback.improvements || [],
        score:           aiFeedback.score || overallScore,
      } : null,
    })

    // ── Propagate score to candidate ranking (non-blocking) ────────────────
    updateCodeScore(req.user._id, jobId, overallScore).catch(() => {})

    // ── Store in AI memory (non-blocking) ──────────────────────────────────
    storeCodingResult(req.user._id, jobId, {
      passRate: overallScore, verdict,
      language: answers[0]?.language || 'javascript',
      aiFeedback,
    }).catch(() => {})

    // ── Real-time notification via Agent (non-blocking) ────────────────────
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
      createdAt: submission.createdAt,
    })
  } catch (err) {
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
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sandboxed JS execution via Node.js vm (fallback when Judge0 not available)
// ─────────────────────────────────────────────────────────────────────────────
function executeJS(code, input) {
  const sandbox = { console: { log: () => {} }, result: undefined }

  let parsedInput
  try { parsedInput = JSON.parse(input) }
  catch { parsedInput = input }

  const wrapped = `
    ${code}
    ;
    if (typeof solution === 'function') {
      result = solution(${JSON.stringify(parsedInput)});
    } else {
      result = 'Error: No solution() function defined';
    }
  `

  const ctx = vm.createContext(sandbox)
  vm.runInContext(wrapped, ctx, { timeout: 3000 })
  return sandbox.result
}
