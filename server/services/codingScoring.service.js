/**
 * codingScoring.service.js
 *
 * Pure rules for turning candidate answers into a pass rate.
 * Kept separate from the controller so the integrity rules are unit-tested:
 *
 *   - an answer is matched to the question it declares via `questionIndex`,
 *     never by array position;
 *   - a question with no answer still contributes its test cases to the
 *     denominator, so skipping questions cannot inflate the pass rate;
 *   - the score is the share of ALL test cases passed.
 */

/**
 * Map submitted answers by the question index they claim to answer.
 * Later duplicates for the same index are ignored (first answer wins).
 */
export const mapAnswersByQuestionIndex = (answers = []) => {
  const byIndex = new Map()

  for (const answer of Array.isArray(answers) ? answers : []) {
    const index = Number(answer?.questionIndex)
    if (!Number.isInteger(index) || index < 0) continue
    if (byIndex.has(index)) continue
    byIndex.set(index, answer)
  }

  return byIndex
}

/**
 * Overall pass rate over every question in the assessment.
 *
 * @param {Array<{passed:number,total:number}>} testResults
 */
export const computeOverallResult = (testResults = []) => {
  const totalPassed = testResults.reduce((sum, r) => sum + (Number(r?.passed) || 0), 0)
  const totalCases  = testResults.reduce((sum, r) => sum + (Number(r?.total) || 0), 0)

  const overallScore = totalCases > 0
    ? Math.round((totalPassed / totalCases) * 100)
    : 0

  const verdict =
    overallScore === 100 ? 'Accepted' :
    overallScore >= 50   ? 'Partial'  : 'Wrong Answer'

  return { totalPassed, totalCases, overallScore, verdict }
}
