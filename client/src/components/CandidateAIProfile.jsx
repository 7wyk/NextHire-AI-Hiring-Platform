import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import api from '../services/api'
import { ScoreBar, Spinner } from './ui'

export default function CandidateAIProfile({ candidateId, compact = false }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(!compact)

  useEffect(() => {
    if (!candidateId) return
    setLoading(true)
    api.get(`/candidates/${candidateId}`)
      .then(res => setData(res.data?.candidate || null))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [candidateId])

  if (loading) {
    return (
      <div className="card p-5 flex items-center gap-2 text-[12.5px] text-ink-500">
        <Spinner /> Loading candidate insights
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="card">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-ink-50/60 transition-colors rounded-xl"
        aria-expanded={expanded}
      >
        <div>
          <p className="text-[13px] font-medium text-ink-900">AI evaluation</p>
          <p className="text-[11.5px] text-ink-500">
            From resume screening, coding and interview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="num text-[15px] font-medium text-ink-900">
            {data.totalScore || 0}
            <span className="text-[11px] text-ink-400">/100</span>
          </span>
          {expanded
            ? <ChevronUp size={14} className="text-ink-400" />
            : <ChevronDown size={14} className="text-ink-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Resume', score: data.resumeScore },
              { label: 'Coding', score: data.codeScore },
              { label: 'Interview', score: data.interviewScore },
            ].map(({ label, score }) => (
              <div key={label}>
                <p className="text-[11.5px] text-ink-500 mb-1">{label}</p>
                {label === 'Interview' && data.interviewStatus && data.interviewStatus !== 'completed' ? (
                  <p className="text-[12px] text-ink-500">
                    {data.interviewStatus === 'in_progress' ? 'In progress' : 'Not started'}
                  </p>
                ) : (
                  <ScoreBar value={score || 0} />
                )}
              </div>
            ))}
          </div>

          {data.aiSummary && (
            <div>
              <p className="text-[11.5px] text-ink-500 mb-1">Summary</p>
              <p className="text-[12.5px] text-ink-700 leading-6">{data.aiSummary}</p>
            </div>
          )}

          {data.skills?.length > 0 && (
            <div>
              <p className="text-[11.5px] text-ink-500 mb-1.5">Skills</p>
              <p className="text-[12.5px] text-ink-700 leading-5">{data.skills.join(' · ')}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {data.strengths?.length > 0 && (
              <div>
                <p className="text-[11.5px] text-ink-500 mb-1.5">Strengths</p>
                <ul className="space-y-1">
                  {data.strengths.map((s, i) => (
                    <li key={i} className="text-[12px] text-ink-700 leading-5 flex gap-1.5">
                      <span className="text-ink-300">—</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.weaknesses?.length > 0 && (
              <div>
                <p className="text-[11.5px] text-ink-500 mb-1.5">Gaps</p>
                <ul className="space-y-1">
                  {data.weaknesses.map((w, i) => (
                    <li key={i} className="text-[12px] text-ink-700 leading-5 flex gap-1.5">
                      <span className="text-ink-300">—</span>{w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {data.aiHistory?.length > 0 && (
            <div>
              <p className="text-[11.5px] text-ink-500 mb-1.5">Evaluation history</p>
              <ul className="divide-y divide-line">
                {data.aiHistory.slice(0, 5).map((h, i) => (
                  <li key={i} className="flex items-center gap-2 py-1.5">
                    <span className="text-[11.5px] text-ink-500 capitalize w-[76px] flex-shrink-0">
                      {h.agentType}
                    </span>
                    <span className="text-[12px] text-ink-700 flex-1 truncate">
                      {h.summary}
                    </span>
                    {h.metadata?.score != null && (
                      <span className="num text-[12px] text-ink-900">{h.metadata.score}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.codingVerdict && (
            <p className="text-[12px] text-ink-600">
              Coding verdict: <span className="text-ink-900">{data.codingVerdict}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
