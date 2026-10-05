import fs from 'fs'
import { extractTextFromFile }          from '../services/parser.service.js'
import {
  screenResumeWithAI,
  generateInterviewQuestions,
} from '../services/ai.service.js'
import { upload } from '../config/multer.js'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/parse-resume          (multipart/form-data, field: "resume")
// Pure text extraction — no AI, no DB write.
// Returns: { text, wordCount, characters }
// ─────────────────────────────────────────────────────────────────────────────
export const parseResume = async (req, res) => {
  const filePath = req.file?.path
  try {
    if (!req.file)
      return res.status(400).json({ message: 'Resume file is required (PDF, DOC, DOCX or TXT)' })

    const text = await extractTextFromFile(filePath)

    if (!text || text.length < 30)
      return res.status(422).json({ message: 'Could not extract readable text from the file' })

    fs.unlinkSync(filePath)   // clean up temp file

    res.json({
      text,
      wordCount:  text.split(/\s+/).filter(Boolean).length,
      characters: text.length,
    })
  } catch (err) {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/score-resume          (application/json)
// Body: { resumeText: string, jobTitle?: string, jobDescription?: string }
// Returns: { score, summary, strengths, weaknesses, skills, experience, recommendation }
// ─────────────────────────────────────────────────────────────────────────────
export const scoreResume = async (req, res) => {
  try {
    const { resumeText, jobTitle, jobDescription } = req.body

    if (!resumeText)
      return res.status(400).json({ message: 'resumeText is required' })
    if (resumeText.length < 30)
      return res.status(400).json({ message: 'resumeText is too short to analyse' })
    if (!jobTitle && !jobDescription)
      return res.status(400).json({ message: 'Provide at least jobTitle or jobDescription' })

    // Build unified job context for the prompt
    const jobContext = [
      jobTitle       && `Role: ${jobTitle}`,
      jobDescription && `Description: ${jobDescription.substring(0, 1500)}`,
    ].filter(Boolean).join('\n')

    const result = await screenResumeWithAI(resumeText, jobContext)

    res.json({ result })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/generate-questions    (application/json)
// Body: { resumeText: string, jobTitle: string, jobDescription?: string, round?: 1|2 }
// Returns: { questions: [ { id, question, category, difficulty } ], total }
// ─────────────────────────────────────────────────────────────────────────────
export const generateQuestions = async (req, res) => {
  try {
    const { resumeText, jobTitle, jobDescription, round = 1 } = req.body

    if (!resumeText)
      return res.status(400).json({ message: 'resumeText is required' })
    if (!jobTitle)
      return res.status(400).json({ message: 'jobTitle is required' })

    // Combine title + optional description as role context for the prompt
    const roleContext = jobDescription
      ? `${jobTitle}\n${jobDescription.substring(0, 800)}`
      : jobTitle

    const result = await generateInterviewQuestions(resumeText, roleContext, Number(round))

    res.json({
      questions: result.questions ?? [],
      total:     result.questions?.length ?? 0,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
