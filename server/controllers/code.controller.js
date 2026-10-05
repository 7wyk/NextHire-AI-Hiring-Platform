import Problem    from '../models/Problem.js'
import Submission  from '../models/Submission.js'
import { executeCode, LANGUAGES } from '../services/judge0.service.js'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/code/languages
// Returns supported languages list
// ─────────────────────────────────────────────────────────────────────────────
export const getLanguages = (_req, res) => {
  res.json({
    languages: Object.entries(LANGUAGES).map(([key, v]) => ({ key, ...v })),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/code/problems
// Public problem list (no test cases exposed)
// ─────────────────────────────────────────────────────────────────────────────
export const getProblems = async (req, res) => {
  try {
    const { difficulty, tag } = req.query
    const filter = { isPublic: true }
    if (difficulty) filter.difficulty = difficulty
    if (tag)        filter.tags = tag

    const problems = await Problem.find(filter)
      .select('-testCases -starterCode')
      .sort('difficulty')

    res.json({ problems })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/code/problems/:slug
// Single problem — visible test cases only
// ─────────────────────────────────────────────────────────────────────────────
export const getProblem = async (req, res) => {
  try {
    const problem = await Problem.findOne({ slug: req.params.slug })
    if (!problem) return res.status(404).json({ message: 'Problem not found' })

    const safe = problem.toObject()
    safe.testCases = safe.testCases.filter(t => !t.isHidden)
    res.json({ problem: safe })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/code/problems  (admin only — guarded in route)
// Create a new coding problem
// ─────────────────────────────────────────────────────────────────────────────
export const createProblem = async (req, res) => {
  try {
    const problem = await Problem.create({ ...req.body, createdBy: req.user._id })
    res.status(201).json({ problem })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/code/run
// Quick run — executes code against custom stdin, NOT persisted
// ─────────────────────────────────────────────────────────────────────────────
export const runCode = async (req, res) => {
  try {
    const { code, language, stdin = '' } = req.body
    if (!code || !language)
      return res.status(400).json({ message: 'code and language are required' })

    if (!LANGUAGES[language])
      return res.status(400).json({ message: `Unsupported language: ${language}` })

    const result = await executeCode({ code, languageKey: language, stdin })
    res.json({ result })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/code/submit
// Full submission — runs all test cases, persists result to MongoDB
// ─────────────────────────────────────────────────────────────────────────────
export const submitCode = async (req, res) => {
  try {
    const { code, language, problemSlug, jobId } = req.body

    if (!code || !language || !problemSlug)
      return res.status(400).json({ message: 'code, language, and problemSlug are required' })

    if (!LANGUAGES[language])
      return res.status(400).json({ message: `Unsupported language: ${language}` })

    // Load problem with all test cases (including hidden)
    const problem = await Problem.findOne({ slug: problemSlug })
    if (!problem) return res.status(404).json({ message: 'Problem not found' })

    // ── Run every test case sequentially ──────────────────────────────────
    const testResults = []
    let passed = 0

    for (const tc of problem.testCases) {
      const exec = await executeCode({ code, languageKey: language, stdin: tc.input })

      const actual   = (exec.stdout || '').trim()
      const expected = (tc.expectedOutput || '').trim()
      const isPass   = exec.accepted && actual === expected

      testResults.push({
        input:    tc.isHidden ? '(hidden)' : tc.input,
        expected: tc.isHidden ? '(hidden)' : expected,
        actual:   tc.isHidden ? '(hidden)' : actual,
        passed:   isPass,
        time:     exec.time,
        memory:   exec.memory,
        error:    exec.stderr || exec.compileOutput || null,
      })

      if (isPass) passed++
    }

    const total    = problem.testCases.length
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0

    const verdict =
      passRate === 100 ? 'Accepted' :
      passRate >= 50   ? 'Partial'  : 'Wrong Answer'

    // Pick timing/memory from first test result for display
    const firstExec = testResults[0] || {}

    // ── Persist submission to MongoDB ──────────────────────────────────────
    const submission = await Submission.create({
      userId:      req.user._id,
      problemId:   problem._id,
      problemSlug: problem.slug,
      jobId:       jobId || null,
      code,
      language,
      stdout:      testResults.map(t => t.actual).join('\n'),
      stderr:      testResults.find(t => t.error)?.error || '',
      verdict,
      status:      'done',
      passed,
      total,
      passRate,
      testResults,
      time:        firstExec.time   || null,
      memory:      firstExec.memory || null,
    })

    res.status(201).json({
      submissionId: submission._id,
      verdict,
      passed,
      total,
      passRate,
      testResults,
      language,
      createdAt: submission.createdAt,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/code/submissions
// Paginated submission history for the logged-in user
// ─────────────────────────────────────────────────────────────────────────────
export const getMySubmissions = async (req, res) => {
  try {
    const { problemSlug, verdict, page = 1, limit = 20 } = req.query

    const filter = { userId: req.user._id }
    if (problemSlug) filter.problemSlug = problemSlug
    if (verdict)     filter.verdict     = verdict

    const skip = (Number(page) - 1) * Number(limit)

    const [submissions, total] = await Promise.all([
      Submission.find(filter)
        .select('-testResults -code')        // keep list light
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Submission.countDocuments(filter),
    ])

    res.json({
      submissions,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/code/submissions/:id
// Full detail for one submission (owner or admin only)
// ─────────────────────────────────────────────────────────────────────────────
export const getSubmission = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('problemId', 'title slug difficulty')

    if (!submission)
      return res.status(404).json({ message: 'Submission not found' })

    // Only the owner or an admin can view full detail
    const isOwner = String(submission.userId) === String(req.user._id)
    const isAdmin = req.user.role === 'admin'
    if (!isOwner && !isAdmin)
      return res.status(403).json({ message: 'Access denied' })

    res.json({ submission })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
