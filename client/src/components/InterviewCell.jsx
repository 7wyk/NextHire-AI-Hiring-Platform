import { ScoreBar } from './ui'

/**
 * Interview state in the recruiter tables.
 *
 * A completed interview may legitimately score 0, so "no interview" and
 * "interview scored 0" are rendered differently and never collapsed into one
 * grey zero.
 */
export default function InterviewCell({ status = 'not_started', score = 0 }) {
  if (status === 'completed') {
    return (
      <div className="space-y-1">
        <ScoreBar value={score} />
        <span className="text-[10.5px] text-ink-400">Completed</span>
      </div>
    )
  }

  if (status === 'unavailable') {
    return (
      <div className="space-y-1">
        <span className="pill-neutral">Not evaluated</span>
        <span className="block text-[10.5px] text-ink-400">AI unavailable</span>
      </div>
    )
  }

  if (status === 'in_progress') {
    return <span className="pill-warn">In progress</span>
  }

  return <span className="text-[12px] text-ink-400">Not started</span>
}
