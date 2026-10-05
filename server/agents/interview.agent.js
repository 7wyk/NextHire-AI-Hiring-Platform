/**
 * interview.agent.js
 *
 * Specialized agent for AI-powered interviews.
 * Handles: question generation, answer evaluation, context management, summaries.
 */

import { BaseAgent } from './base.agent.js'
import {
  startInterview,
  continueInterview,
  evaluateAnswer,
  generateInterviewSummary,
  generateResumeBasedQuestions,
  evaluateInterviewAnswer,
} from '../services/interview.service.js'
import logger from '../config/logger.js'

class InterviewAgent extends BaseAgent {
  constructor() {
    super({
      name: 'InterviewAgent',
      description: 'Generates interview questions, evaluates answers, maintains context, and creates final reports',
      tools: [
        'mongodb.getCandidate',
        'mongodb.getJob',
        'mongodb.getApplications',
        'mongodb.getInterviewSessions',
        'mongodb.saveScore',
        'notification.send',
      ],
    })
  }

  async _process(task) {
    switch (task.type) {
      case 'start-interview':
        return this._startInterview(task)
      case 'continue-interview':
        return this._continueInterview(task)
      case 'evaluate-answer':
        return this._evaluateAnswer(task)
      case 'generate-summary':
        return this._generateSummary(task)
      case 'generate-questions':
        return this._generateQuestions(task)
      case 'evaluate-candidate-answer':
        return this._evaluateCandidateAnswer(task)
      default:
        throw new Error(`InterviewAgent: unknown task type "${task.type}"`)
    }
  }

  /** Generate opening interview question */
  async _startInterview(task) {
    const { jobTitle, resumeText, resumeSkills } = task
    return startInterview({ jobTitle, resumeText, resumeSkills })
  }

  /** Continue interview with message history */
  async _continueInterview(task) {
    const { jobTitle, resumeText, resumeSkills, messages, questionCount } = task
    return continueInterview({ jobTitle, resumeText, resumeSkills, messages, questionCount })
  }

  /** Evaluate a single answer (recruiter-initiated interview) */
  async _evaluateAnswer(task) {
    const { question, answer, jobTitle } = task
    return evaluateAnswer({ question, answer, jobTitle })
  }

  /** Generate final interview summary */
  async _generateSummary(task) {
    const { jobTitle, messages } = task
    const summary = await generateInterviewSummary({ jobTitle, messages })

    // Persist interview score if candidate info is available
    if (task.userId && task.jobId && summary.overall) {
      this.useTool('mongodb.saveScore', {
        userId: task.userId,
        jobId: task.jobId,
        interviewScore: summary.overall,
      }).catch(() => {})
    }

    return summary
  }

  /** Generate resume-based questions (candidate-initiated interview) */
  async _generateQuestions(task) {
    const { resumeText, jobTitle } = task
    return generateResumeBasedQuestions({ resumeText, jobTitle })
  }

  /** Evaluate candidate answer (candidate-initiated interview) */
  async _evaluateCandidateAnswer(task) {
    const { question, answer, jobTitle } = task
    return evaluateInterviewAnswer({ question, answer, jobTitle })
  }
}

export const interviewAgent = new InterviewAgent()
export default interviewAgent
