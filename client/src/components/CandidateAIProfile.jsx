import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Sparkles, TrendingUp, TrendingDown, Target,
  ChevronDown, ChevronUp, Award, Lightbulb, AlertTriangle,
  Clock, BarChart3
} from 'lucide-react'
import api from '../services/api'

/**
 * CandidateAIProfile.jsx
 *
 * Displays AI-generated insights for a candidate.
 * Shows: skills, strengths, weaknesses, evaluation history, recommendations.
 * Used in candidate detail views and recruiter dashboards.
 *
 * Props:
 *   candidateId — User._id of the candidate
 *   compact     — If true, shows condensed view
 */
export default function CandidateAIProfile({ candidateId, compact = false }) {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
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
      <div className="rounded-2xl border border-white/[0.07] bg-surface-800/50 p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/5" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-32 bg-white/5 rounded" />
            <div className="h-2 w-20 bg-white/5 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-2 w-full bg-white/5 rounded" />
          <div className="h-2 w-3/4 bg-white/5 rounded" />
        </div>
      </div>
    )
  }

  if (!data) return null

  const scoreColor = (score) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-amber-400'
    return 'text-red-400'
  }

  const scoreBg = (score) => {
    if (score >= 80) return 'from-green-600/20 to-green-800/10 border-green-500/30'
    if (score >= 60) return 'from-amber-600/20 to-amber-800/10 border-amber-500/30'
    return 'from-red-600/20 to-red-800/10 border-red-500/30'
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-surface-800/50 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center text-primary-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white text-sm font-semibold">AI Insights</h3>
            <p className="text-slate-400 text-xs">Agent-powered evaluation</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-lg font-bold ${scoreColor(data.totalScore)}`}>
            {data.totalScore || 0}/100
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-5 pb-5 space-y-5">
              {/* Score Cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Resume', score: data.resumeScore, icon: BarChart3 },
                  { label: 'Coding', score: data.codeScore, icon: Target },
                  { label: 'Interview', score: data.interviewScore, icon: Award },
                ].map(({ label, score, icon: Icon }) => (
                  <div
                    key={label}
                    className={`rounded-xl border bg-gradient-to-br p-3 text-center ${scoreBg(score || 0)}`}
                  >
                    <Icon className={`w-4 h-4 mx-auto mb-1 ${scoreColor(score || 0)}`} />
                    <p className={`text-xl font-bold ${scoreColor(score || 0)}`}>{score || 0}</p>
                    <p className="text-slate-500 text-[10px] uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>

              {/* AI Summary */}
              {data.aiSummary && (
                <div className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary-400" />
                    <h4 className="text-xs text-slate-400 uppercase tracking-wider font-semibold">AI Summary</h4>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{data.aiSummary}</p>
                </div>
              )}

              {/* Skills */}
              {data.skills?.length > 0 && (
                <div>
                  <h4 className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {data.skills.map(skill => (
                      <span key={skill} className="text-[11px] px-2.5 py-1 rounded-lg bg-primary-500/10 text-primary-300 ring-1 ring-primary-500/20">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-2 gap-3">
                {data.strengths?.length > 0 && (
                  <div>
                    <h4 className="text-xs text-green-400/80 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3" /> Strengths
                    </h4>
                    <ul className="space-y-1">
                      {data.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                          <Lightbulb className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.weaknesses?.length > 0 && (
                  <div>
                    <h4 className="text-xs text-red-400/80 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                      <TrendingDown className="w-3 h-3" /> Weaknesses
                    </h4>
                    <ul className="space-y-1">
                      {data.weaknesses.map((w, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                          <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* AI History (from memory system) */}
              {data.aiHistory?.length > 0 && (
                <div>
                  <h4 className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Evaluation History
                  </h4>
                  <div className="space-y-1.5">
                    {data.aiHistory.slice(0, 5).map((h, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] ring-1 ring-white/5 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-slate-500 capitalize">{h.agentType}</span>
                          <span className="text-slate-400 truncate">{h.summary?.substring(0, 60)}</span>
                        </div>
                        {h.metadata?.score != null && (
                          <span className={`font-semibold ${scoreColor(h.metadata.score)}`}>
                            {h.metadata.score}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coding Verdict */}
              {data.codingVerdict && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Coding Verdict:</span>
                  <span className={`font-semibold ${
                    data.codingVerdict === 'Accepted' ? 'text-green-400' :
                    data.codingVerdict === 'Partial' ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {data.codingVerdict}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
