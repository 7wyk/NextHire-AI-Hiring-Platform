/**
 * ai.service.js
 *
 * Groq LLM integration for resume screening and code review.
 *
 * Every public function returns an explicit result envelope:
 *
 *   { ok: true,  mock: false, ...data }   the model produced this result
 *   { ok: true,  mock: true,  ...data }   synthetic result, ONLY when
 *                                         AI_MOCK_MODE=true and not production
 *   { ok: false, unavailable: true, reason, message }
 *                                         nothing was evaluated — the caller
 *                                         must surface this, never store a score
 *
 * There is no silent fallback: a failed evaluation can no longer look like a
 * real one. Callers must check `ok` before persisting anything.
 */

import logger from '../config/logger.js'

// ── Groq setup (lazy async — ES-module safe) ──────────────────────────────────
let groq = null
// Llama 3.3 70B was removed from Groq's free/developer tiers in August 2026.
// Keep the model configurable, while defaulting to an active production model.
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'

export const AI_PROVIDER = 'groq'

/**
 * Mock responses are opt-in and never active in production. They exist for
 * local development and tests only, and are labelled `mock: true` so no caller
 * can present them as a genuine evaluation.
 */
export const isAiMockMode = () =>
  process.env.AI_MOCK_MODE === 'true' && process.env.NODE_ENV !== 'production'

const initGroq = async () => {
  if (groq) return groq
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.startsWith('your_')) {
    return null
  }
  try {
    const { ChatGroq } = await import('@langchain/groq')
    groq = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model:  GROQ_MODEL,
      temperature: 0.3,
    })
    logger.info('[AI] Groq initialized', { model: GROQ_MODEL })
    return groq
  } catch (err) {
    logger.error('[AI] Groq initialization failed', { error: err.message })
    return null
  }
}

// ── Result helpers ────────────────────────────────────────────────────────────

/** Build an explicit "nothing was evaluated" result. Never contains a score. */
const unavailable = (reason, message, err) => {
  logger.error('[AI] Evaluation unavailable', {
    provider: AI_PROVIDER,
    reason,
    error: err?.message,        // server-side only, never returned to clients
  })
  return {
    ok: false,
    unavailable: true,
    provider: AI_PROVIDER,
    reason,
    message:
      message ||
      'AI evaluation is unavailable right now. No score was recorded.',
  }
}

const classify = (err) => {
  const text = String(err?.message || '')
  if (text.includes('not configured') || text.includes('not available')) return 'not_configured'
  if (text.includes('valid JSON') || text.includes('missing')) return 'invalid_response'
  if (text.includes('429') || text.toLowerCase().includes('rate limit')) return 'rate_limited'
  return 'request_failed'
}

const roundScore = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return Math.max(0, Math.min(100, Math.round(num)))
}

const stringArray = (value, max = 6) =>
  Array.isArray(value)
    ? value.filter(item => typeof item === 'string' && item.trim()).slice(0, max)
    : []

// ── Mock responses (development / tests only) ────────────────────────────────

const mockScreenResult = (resumeText) => {
  const base  = 60
  const bonus = Math.min(30, Math.floor(resumeText.length / 200))
  const score = base + bonus

  const techKeywords = [
    'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java',
    'MongoDB', 'PostgreSQL', 'Docker', 'AWS', 'Git', 'REST', 'API',
    'HTML', 'CSS', 'Express', 'Next.js', 'Vue', 'Angular', 'SQL',
  ]
  const foundSkills = techKeywords.filter(kw =>
    resumeText.toLowerCase().includes(kw.toLowerCase())
  )
  const skills = foundSkills.length > 0 ? foundSkills.slice(0, 6) : ['Communication', 'Problem Solving', 'Teamwork']

  return {
    score,
    summary: `Candidate demonstrates ${score >= 75 ? 'strong' : 'moderate'} alignment with the role requirements. Resume indicates hands-on experience with ${skills.slice(0, 3).join(', ')} and related technologies.`,
    strengths: [
      `Relevant technical skills: ${skills.slice(0, 2).join(', ')}`,
      'Demonstrated project experience',
      'Clear and structured resume presentation',
    ],
    weaknesses: [
      'Could benefit from more quantified achievements',
      'Additional certifications would strengthen the profile',
    ],
    skills,
    experience: Math.min(10, Math.max(1, Math.floor(resumeText.length / 500))),
    recommendation: score >= 75 ? 'hire' : score >= 55 ? 'interview' : 'reject',
    reasoning: `Score of ${score}/100 based on skills match and experience depth against the job requirements.`,
  }
}

const mockInterviewQuestions = (jobTitle) => ({
  questions: [
    { id: 1, question: `Tell me about your most challenging project as a ${jobTitle}.`, category: 'behavioral', difficulty: 'medium' },
    { id: 2, question: 'Explain the difference between synchronous and asynchronous programming.', category: 'technical', difficulty: 'medium' },
    { id: 3, question: 'How do you approach debugging a production issue?', category: 'technical', difficulty: 'hard' },
    { id: 4, question: 'Describe a time you disagreed with a team decision. How did you handle it?', category: 'behavioral', difficulty: 'medium' },
    { id: 5, question: 'Design a URL shortening service. Walk me through the architecture.', category: 'system-design', difficulty: 'hard' },
  ],
})

const mockCodeEval = (code) => {
  const lines = code.split('\n').length
  const score = Math.min(95, 60 + lines * 2)
  return {
    score,
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(1)',
    codeQuality: score >= 80 ? 'good' : 'fair',
    feedback: 'Solution addresses the core requirements. Consider adding edge case handling and comments.',
    improvements: ['Add input validation', 'Consider edge cases for empty inputs'],
    correctness: score,
    edgeCaseHandling: Math.max(40, score - 20),
  }
}

const MOCK_QUESTIONS = {
  easy: [
    {
      question: 'Write a function that takes an array of integers and returns the sum of all elements.',
      testCases: [
        { input: '[1, 2, 3, 4, 5]', output: '15' },
        { input: '[0, -1, 1]', output: '0' },
        { input: '[]', output: '0' },
      ],
      timeLimit: 15,
    },
    {
      question: 'Given a string, return true if it is a palindrome (reads the same forwards and backwards), false otherwise.',
      testCases: [
        { input: '"racecar"', output: 'true' },
        { input: '"hello"', output: 'false' },
        { input: '"a"', output: 'true' },
      ],
      timeLimit: 15,
    },
    {
      question: 'Write a function that returns the factorial of a non-negative integer n.',
      testCases: [
        { input: '5', output: '120' },
        { input: '0', output: '1' },
        { input: '1', output: '1' },
      ],
      timeLimit: 15,
    },
  ],
  medium: [
    {
      question: 'Given an unsorted array of integers, find the length of the longest consecutive elements sequence.',
      testCases: [
        { input: '[100, 4, 200, 1, 3, 2]', output: '4' },
        { input: '[0, 3, 7, 2, 5, 8, 4, 6, 0, 1]', output: '9' },
        { input: '[]', output: '0' },
      ],
      timeLimit: 15,
    },
    {
      question: 'Implement a function to find all unique pairs in an array that sum to a target value. Return the pairs as a list of tuples.',
      testCases: [
        { input: '[1, 2, 3, 4, 5], target=5', output: '[[1,4],[2,3]]' },
        { input: '[0, 0, 0], target=0', output: '[[0,0]]' },
        { input: '[1, 2], target=10', output: '[]' },
      ],
      timeLimit: 15,
    },
    {
      question: 'Given a binary tree, return its level-order traversal as an array of arrays, where each inner array contains the values at that level.',
      testCases: [
        { input: 'root=[3,9,20,null,null,15,7]', output: '[[3],[9,20],[15,7]]' },
        { input: 'root=[1]', output: '[[1]]' },
        { input: 'root=[]', output: '[]' },
      ],
      timeLimit: 15,
    },
  ],
  hard: [
    {
      question: 'Given an array of integers heights representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.',
      testCases: [
        { input: '[0,1,0,2,1,0,1,3,2,1,2,1]', output: '6' },
        { input: '[4,2,0,3,2,5]', output: '9' },
        { input: '[1,2,3,4,5]', output: '0' },
      ],
      timeLimit: 15,
    },
    {
      question: 'Implement a LRU (Least Recently Used) Cache with get(key) and put(key, value) operations, both running in O(1) time.',
      testCases: [
        { input: 'capacity=2; put(1,1); put(2,2); get(1); put(3,3); get(2)', output: '-1' },
        { input: 'capacity=1; put(2,1); get(2); put(3,2); get(2); get(3)', output: '-1,2' },
        { input: 'capacity=2; put(1,1); get(1)', output: '1' },
      ],
      timeLimit: 15,
    },
    {
      question: 'Given a string s and a dictionary of words wordDict, return true if s can be segmented into a space-separated sequence of one or more dictionary words.',
      testCases: [
        { input: 's="leetcode", wordDict=["leet","code"]', output: 'true' },
        { input: 's="applepenapple", wordDict=["apple","pen"]', output: 'true' },
        { input: 's="catsandog", wordDict=["cat","cats","and","sand","dog"]', output: 'false' },
      ],
      timeLimit: 15,
    },
  ],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const invokeGroq = async (messages) => {
  const client = await initGroq()
  if (!client) throw new Error('Groq not configured')

  const { HumanMessage, SystemMessage } = await import('@langchain/core/messages')
  const mapped = messages.map(m =>
    m.role === 'system' ? new SystemMessage(m.content) : new HumanMessage(m.content)
  )
  const response = await client.invoke(mapped)
  return String(response.content || '').trim()
}

const parseJSON = (raw) => {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI did not return valid JSON')
  return JSON.parse(match[0])
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Screen a resume against a job description.
 * @returns {{ok:true, mock:boolean, score:number, ...}|{ok:false, unavailable:true}}
 */
export const screenResumeWithAI = async (resumeText, jobDescription) => {
  try {
    const raw = await invokeGroq([
      {
        role: 'system',
        content: 'You are an expert technical recruiter. Respond with ONLY valid JSON — no markdown, no explanation.',
      },
      {
        role: 'user',
        content: `JOB DESCRIPTION:\n${jobDescription.substring(0, 2000)}\n\nRESUME:\n${resumeText.substring(0, 3000)}\n\nReturn this exact JSON:\n{"score":<0-100>,"summary":"...","strengths":["..."],"weaknesses":["..."],"skills":["..."],"experience":<years>,"recommendation":"hire|interview|reject","reasoning":"..."}`,
      },
    ])

    const parsed = parseJSON(raw)
    const score = roundScore(parsed.score)
    if (score === null) throw new Error('AI response missing a numeric score')

    return {
      ok: true,
      mock: false,
      provider: AI_PROVIDER,
      score,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      strengths: stringArray(parsed.strengths),
      weaknesses: stringArray(parsed.weaknesses),
      skills: stringArray(parsed.skills, 20),
      experience: Number.isFinite(Number(parsed.experience)) ? Math.max(0, Number(parsed.experience)) : 0,
      recommendation: ['hire', 'interview', 'reject'].includes(parsed.recommendation)
        ? parsed.recommendation
        : 'interview',
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    }
  } catch (err) {
    if (isAiMockMode()) {
      logger.warn('[AI] MOCK MODE — returning synthetic resume screening (not a real evaluation)')
      return { ok: true, mock: true, provider: AI_PROVIDER, ...mockScreenResult(resumeText) }
    }
    return unavailable(classify(err), 'Resume screening is unavailable right now. Nothing was saved.', err)
  }
}

/**
 * Generate interview questions from a resume.
 * @returns {{ok:true, questions:Array, mock:boolean}|{ok:false, unavailable:true}}
 */
export const generateInterviewQuestions = async (resumeText, jobTitle, round = 1) => {
  try {
    const raw = await invokeGroq([
      {
        role: 'system',
        content: 'You are a senior technical interviewer. Return ONLY valid JSON.',
      },
      {
        role: 'user',
        content: `Role: ${jobTitle}\nResume: ${resumeText.substring(0, 1500)}\nRound: ${round === 1 ? 'screening' : 'deep technical'}\n\nGenerate 5 questions. Return:\n{"questions":[{"id":1,"question":"...","category":"technical|behavioral|system-design","difficulty":"easy|medium|hard"},...]}`,
      },
    ])

    const parsed = parseJSON(raw)
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.filter(q => typeof q?.question === 'string' && q.question.trim())
      : []
    if (questions.length === 0) throw new Error('AI response missing questions')

    return { ok: true, mock: false, provider: AI_PROVIDER, questions }
  } catch (err) {
    if (isAiMockMode()) {
      logger.warn('[AI] MOCK MODE — returning synthetic interview questions')
      return { ok: true, mock: true, provider: AI_PROVIDER, ...mockInterviewQuestions(jobTitle) }
    }
    return unavailable(classify(err), 'Question generation is unavailable right now.', err)
  }
}

/**
 * Generate DSA coding questions for a job-linked assessment.
 *
 * @returns {{ok:true, questions:Array, mock:boolean}|{ok:false, unavailable:true}}
 */
export const generateCodingQuestions = async (role, difficulty = 'medium', n = 3) => {
  const count = Math.min(Math.max(1, Number(n)), 10)

  try {
    const raw = await invokeGroq([
      {
        role: 'system',
        content:
          'You are a senior DSA interviewer. Generate coding problems with clear test cases. ' +
          'Return ONLY a valid JSON array — no markdown, no explanation.',
      },
      {
        role: 'user',
        content:
          `Generate ${count} ${difficulty} DSA problems for a ${role} interview assessment.\n` +
          'Each problem must have exactly 3 test cases.\n\n' +
          'Return this exact JSON array:\n' +
          `[{"question":"problem description","testCases":[{"input":"...","output":"..."}],"timeLimit":15},...]`,
      },
    ])

    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('AI did not return a valid JSON array')

    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty result from AI')

    const questions = parsed
      .filter(q => typeof q?.question === 'string' && q.question.trim())
      .map(q => ({
        question: q.question,
        timeLimit: Number.isFinite(Number(q.timeLimit)) ? Math.max(1, Number(q.timeLimit)) : 15,
        testCases: Array.isArray(q.testCases)
          ? q.testCases
              .filter(tc => tc && tc.output !== undefined && tc.output !== null)
              .map(tc => ({ input: String(tc.input ?? ''), output: String(tc.output) }))
          : [],
      }))
      .slice(0, count)

    const usable = questions.filter(q => q.testCases.length > 0)
    if (usable.length === 0) throw new Error('AI returned questions without usable test cases')

    return { ok: true, mock: false, provider: AI_PROVIDER, questions: usable }
  } catch (err) {
    if (isAiMockMode()) {
      logger.warn('[AI] MOCK MODE — returning synthetic coding questions')
      const pool = MOCK_QUESTIONS[difficulty] ?? MOCK_QUESTIONS.medium
      const questions = []
      for (let i = 0; i < count; i++) questions.push(pool[i % pool.length])
      return { ok: true, mock: true, provider: AI_PROVIDER, questions }
    }
    return unavailable(classify(err), 'Assessment generation is unavailable right now. No test was created.', err)
  }
}

/**
 * Evaluate a code submission for quality and suggestions.
 * AI feedback is advisory only — the pass rate always comes from test execution.
 *
 * @returns {{ok:true, ...}|{ok:false, unavailable:true}}
 */
export const evaluateCode = async (code, question, language = 'javascript') => {
  try {
    const raw = await invokeGroq([
      {
        role: 'system',
        content:
          'You are a senior code reviewer. Analyze the following code submission ' +
          'and return ONLY a JSON object (no markdown, no text outside the JSON) with these exact fields:\n' +
          '{\n' +
          '  "codeQuality": "poor" | "fair" | "good" | "excellent",\n' +
          '  "timeComplexity": "O(...)",\n' +
          '  "spaceComplexity": "O(...)",\n' +
          '  "feedback": "2-3 sentence narrative review",\n' +
          '  "improvements": ["suggestion 1", "suggestion 2", "suggestion 3"],\n' +
          '  "score": 0-100\n' +
          '}',
      },
      {
        role: 'user',
        content:
          `Language: ${language}\n\n` +
          `Problem: ${question}\n\n` +
          `Code:\n\`\`\`\n${code}\n\`\`\``,
      },
    ])

    const parsed = parseJSON(raw)
    const score = roundScore(parsed.score)

    return {
      ok: true,
      mock: false,
      provider: AI_PROVIDER,
      codeQuality: ['poor', 'fair', 'good', 'excellent'].includes(parsed.codeQuality)
        ? parsed.codeQuality
        : 'fair',
      timeComplexity: typeof parsed.timeComplexity === 'string' ? parsed.timeComplexity : 'N/A',
      spaceComplexity: typeof parsed.spaceComplexity === 'string' ? parsed.spaceComplexity : 'N/A',
      feedback: typeof parsed.feedback === 'string' ? parsed.feedback : '',
      improvements: stringArray(parsed.improvements, 5),
      // null when the model did not give a usable number — never invented
      score,
    }
  } catch (err) {
    if (isAiMockMode()) {
      logger.warn('[AI] MOCK MODE — returning synthetic code review')
      return { ok: true, mock: true, provider: AI_PROVIDER, ...mockCodeEval(code) }
    }
    return unavailable(classify(err), 'AI code review is unavailable for this submission.', err)
  }
}
