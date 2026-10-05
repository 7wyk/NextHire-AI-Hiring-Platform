/**
 * notification.agent.js
 *
 * Specialized agent for notifications.
 * Determines urgency, formats messages, and routes to appropriate users.
 */

import { BaseAgent } from './base.agent.js'
import logger from '../config/logger.js'

class NotificationAgent extends BaseAgent {
  constructor() {
    super({
      name: 'NotificationAgent',
      description: 'Sends formatted real-time notifications to recruiters and candidates with smart routing',
      tools: [
        'notification.send',
        'notification.broadcast',
      ],
    })
  }

  async _process(task) {
    switch (task.type) {
      case 'notify-recruiter':
        return this._notifyRecruiter(task)
      case 'notify-candidate':
        return this._notifyCandidate(task)
      case 'broadcast':
        return this._broadcast(task)
      case 'resume-screened':
        return this._resumeScreened(task)
      case 'test-submitted':
        return this._testSubmitted(task)
      case 'interview-completed':
        return this._interviewCompleted(task)
      default:
        throw new Error(`NotificationAgent: unknown task type "${task.type}"`)
    }
  }

  /** Generic recruiter notification */
  async _notifyRecruiter(task) {
    const { recruiterId, event, payload } = task
    const result = await this.useTool('notification.send', {
      userId: recruiterId,
      event: event || 'recruiter-update',
      payload: {
        ...payload,
        priority: this._determinePriority(event),
      },
    })
    return result.data
  }

  /** Generic candidate notification */
  async _notifyCandidate(task) {
    const { candidateId, event, payload } = task
    const result = await this.useTool('notification.send', {
      userId: candidateId,
      event: event || 'candidate-update',
      payload: {
        ...payload,
        priority: this._determinePriority(event),
      },
    })
    return result.data
  }

  /** Broadcast to all connected users */
  async _broadcast(task) {
    const { event, payload } = task
    const result = await this.useTool('notification.broadcast', { event, payload })
    return result.data
  }

  /** Formatted notification: resume screened */
  async _resumeScreened(task) {
    const { recruiterId, candidateName, jobTitle, score, recommendation } = task
    return this.useTool('notification.send', {
      userId: recruiterId,
      event: 'resume-screened',
      payload: {
        title: '📄 Resume Screened',
        message: `${candidateName}'s resume scored ${score}/100 for ${jobTitle}. Recommendation: ${recommendation}`,
        candidateName,
        jobTitle,
        score,
        recommendation,
        priority: score >= 80 ? 'high' : 'normal',
      },
    }).then(r => r.data)
  }

  /** Formatted notification: coding test submitted */
  async _testSubmitted(task) {
    const { recruiterId, candidateName, jobTitle, score, verdict } = task
    return this.useTool('notification.send', {
      userId: recruiterId,
      event: 'test-submitted',
      payload: {
        title: '💻 Coding Test Submitted',
        message: `${candidateName} scored ${score}% on ${jobTitle} coding test. Verdict: ${verdict}`,
        candidateName,
        jobTitle,
        score,
        verdict,
        priority: score >= 80 ? 'high' : 'normal',
      },
    }).then(r => r.data)
  }

  /** Formatted notification: interview completed */
  async _interviewCompleted(task) {
    const { recruiterId, candidateName, jobTitle, score, recommendation } = task
    return this.useTool('notification.send', {
      userId: recruiterId,
      event: 'interview-completed',
      payload: {
        title: '🎤 Interview Completed',
        message: `${candidateName}'s interview for ${jobTitle}: Score ${score}/100. Recommendation: ${recommendation}`,
        candidateName,
        jobTitle,
        score,
        recommendation,
        priority: recommendation === 'hire' ? 'high' : 'normal',
      },
    }).then(r => r.data)
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _determinePriority(event) {
    const highPriority = ['hire-recommendation', 'high-score-candidate', 'urgent-review']
    return highPriority.includes(event) ? 'high' : 'normal'
  }
}

export const notificationAgent = new NotificationAgent()
export default notificationAgent
