import { useState, useEffect } from 'react'
import {
  Trophy, Medal, Search, RefreshCw, ChevronDown,
  Code2, FileText, Mic, User, Briefcase, AlertCircle
} from 'lucide-react'
import { motion } from 'framer-motion'
import api from '../../services/api'

const TIER = (score) => {
  if (score >= 85) return { label: 'Top',      color: 'text-amber-400',   bg: 'bg-amber-500/10',  ring: 'ring-amber-500/30'  }
  if (score >= 65) return { label: 'Strong',   color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30' }
  if (score >= 45) return { label: 'Average',  color: 'text-blue-400',    bg: 'bg-blue-500/10',    ring: 'ring-blue-500/30'   }
  return              { label: 'Below Avg', color: 'text-slate-400',   bg: 'bg-slate-500/10',  ring: 'ring-slate-500/30'  }
}

const ScoreBar = ({ value = 0, color }) => (
  <div className="flex items-center gap-2 w-full">
    <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
    <span className="text-xs text-slate-400 w-8 text-right">{value}</span>
  </div>
)

export default function RankingPage() {
  const [jobs,       setJobs]       = useState([])
  const [selectedJob, setSelectedJob] = useState('')
  const [rankings,   setRankings]   = useState([])
  const [loading,    setLoading]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [error,      setError]      = useState('')

  // Load recruiter's jobs
  useEffect(() => {
    api.get('/jobs').then(r => {
      const list = r.data.jobs || r.data || []
      setJobs(list)
      if (list.length > 0) setSelectedJob(list[0]._id)
    }).catch(() => {})
  }, [])

  // Load rankings when job changes
  useEffect(() => {
    if (!selectedJob) return
    setLoading(true)
    setError('')
    api.get(`/candidates/rankings?jobId=${selectedJob}`)
      .then(r => setRankings(r.data.rankings || []))
      .catch(e => {
        setError(e.response?.data?.message || 'Failed to load rankings')
        setRankings([])
      })
      .finally(() => setLoading(false))
  }, [selectedJob])

  const filtered = rankings.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  const topScorer     = filtered[0]
  const avgTotal      = filtered.length
    ? Math.round(filtered.reduce((s, c) => s + (c.totalScore || 0), 0) / filtered.length)
    : 0
  const shortlisted   = filtered.filter(c => c.status === 'shortlisted').length

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Candidate Rankings</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Weighted score: Resume 30% + Code 40% + Interview 30%
          </p>
        </div>
        <button onClick={() => setSelectedJob(s => s)} className="flex items-center gap-2 px-4 py-2 rounded-xl
          bg-surface-700 border border-white/[0.07] text-slate-300 text-sm hover:bg-surface-600 transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Job selector + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative">
          <select
            value={selectedJob}
            onChange={e => setSelectedJob(e.target.value)}
            className="pl-4 pr-8 py-2.5 rounded-xl bg-surface-700 border border-white/[0.07]
              text-slate-200 text-sm appearance-none focus:outline-none focus:border-primary-500/40
              min-w-52 cursor-pointer"
          >
            {jobs.length === 0 && <option value="">No jobs found</option>}
            {jobs.map(j => (
              <option key={j._id} value={j._id}>{j.title} — {j.company}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search candidate..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-700 border border-white/[0.07]
              text-slate-300 placeholder-slate-500 text-sm focus:outline-none focus:border-primary-500/40"
          />
        </div>
      </div>

      {/* Summary cards */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Candidates', value: filtered.length, icon: User,    color: 'text-primary-400'  },
            { label: 'Avg Score',        value: avgTotal + '%',  icon: Trophy,  color: 'text-amber-400'    },
            { label: 'Shortlisted',      value: shortlisted,     icon: Medal,   color: 'text-emerald-400'  },
          ].map(s => (
            <div key={s.label} className="bg-surface-800 border border-white/[0.06] rounded-2xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-700 flex items-center justify-center flex-shrink-0">
                <s.icon size={16} className={s.color} />
              </div>
              <div>
                <p className="text-white font-bold text-lg leading-none">{s.value}</p>
                <p className="text-slate-500 text-xs mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Rankings table */}
      <div className="bg-surface-800 border border-white/[0.06] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Loading rankings...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Trophy className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No ranked candidates yet</p>
            <p className="text-slate-600 text-sm mt-1">Screen resumes and candidates will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((c, idx) => {
              const tier = TIER(c.totalScore || 0)
              const isTop = idx === 0
              return (
                <motion.div
                  key={c._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors
                    ${isTop ? 'bg-amber-500/[0.04]' : ''}`}
                >
                  {/* Rank */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0
                    ${idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                      idx === 1 ? 'bg-slate-400/10 text-slate-300' :
                      idx === 2 ? 'bg-amber-700/20 text-amber-600' :
                      'bg-surface-700 text-slate-500'}`}>
                    {idx < 3 ? ['🥇','🥈','🥉'][idx] : idx + 1}
                  </div>

                  {/* Candidate info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{c.name}</p>
                    <p className="text-slate-500 text-xs truncate">{c.email}</p>
                  </div>

                  {/* Score breakdown */}
                  <div className="hidden lg:grid grid-cols-3 gap-4 w-64">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <FileText size={10} className="text-blue-400" />
                        <span className="text-[10px] text-slate-500">Resume</span>
                      </div>
                      <ScoreBar value={c.resumeScore || 0} color="bg-blue-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <Code2 size={10} className="text-emerald-400" />
                        <span className="text-[10px] text-slate-500">Code</span>
                      </div>
                      <ScoreBar value={c.codeScore || 0} color="bg-emerald-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <Mic size={10} className="text-purple-400" />
                        <span className="text-[10px] text-slate-500">Interview</span>
                      </div>
                      <ScoreBar value={c.interviewScore || 0} color="bg-purple-500" />
                    </div>
                  </div>

                  {/* Total score */}
                  <div className={`w-14 h-14 rounded-2xl ${tier.bg} ring-1 ${tier.ring}
                    flex flex-col items-center justify-center flex-shrink-0`}>
                    <span className={`text-xl font-black ${tier.color}`}>{c.totalScore || 0}</span>
                    <span className={`text-[9px] font-semibold ${tier.color} opacity-70`}>{tier.label}</span>
                  </div>

                  {/* Submission verdict */}
                  {c.submission && (
                    <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                      ${c.submission.verdict === 'Accepted' ? 'bg-emerald-500/10 text-emerald-400' :
                        c.submission.verdict === 'Partial'  ? 'bg-amber-500/10  text-amber-400'   :
                        'bg-red-500/10 text-red-400'}`}>
                      <Code2 size={10} />
                      {c.submission.verdict}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Formula legend */}
      <p className="text-center text-slate-600 text-xs">
        Final Score = (Resume × 0.30) + (Code × 0.40) + (Interview × 0.30)
      </p>
    </div>
  )
}
