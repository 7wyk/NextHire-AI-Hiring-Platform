import { ScoreBar } from './ui'

/**
 * Assessment presence in the recruiter tables.
 *
 * A completed assessment may legitimately score 0, so "not evaluated" and a
 * genuine zero must never look the same. Status comes from the API
 * (`resumeStatus` / `codingStatus`) which is derived from the evidence:
 * a screened profile row, or an actual submission.
 */
const MISSING_LABELS = {
  not_evaluated: 'Not evaluated',
  not_taken: 'Not taken',
}

export default function AssessmentCell({ status = 'completed', score = 0 }) {
  const missingLabel = MISSING_LABELS[status]

  if (missingLabel) {
    return <span className="text-[12px] text-ink-400">{missingLabel}</span>
  }

  return <ScoreBar value={score} />
}
