/**
 * interview.service.js
 *
 * AI interview engine (Groq).
 *
 * Scoring convention: EVERY interview score in this product is an integer
 * 0–100. Per-answer evaluations are requested on 0–100 directly, so no layer
 * multiplies or divides them afterwards. The final interview score is the mean
 * of the evaluated answers — already on the same scale.
 *
 * Every function returns an explicit envelope:
 *
 *   { ok: true,  mock: false, ... }              genuine AI result
 *   { ok: true,  mock: true,  ... }              synthetic, ONLY in explicit
 *                                                AI_MOCK_MODE (non-production)
 *   { ok: false, unavailable: true, reason }     nothing was evaluated
 *
 * A failed evaluation never yields a score, a summary, or a generic question
 * dressed up as a personalised one.
 */

import logger from '../config/logger.js'

const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'

/** Interview scores are always 0–100. */
export const INTERVIEW_SCORE_MIN = 0
export const INTERVIEW_SCORE_MAX = 100

let groq = null
let langchainMessages = null

export const isAiMockMode = () =>
  process.env.AI_MOCK_MODE === 'true' && process.env.NODE_ENV !== 'production'

const initGroq = async () => {
  if (groq) return groq
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.startsWith('your_')) {
    logger.warn('[Interview AI] GROQ_API_KEY not configured')
    return null
  }
  try {
    const { ChatGroq } = await import('@langchain/groq')
    groq = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model:  GROQ_MODEL,
      temperature: 0.7,
    })
    logger.info('[Interview AI] Groq initialized', { model: GROQ_MODEL })
    return groq
  } catch (err) {
    logger.error('[Interview AI] Failed to init Groq', { error: err.message })
    return null
  }
}

const getMessages = async () => {
  if (langchainMessages) return langchainMessages
  const mod = await import('@langchain/core/messages')
  langchainMessages = mod
  return mod
}

const invokeGroq = async (systemPrompt, messages) => {
  const client = await initGroq()
  if (!client) throw new Error('Groq not configured')

  const { HumanMessage, SystemMessage, AIMessage } = await getMessages()
  const langchainMsgs = [
    new SystemMessage(systemPrompt),
    ...messages.map(m =>
      m.role === 'interviewer' || m.role === 'ai'
        ? new AIMessage(m.content)
        : new HumanMessage(m.content)
    ),
  ]

  logger.info('[Interview AI] Invoking Groq', { model: GROQ_MODEL, messageCount: langchainMsgs.length })
  const response = await client.invoke(langchainMsgs)
  return String(response.content || '').trim()
}

// ── Result helpers ────────────────────────────────────────────────────────────

const unavailable = (reason, message, err) => {
  logger.error('[Interview AI] Evaluation unavailable', {
    reason,
    error: err?.message,     // server-side only
  })
  return {
    ok: false,
    unavailable: true,
    reason,
    message: message || 'AI evaluation is unavailable right now.',
  }
}

const classify = (err) => {
  const text = String(err?.message || '')
  if (text.includes('not configured')) return 'not_configured'
  if (text.includes('valid JSON') || text.includes('Invalid question count')) return 'invalid_response'
  if (text.includes('429') || text.toLowerCase().includes('rate limit')) return 'rate_limited'
  return 'request_failed'
}

/** Clamp an interview score to the single 0–100 scale. */
export const normaliseInterviewScore = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return Math.max(INTERVIEW_SCORE_MIN, Math.min(INTERVIEW_SCORE_MAX, Math.round(num)))
}

const stringArray = (value, max = 5) =>
  Array.isArray(value)
    ? value.filter(item => typeof item === 'string' && item.trim()).slice(0, max)
    : []

// ── Mock-only content (never used outside explicit AI_MOCK_MODE) ─────────────

const MOCK_OPENING = (jobTitle) => ({
  message: `Hello! I'm Alex, and I'll be conducting your technical interview today for the ${jobTitle || 'Software Engineer'} position. Let's start with something foundational — can you walk me through your most impactful project and the technical decisions you made?`,
  category: 'behavioral',
})

const MOCK_FOLLOWUPS = [
  'That\'s interesting. Can you explain the architecture of that project? What were the key components and how did they communicate?',
  'How do you approach debugging a complex issue in production? Walk me through your process.',
  'Can you explain the difference between SQL and NoSQL databases? When would you choose one over the other?',
  'Tell me about a time you had to learn a new technology quickly. How did you approach it?',
  'How would you design a URL shortening service? Walk me through the high-level architecture.',
  'Describe a situation where you had to work with a difficult team member. How did you handle it?',
  'Thank you for your time today. I\'ve really enjoyed our conversation. I\'ll share my feedback with the team. Best of luck!',
]

const MOCK_QUESTIONS = [
  'Tell me about yourself and your professional background.',
  'Explain a project from your resume that you are most proud of.',
  'What are your core technical strengths and how have you applied them?',
  'Describe a challenging technical problem you faced and how you solved it.',
  'Why should we hire you for this role?',
]

// ── System prompt builder ─────────────────────────────────────────────────────

const buildSystemPrompt = (jobTitle, resumeSummary) => `
You are Alex, a senior technical interviewer at a world-class tech company.
You are conducting a structured technical interview for the role of: ${jobTitle}.

Candidate background: ${resumeSummary || 'Not provided'}

Your interview style:
- Ask ONE focused question at a time
- Adapt follow-up questions based on candidate's answers
- Probe deeper on vague answers
- Cover: technical knowledge, problem-solving, system design, and behavioral aspects
- Be professional, encouraging, but rigorous
- If the candidate gives an excellent answer, acknowledge it briefly before moving on
- Keep responses concise (2-4 sentences max for questions)
- Never reveal the answer to your own questions

After 5-7 questions, you may wrap up with "Thank you for your time. I'll share my feedback with the team."
`.trim()

// ── Recruiter-initiated flow ─────────────────────────────────────────────────

/** Generate the first interview question. */
export const startInterview = async ({ jobTitle, resumeText, resumeSkills }) => {
  const resumeSummary = resumeSkills?.length > 0
    ? `Skills: ${resumeSkills.join(', ')}. ${resumeText?.substring(0, 300) || ''}`
    : resumeText?.substring(0, 300) || 'No resume provided'

  try {
    const content = await invokeGroq(
      buildSystemPrompt(jobTitle, resumeSummary),
      [{ role: 'human', content: 'Please start the interview with a warm welcome and your first question.' }]
    )

    if (!content) throw new Error('AI returned an empty opening')
    logger.info('[Interview AI] Opening question generated via AI', { jobTitle })
    return { ok: true, mock: false, message: content, category: 'technical' }
  } catch (err) {
    if (isAiMockMode()) {
      logger.warn('[Interview AI] MOCK MODE — synthetic opening question')
      return { ok: true, mock: true, ...MOCK_OPENING(jobTitle) }
    }
    return unavailable(classify(err), 'The AI interviewer is unavailable. The interview was not started.', err)
  }
}

/** Continue the interview given full message history. */
export const continueInterview = async ({ jobTitle, resumeText, resumeSkills, messages, questionCount }) => {
  const resumeSummary = resumeSkills?.length > 0
    ? `Skills: ${resumeSkills.join(', ')}`
    : resumeText?.substring(0, 200) || 'Not provided'

  const wrapUpHint = questionCount >= 6
    ? '\n\nNote: This is the final question. After the candidate answers, thank them and conclude the interview.'
    : ''

  try {
    const content = await invokeGroq(
      buildSystemPrompt(jobTitle, resumeSummary) + wrapUpHint,
      messages.map(m => ({ role: m.role, content: m.content }))
    )

    if (!content) throw new Error('AI returned an empty follow-up')
    logger.info('[Interview AI] Follow-up question generated', { questionCount })
    return { ok: true, mock: false, message: content }
  } catch (err) {
    if (isAiMockMode()) {
      logger.warn('[Interview AI] MOCK MODE — synthetic follow-up question')
      const idx = Math.min(Math.max(questionCount - 1, 0), MOCK_FOLLOWUPS.length - 1)
      return { ok: true, mock: true, message: MOCK_FOLLOWUPS[idx] }
    }
    return unavailable(classify(err), 'The AI interviewer could not continue. No next question was generated.', err)
  }
}

/**
 * Evaluate a single answer (recruiter flow).
 * Score is an integer 0–100, the only scale used for interview scores.
 */
export const evaluateAnswer = async ({ question, answer, jobTitle }) => {
  if (!answer || !answer.trim()) {
    return { ok: true, mock: false, score: 0, feedback: 'No answer was provided.', category: 'technical' }
  }

  const prompt = `
Role: ${jobTitle}
Question asked: ${question}
Candidate answer: ${answer}

Evaluate this answer. Return ONLY valid JSON:
{
  "score": <integer 0-100, where 100 is a perfect answer>,
  "feedback": "<brief constructive feedback in 1-2 sentences>",
  "category": "<technical|behavioral|system-design|communication>",
  "strength": "<what they did well>",
  "improvement": "<what could be better>"
}`

  try {
    const content = await invokeGroq(
      'You are a technical interview evaluator. Return ONLY valid JSON. Scores are integers from 0 to 100.',
      [{ role: 'human', content: prompt }]
    )

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI did not return valid JSON')
    const parsed = JSON.parse(jsonMatch[0])

    const score = normaliseInterviewScore(parsed.score)
    if (score === null) throw new Error('AI response missing a numeric score')

    return {
      ok: true,
      mock: false,
      score,
      feedback: typeof parsed.feedback === 'string' ? parsed.feedback : '',
      category: ['technical', 'behavioral', 'system-design', 'communication'].includes(parsed.category)
        ? parsed.category
        : 'technical',
      strength: typeof parsed.strength === 'string' ? parsed.strength : '',
      improvement: typeof parsed.improvement === 'string' ? parsed.improvement : '',
    }
  } catch (err) {
    if (isAiMockMode()) {
      logger.warn('[Interview AI] MOCK MODE — synthetic answer evaluation')
      return { ok: true, mock: true, score: 60, feedback: 'Synthetic evaluation (mock mode).', category: 'technical' }
    }
    return unavailable(classify(err), 'This answer could not be evaluated.', err)
  }
}

/**
 * Generate the final interview summary (recruiter flow).
 * Scores are 0–100 — the same scale as per-answer evaluation.
 */
export const generateInterviewSummary = async ({ jobTitle, messages }) => {
  const transcript = messages
    .map(m => `${m.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${m.content}`)
    .join('\n\n')

  const prompt = `
Review this complete interview transcript for the role: ${jobTitle}

TRANSCRIPT:
${transcript.substring(0, 4000)}

Provide a comprehensive evaluation. Return ONLY valid JSON (all scores are integers 0-100):
{
  "overall": <integer 0-100>,
  "technical": <integer 0-100>,
  "behavioral": <integer 0-100>,
  "communication": <integer 0-100>,
  "summary": "<2-3 sentence executive summary>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "concerns": ["<concern 1>", "<concern 2>"],
  "recommendation": "<hire|interview-next|reject>",
  "reasoning": "<1 sentence justification>"
}`

  try {
    const content = await invokeGroq(
      'You are a hiring committee expert. Return ONLY valid JSON.',
      [{ role: 'human', content: prompt }]
    )

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI did not return valid JSON')
    const parsed = JSON.parse(jsonMatch[0])

    const overall = normaliseInterviewScore(parsed.overall)
    if (overall === null) throw new Error('AI response missing a numeric overall score')

    return {
      ok: true,
      mock: false,
      overall,
      technical: normaliseInterviewScore(parsed.technical) ?? 0,
      behavioral: normaliseInterviewScore(parsed.behavioral) ?? 0,
      communication: normaliseInterviewScore(parsed.communication) ?? 0,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      strengths: stringArray(parsed.strengths, 3),
      concerns: stringArray(parsed.concerns, 3),
      recommendation: ['hire', 'interview-next', 'reject'].includes(parsed.recommendation)
        ? parsed.recommendation
        : 'interview-next',
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    }
  } catch (err) {
    if (isAiMockMode()) {
      logger.warn('[Interview AI] MOCK MODE — synthetic interview summary')
      return {
        ok: true,
        mock: true,
        overall: 65,
        technical: 60,
        behavioral: 70,
        communication: 65,
        summary: 'Synthetic summary (mock mode).',
        strengths: ['Synthetic strength'],
        concerns: ['Synthetic concern'],
        recommendation: 'interview-next',
        reasoning: 'Mock mode is enabled; this is not a real evaluation.',
      }
    }
    return unavailable(classify(err), 'The interview summary could not be generated.', err)
  }
}

// ── Candidate-initiated flow ─────────────────────────────────────────────────

/**
 * Generate 5 questions based on the candidate's resume.
 * There is no generic-question fallback: if the AI cannot personalise them, the
 * caller is told so rather than being given stock questions labelled as
 * resume-derived.
 */
export const generateResumeBasedQuestions = async ({ resumeText, jobTitle }) => {
  const prompt = `
Candidate Resume:
${(resumeText || '').substring(0, 3000)}

Job Role: ${jobTitle || 'Software Engineer'}

Generate exactly 5 interview questions as a JSON array of strings.
Rules:
- Question 1 & 2: Ask about specific projects or experience mentioned in the resume
- Question 3: Ask about a specific technical skill mentioned in the resume
- Question 4: Ask one deep technical question relevant to the job role
- Question 5: Ask one behavioral question

Return ONLY a valid JSON array, e.g.: ["Q1", "Q2", "Q3", "Q4", "Q5"]
`

  try {
    const content = await invokeGroq(
      'You are a senior technical interviewer. Return ONLY a valid JSON array of 5 question strings.',
      [{ role: 'human', content: prompt }]
    )

    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('AI did not return a valid JSON array')
    const parsed = JSON.parse(jsonMatch[0])

    const questions = Array.isArray(parsed)
      ? parsed.filter(q => typeof q === 'string' && q.trim())
      : []
    if (questions.length < 5) throw new Error('Invalid question count')

    logger.info('[Interview AI] Resume-based questions generated', { count: questions.length, jobTitle })
    return { ok: true, mock: false, questions: questions.slice(0, 5) }
  } catch (err) {
    if (isAiMockMode()) {
      logger.warn('[Interview AI] MOCK MODE — generic questions (not resume-derived)')
      return { ok: true, mock: true, questions: MOCK_QUESTIONS }
    }
    return unavailable(
      classify(err),
      'Interview questions could not be generated from your resume right now. Please try again later.',
      err
    )
  }
}

/**
 * Evaluate one candidate answer on the 0–100 scale.
 * No random or invented score is ever returned.
 */
export const evaluateInterviewAnswer = async ({ question, answer, jobTitle }) => {
  // Nothing was said: that is a genuine zero, not a missing evaluation.
  if (!answer || !answer.trim()) {
    return { ok: true, mock: false, score: 0, feedback: 'No answer was provided.' }
  }

  const prompt = `
Role: ${jobTitle || 'Software Engineer'}
Question: ${question}
Candidate Answer: ${answer}

Evaluate this interview answer on a scale of 0-100 (100 = perfect).
Return ONLY valid JSON:
{
  "score": <integer 0-100>,
  "feedback": "<1-2 sentence constructive feedback>"
}`

  try {
    const content = await invokeGroq(
      'You are a technical interview evaluator. Return ONLY valid JSON with score (0-100) and feedback.',
      [{ role: 'human', content: prompt }]
    )

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI did not return valid JSON')
    const parsed = JSON.parse(jsonMatch[0])

    const score = normaliseInterviewScore(parsed.score)
    if (score === null) throw new Error('AI response missing a numeric score')

    logger.info('[Interview AI] Answer evaluated', { score, jobTitle })
    return {
      ok: true,
      mock: false,
      score,
      feedback: typeof parsed.feedback === 'string' ? parsed.feedback : 'Evaluated.',
    }
  } catch (err) {
    if (isAiMockMode()) {
      logger.warn('[Interview AI] MOCK MODE — synthetic answer evaluation')
      return { ok: true, mock: true, score: 60, feedback: 'Synthetic evaluation (mock mode).' }
    }
    return unavailable(classify(err), 'This answer could not be evaluated by the AI.', err)
  }
}
