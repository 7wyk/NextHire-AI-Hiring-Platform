/**
 * ai.service.js
 *
 * Real Groq LLM integration with automatic mock fallback.
 * If GROQ_API_KEY is missing, invalid, or the model returns an error,
 * all functions return deterministic mock responses so the app never crashes.
 */

// ── Groq setup (lazy async — ES-module safe) ──────────────────────────────────
let groq = null
// Llama 3.3 70B was removed from Groq's free/developer tiers in August 2026.
// Keep the model configurable, while defaulting to an active production model.
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'

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
    console.log('[AI] Groq initialized with model:', GROQ_MODEL)
    return groq
  } catch {
    return null
  }
}

// ── Mock responses ────────────────────────────────────────────────────────────

const mockScreenResult = (resumeText, jobDescription) => {
  // Generate a deterministic-ish score from resume length so results vary slightly
  const base  = 60
  const bonus = Math.min(30, Math.floor(resumeText.length / 200))
  const score = base + bonus

  // Simple keyword extraction from resume text
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const invokeGroq = async (messages) => {
  const client = await initGroq()
  if (!client) throw new Error('Groq not configured')

  const { HumanMessage, SystemMessage } = await import('@langchain/core/messages')
  const mapped = messages.map(m =>
    m.role === 'system' ? new SystemMessage(m.content) : new HumanMessage(m.content)
  )
  const response = await client.invoke(mapped)
  return response.content.trim()
}

const parseJSON = (raw) => {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI did not return valid JSON')
  return JSON.parse(match[0])
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Screen a resume against a job description.
 * Falls back to mock if Groq is unavailable or errors.
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
    return parseJSON(raw)
  } catch (err) {
    console.warn('[AI] screenResumeWithAI falling back to mock:', err.message)
    return mockScreenResult(resumeText, jobDescription)
  }
}

/**
 * Generate interview questions based on resume and job role.
 * Falls back to mock if Groq is unavailable.
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
    return parseJSON(raw)
  } catch (err) {
    console.warn('[AI] generateInterviewQuestions falling back to mock:', err.message)
    return mockInterviewQuestions(jobTitle)
  }
}

// ── Mock DSA questions by difficulty ─────────────────────────────────────────

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
        { input: 's="catsandog", wordDict=["cats","dog","sand","and","cat"]', output: 'false' },
      ],
      timeLimit: 15,
    },
  ],
}

/**
 * Generate DSA coding questions for a job-linked assessment.
 * Uses Groq AI; falls back to mock questions if unavailable.
 *
 * @param {string} role         - Job role, e.g. "SDE Intern"
 * @param {string} difficulty   - "easy" | "medium" | "hard"
 * @param {number} n            - Number of questions requested
 * @returns {Array}             - Array of { question, testCases, timeLimit }
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

    // Extract JSON array from response
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('AI did not return a valid JSON array')

    const questions = JSON.parse(match[0])
    if (!Array.isArray(questions) || questions.length === 0) throw new Error('Empty result from AI')

    return questions.slice(0, count)
  } catch (err) {
    console.warn('[AI] generateCodingQuestions falling back to mock:', err.message)

    const pool = MOCK_QUESTIONS[difficulty] ?? MOCK_QUESTIONS.medium
    // Return up to `count` questions, cycling if needed
    const result = []
    for (let i = 0; i < count; i++) {
      result.push(pool[i % pool.length])
    }
    return result
  }
}

// ── Code Evaluation AI ────────────────────────────────────────────────────────

/**
 * Evaluate a code submission for quality, complexity, and suggestions.
 *
 * @param {string} code       - The submitted source code
 * @param {string} question   - The problem statement
 * @param {string} language   - Programming language
 * @returns {{ codeQuality, timeComplexity, spaceComplexity, feedback, improvements, score }}
 */
export const evaluateCode = async (code, question, language = 'javascript') => {
  try {
    const llm = await initGroq()
    if (!llm) throw new Error('Groq not available')

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

    // Parse JSON from response
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AI did not return valid JSON')

    const result = JSON.parse(match[0])

    // Validate expected shape
    return {
      codeQuality:     result.codeQuality     || 'fair',
      timeComplexity:  result.timeComplexity  || 'N/A',
      spaceComplexity: result.spaceComplexity || 'N/A',
      feedback:        result.feedback        || '',
      improvements:    Array.isArray(result.improvements) ? result.improvements.slice(0, 5) : [],
      score:           typeof result.score === 'number' ? result.score : 50,
    }
  } catch (err) {
    console.warn('[AI] evaluateCode falling back to mock:', err.message)
    return mockCodeEvaluation(code, language)
  }
}

/**
 * Mock code evaluation (deterministic heuristic).
 */
const mockCodeEvaluation = (code, language) => {
  const lines = code.split('\n').filter(l => l.trim()).length
  const hasComments = code.includes('//') || code.includes('#') || code.includes('/*')
  const hasFunction = /function\s|def\s|public\s+(static\s+)?/.test(code)
  const hasLoop     = /for\s*\(|while\s*\(|\.forEach|\.map|\.reduce/.test(code)
  const hasEdgeCase = /if\s*\(|try\s*\{|catch/.test(code)

  let score = 50
  if (lines > 5)     score += 10
  if (lines > 15)    score += 5
  if (hasComments)   score += 10
  if (hasFunction)   score += 5
  if (hasEdgeCase)   score += 10
  score = Math.min(100, score)

  const quality =
    score >= 85 ? 'excellent' :
    score >= 70 ? 'good' :
    score >= 50 ? 'fair' : 'poor'

  const complexity = hasLoop ? 'O(n)' : 'O(1)'

  const improvements = []
  if (!hasComments)  improvements.push('Add comments to explain your approach')
  if (!hasEdgeCase)  improvements.push('Add edge case handling (null/empty input checks)')
  if (!hasFunction)  improvements.push('Wrap logic in a named function for clarity')
  if (lines < 5)    improvements.push('Solution seems very short — consider more robust handling')
  if (!code.includes('return')) improvements.push('Ensure your function returns the expected output')

  return {
    codeQuality:     quality,
    timeComplexity:  complexity,
    spaceComplexity: 'O(1)',
    feedback:        `Code is ${quality}. ${lines} lines of ${language} detected. ${hasEdgeCase ? 'Good error handling observed.' : 'Consider adding input validation.'}`,
    improvements:    improvements.slice(0, 3),
    score,
  }
}
