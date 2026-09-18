/**
 * resume.agent.js
 *
 * Specialized agent for resume processing.
 * Handles: text extraction, AI screening, skills analysis, score persistence.
 * Uses MCP tools instead of direct service calls.
 */

import { BaseAgent } from './base.agent.js'
import logger from '../config/logger.js'

class ResumeAgent extends BaseAgent {
  constructor() {
    super({
      name: 'ResumeAgent',
      description: 'Reads resumes, extracts skills, analyzes experience, scores candidates, and generates feedback',
      tools: [
        'resume.extract',
        'resume.analyze',
        'cloudinary.uploadResume',
        'mongodb.getCandidate',
        'mongodb.getJob',
        'mongodb.saveScore',
        'notification.send',
      ],
    })
  }

  async _process(task) {
    switch (task.type) {
      case 'screen-resume':
        return this._screenResume(task)
      case 'extract-text':
        return this._extractText(task)
      case 'analyze-resume':
        return this._analyzeResume(task)
      default:
        throw new Error(`ResumeAgent: unknown task type "${task.type}"`)
    }
  }

  /**
   * Full resume screening pipeline:
   * 1. Extract text from file
   * 2. Upload to storage
   * 3. Fetch job description
   * 4. AI screening
   * 5. Save scores
   * 6. Notify recruiter
   */
  async _screenResume(task) {
    const { filePath, jobId, userId, candidateName, candidateEmail } = task

    // Step 1: Get job details via MCP
    const jobResult = await this.useTool('mongodb.getJob', { jobId })
    if (!jobResult.success) throw new Error(`Job lookup failed: ${jobResult.error}`)
    const job = jobResult.data

    // Step 2: Extract text from resume
    const extractResult = await this.useTool('resume.extract', { filePath })
    if (!extractResult.success) throw new Error(`Text extraction failed: ${extractResult.error}`)
    const { text: resumeText } = extractResult.data

    // Step 3: Upload to storage
    let resumeUrl = null
    let resumePublicId = null
    try {
      const uploadResult = await this.useTool('cloudinary.uploadResume', { filePath })
      if (uploadResult.success) {
        resumeUrl = uploadResult.data.url
        resumePublicId = uploadResult.data.publicId
      }
    } catch {
      logger.warn('[ResumeAgent] Upload skipped — continuing with screening')
    }

    // Step 4: AI screening
    const jobDescription = `${job.title} at ${job.company}.\n${job.description}\nRequired skills: ${job.skills?.join(', ')}`
    const analyzeResult = await this.useTool('resume.analyze', { resumeText, jobDescription })
    if (!analyzeResult.success) throw new Error(`AI analysis failed: ${analyzeResult.error}`)
    const aiResult = analyzeResult.data

    // Step 5: Save scores
    if (userId) {
      await this.useTool('mongodb.saveScore', {
        userId,
        jobId,
        resumeScore: aiResult.score || 0,
      })
    }

    // Step 6: Notify recruiter (non-blocking)
    if (job.recruiter) {
      this.useTool('notification.send', {
        userId: String(job.recruiter),
        event: 'resume-screened',
        payload: {
          candidateName: candidateName || 'Unknown',
          jobTitle: job.title,
          score: aiResult.score || 0,
          recommendation: aiResult.recommendation,
        },
      }).catch(() => {})
    }

    return {
      aiResult,
      resumeText: resumeText.substring(0, 5000),
      resumeUrl,
      resumePublicId,
      jobTitle: job.title,
    }
  }

  /** Extract text only (no AI, no DB) */
  async _extractText(task) {
    const result = await this.useTool('resume.extract', { filePath: task.filePath })
    if (!result.success) throw new Error(result.error)
    return result.data
  }

  /** Analyze text against a job (no file, no DB) */
  async _analyzeResume(task) {
    const { resumeText, jobDescription } = task
    const result = await this.useTool('resume.analyze', { resumeText, jobDescription })
    if (!result.success) throw new Error(result.error)
    return result.data
  }
}

// Singleton instance
export const resumeAgent = new ResumeAgent()
export default resumeAgent
