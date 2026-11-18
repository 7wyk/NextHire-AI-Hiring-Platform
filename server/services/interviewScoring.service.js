/**
 * interviewScoring.service.js
 *
 * The one place that turns interview answers into a final interview score.
 *
 * Rules:
 *   - every score is already 0–100 (AI answers are requested on that scale),
 *     so this function never multiplies or divides — it only averages;
 *   - a genuine zero counts (the candidate answered, the model scored it 0);
 *   - an answer whose evaluation failed (`evaluated === false`) is excluded;
 *   - if nothing could be evaluated the interview has NO score: the status is
 *     'unavailable', never a fabricated 0.
 */

import { normaliseInterviewScore } from './interview.service.js'

/** Was this answer actually given and successfully evaluated? */
export const isEvaluatedAnswer = (answer) =>
  (answer?.answerText || '').trim().length > 0 && answer?.evaluated !== false

/**
 * @param {Array<{answerText?:string, score?:number, evaluated?:boolean}>} answers
 * @returns {{finalScore:number, evaluatedCount:number, evaluationStatus:'evaluated'|'unavailable'}}
 */
export const scoreInterviewAnswers = (answers = []) => {
  const list = Array.isArray(answers) ? answers : []
  const scored = list.filter(isEvaluatedAnswer)

  const finalScore = scored.length > 0
    ? Math.round(
        scored.reduce((sum, answer) => sum + (normaliseInterviewScore(answer.score) ?? 0), 0) /
        scored.length
      )
    : 0

  return {
    finalScore,
    evaluatedCount: scored.length,
    evaluationStatus: scored.length > 0 ? 'evaluated' : 'unavailable',
  }
}
