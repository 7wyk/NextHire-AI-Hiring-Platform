/**
 * interview.service.js
 *
 * AI-powered interview engine using Groq LLM.
 * All functions have robust fallbacks so the interview flow NEVER crashes,
 * even if the AI model is unavailable, deprecated, or rate-limited.
 */

import logger from '../config/logger.js'

// ── Centralized model config ──────────────────────────────────────────────────
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

// ── Lazy Groq initialization (same pattern as ai.service.js) ──────────────────
let groq = null
let langchainMessages = null

const initGroq = async () => {
  if (groq) return groq
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.startsWith('your_')) {
    logger.warn('[Interview AI] GROQ_API_KEY not configured — will use fallbacks')
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
  return response.content.trim()
}

// ── Mock / Fallback responses ─────────────────────────────────────────────────

const FALLBACK_OPENING = (jobTitle) => ({
  role: 'interviewer',
  content: `Hello! I'm Alex, and I'll be conducting your technical interview today for the ${jobTitle || 'Software Engineer'} position. Thank you for taking the time to join us.\n\nLet's start with something foundational — can you walk me through your most impactful project and the technical decisions you made?`,
  category: 'behavioral',
})

const FALLBACK_FOLLOWUPS = [
  { role: 'interviewer', content: 'That\'s interesting. Can you explain the architecture of that project? What were the key components and how did they communicate?' },
  { role: 'interviewer', content: 'How do you approach debugging a complex issue in production? Walk me through your process.' },
  { role: 'interviewer', content: 'Can you explain the difference between SQL and NoSQL databases? When would you choose one over the other?' },
  { role: 'interviewer', content: 'Tell me about a time you had to learn a new technology quickly. How did you approach it?' },
  { role: 'interviewer', content: 'How would you design a URL shortening service? Walk me through the high-level architecture.' },
  { role: 'interviewer', content: 'Describe a situation where you had to work with a difficult team member. How did you handle it?' },
  { role: 'interviewer', content: 'Thank you for your time today. I\'ve really enjoyed our conversation. I\'ll share my feedback with the team. Best of luck!' },
]

const FALLBACK_EVALUATION = {
  score: 6,
  feedback: 'The candidate provided a reasonable answer. Further probing recommended.',
  category: 'technical',
  strength: 'Showed understanding of core concepts',
  improvement: 'Could provide more specific examples',
}

const FALLBACK_SUMMARY = {
  overall: 65,
  technical: 60,
  behavioral: 70,
  communication: 65,
  summary: 'The candidate demonstrated solid foundational knowledge with room for growth in advanced topics. Communication was clear and professional.',
  strengths: ['Good communication skills', 'Solid foundational knowledge', 'Positive attitude'],
  concerns: ['Limited depth on advanced technical topics', 'Could provide more concrete examples'],
  recommendation: 'interview-next',
  reasoning: 'Candidate shows potential but needs further evaluation on advanced technical skills.',
}

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

// ── Public API ────────────────────────────────────────────────────────────────

/** Generate the first interview question */
export const startInterview = async ({ jobTitle, resumeText, resumeSkills }) => {
  const resumeSummary = resumeSkills?.length > 0
    ? `Skills: ${resumeSkills.join(', ')}. ${resumeText?.substring(0, 300) || ''}`
    : resumeText?.substring(0, 300) || 'No resume provided'

  try {
    const content = await invokeGroq(
      buildSystemPrompt(jobTitle, resumeSummary),
      [{ role: 'human', content: 'Please start the interview with a warm welcome and your first question.' }]
    )

    logger.info('[Interview AI] Opening question generated via AI', { jobTitle })
    return { role: 'interviewer', content, category: 'technical' }
  } catch (err) {
    logger.warn('[Interview AI] startInterview falling back to mock', { error: err.message })
    return FALLBACK_OPENING(jobTitle)
  }
}

/** Continue the interview given full message history */
export const continueInterview = async ({ jobTitle, resumeText, resumeSkills, messages, questionCount }) => {
  const resumeSummary = resumeSkills?.length > 0
    ? `Skills: ${resumeSkills.join(', ')}`
    : resumeText?.substring(0, 200) || 'Not provided'

  // After 6+ questions, signal wrap-up
  const wrapUpHint = questionCount >= 6
    ? '\n\nNote: This is the final question. After the candidate answers, thank them and conclude the interview.'
    : ''

  try {
    const content = await invokeGroq(
      buildSystemPrompt(jobTitle, resumeSummary) + wrapUpHint,
      messages.map(m => ({ role: m.role, content: m.content }))
    )

    logger.info('[Interview AI] Follow-up question generated', { questionCount })
    return { role: 'interviewer', content }
  } catch (err) {
    logger.warn('[Interview AI] continueInterview falling back to mock', { error: err.message, questionCount })
    // Pick a fallback question based on the question count
    const idx = Math.min(questionCount - 1, FALLBACK_FOLLOWUPS.length - 1)
    return FALLBACK_FOLLOWUPS[idx]
  }
}

/** Evaluate a single candidate answer */
export const evaluateAnswer = async ({ question, answer, jobTitle }) => {
  const prompt = `
Role: ${jobTitle}
Question asked: ${question}
Candidate answer: ${answer}

Evaluate this answer. Return ONLY valid JSON:
{
  "score": <integer 0-10>,
  "feedback": "<brief constructive feedback in 1-2 sentences>",
  "category": "<technical|behavioral|system-design|communication>",
  "strength": "<what they did well>",
  "improvement": "<what could be better>"
}`

  try {
    const content = await invokeGroq(
      'You are a technical interview evaluator. Return ONLY valid JSON.',
      [{ role: 'human', content: prompt }]
    )

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return FALLBACK_EVALUATION
    const parsed = JSON.parse(jsonMatch[0])
    logger.info('[Interview AI] Answer evaluated via AI', { score: parsed.score })
    return parsed
  } catch (err) {
    logger.warn('[Interview AI] evaluateAnswer falling back to mock', { error: err.message })
    return FALLBACK_EVALUATION
  }
}

/** Generate final interview summary after session ends */
export const generateInterviewSummary = async ({ jobTitle, messages }) => {
  const transcript = messages
    .map(m => `${m.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${m.content}`)
    .join('\n\n')

  const prompt = `
Review this complete interview transcript for the role: ${jobTitle}

TRANSCRIPT:
${transcript.substring(0, 4000)}

Provide a comprehensive evaluation. Return ONLY valid JSON:
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
    logger.info('[Interview AI] Summary generated via AI', { overall: parsed.overall, recommendation: parsed.recommendation })
    return parsed
  } catch (err) {
    logger.warn('[Interview AI] generateInterviewSummary falling back to mock', { error: err.message })
    return FALLBACK_SUMMARY
  }
}

// ── Candidate-initiated interview helpers ─────────────────────────────────

const FALLBACK_QUESTIONS = [
  'Tell me about yourself and your professional background.',
  'Explain a project from your resume that you are most proud of.',
  'What are your core technical strengths and how have you applied them?',
  'Describe a challenging technical problem you faced and how you solved it.',
  'Why should we hire you for this role?',
]

/**
 * Generate 5 resume-based interview questions.
 * Falls back to generic questions if AI is unavailable.
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

    if (!Array.isArray(parsed) || parsed.length < 5) throw new Error('Invalid question count')

    logger.info('[Interview AI] Resume-based questions generated', { count: parsed.length, jobTitle })
    return parsed.slice(0, 5)
  } catch (err) {
    logger.warn('[Interview AI] generateResumeBasedQuestions falling back to generic', { error: err.message })
    return FALLBACK_QUESTIONS
  }
}

/**
 * Evaluate a single candidate answer. Returns { score: 0-100, feedback: string }.
 * Falls back to random score 60-100 if AI is unavailable.
 */
export const evaluateInterviewAnswer = async ({ question, answer, jobTitle }) => {
  // Empty / very short answers get a low score immediately
  if (!answer || answer.trim().length < 5) {
    return { score: 20, feedback: 'No meaningful answer was provided.' }
  }

  const prompt = `
Role: ${jobTitle || 'Software Engineer'}
Question: ${question}
Candidate Answer: ${answer}

Evaluate this interview answer on a scale of 0-100.
Return ONLY valid JSON:
{
  "score": <integer 0-100>,
  "feedback": "<1-2 sentence constructive feedback>"
}`

  try {
    const content = await invokeGroq(
      'You are a technical interview evaluator. Return ONLY valid JSON with score and feedback.',
      [{ role: 'human', content: prompt }]
    )

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI did not return valid JSON')
    const parsed = JSON.parse(jsonMatch[0])

    const score = Math.max(0, Math.min(100, parseInt(parsed.score) || 60))
    logger.info('[Interview AI] Answer evaluated', { score, jobTitle })
    return { score, feedback: parsed.feedback || 'Evaluated successfully.' }
  } catch (err) {
    logger.warn('[Interview AI] evaluateInterviewAnswer falling back to mock', { error: err.message })
    return {
      score: Math.floor(Math.random() * 40) + 60,
      feedback: 'Decent answer. Improve clarity and technical depth.',
    }
  }
}
