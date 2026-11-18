import { useState, useEffect } from 'react'
import { Users, Search, Trash2, MoreVertical, Briefcase, ChevronDown } from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  PageHeader, StatusPill, EmptyState, LoadingBlock, ScoreBar,
} from '../../components/ui'
import InterviewCell from '../../components/InterviewCell'
import AssessmentCell from '../../components/AssessmentCell'

const STAGES = ['applied', 'screening', 'interview']

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('-totalScore')
  const [activeMenu, setActiveMenu] = useState(null)

  const fetchCandidates = async () => {
    setLoading(true)
    try {
      const params = { sort: sortBy, limit: 100 }
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/candidates', { params })
      setCandidates(data.candidates || [])
      setTotal(data.total || 0)
    } catch {
      toast.error('Could not load candidates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCandidates() }, [statusFilter, sortBy])

  useEffect(() => {
    if (!activeMenu) return
    const close = () => setActiveMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [activeMenu])

  const changeStatus = async (id, status) => {
    try {
      await api.patch(`/candidates/${id}/status`, { status })
      setCandidates(prev => prev.map(c => c._id === id ? { ...c, status } : c))
      toast.success(`Stage set to ${status}`)
      setActiveMenu(null)
    } catch {
      toast.error('Update failed')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this candidate from your pipeline?')) return
    try {
      await api.delete(`/candidates/${id}`)
      setCandidates(prev => prev.filter(c => c._id !== id))
      setTotal(t => Math.max(0, t - 1))
      toast.success('Candidate removed')
    } catch {
      toast.error('Delete failed')
    }
  }

  const filtered = search
    ? candidates.filter(c =>
        (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.currentRole || '').toLowerCase().includes(search.toLowerCase())
      )
    : candidates

  return (
    <div className="animate-fade-in" onClick={() => activeMenu && setActiveMenu(null)}>
      <PageHeader
        title="Candidates"
        description={`${total} candidate${total === 1 ? '' : 's'} in the pipeline`}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-1.5">
          {STAGES.map(stage => {
            const count = candidates.filter(c => c.status === stage).length
            const active = statusFilter === stage
            return (
              <button
                key={stage}
                onClick={() => setStatusFilter(active ? '' : stage)}
                className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-[12.5px] transition-colors ${
                  active
                    ? 'bg-white border-ink-300 text-ink-900'
                    : 'bg-transparent border-transparent text-ink-600 hover:bg-ink-100'
                }`}
                aria-pressed={active}
              >
                <span className="capitalize">{stage}</span>
                <span className="num text-ink-400">{count}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              placeholder="Search candidates"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-8 w-[200px]"
              aria-label="Search candidates"
            />
          </div>
          <select
            className="input w-auto min-w-[132px]"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            aria-label="Sort candidates"
          >
            <option value="-totalScore">Top score</option>
            <option value="-resumeScore">Resume score</option>
            <option value="-codeScore">Code score</option>
            <option value="-createdAt">Newest</option>
          </select>
        </div>
      </div>

      <div className="card overflow-visible">
        {loading ? (
          <LoadingBlock label="Loading candidates" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search || statusFilter ? 'No candidates match' : 'No candidates yet'}
            description={search || statusFilter
              ? 'Clear the search or stage filter to see the full pipeline.'
              : 'Candidates appear here once they apply to one of your roles.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Candidate</th>
                  <th className="th text-right">Roles</th>
                  <th className="th">Stage</th>
                  <th className="th w-[132px]">Resume</th>
                  <th className="th w-[132px]">Coding</th>
                  <th className="th w-[132px]">Interview</th>
                  <th className="th text-right">Total</th>
                  <th className="th w-10"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c._id} className="hover:bg-ink-50/60 transition-colors">
                    <td className="td">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-md bg-ink-100 text-ink-600 text-[11.5px] font-medium flex items-center justify-center flex-shrink-0">
                          {(c.name || '?')[0]?.toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="text-ink-900 truncate">{c.name || 'Unnamed'}</p>
                          <p className="text-[12px] text-ink-500 truncate">{c.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td text-right">
                      <span className="inline-flex items-center gap-1.5 num text-[12.5px] text-ink-600">
                        <Briefcase size={11} className="text-ink-400" strokeWidth={1.8} />
                        {c.applicationsCount || 1}
                      </span>
                    </td>
                    <td className="td"><StatusPill status={c.status} /></td>
                    <td className="td">
                      <AssessmentCell status={c.resumeStatus} score={c.resumeScore} />
                    </td>
                    <td className="td">
                      <AssessmentCell status={c.codingStatus} score={c.codeScore} />
                    </td>
                    <td className="td">
                      <InterviewCell status={c.interviewStatus} score={c.interviewScore} />
                    </td>
                    <td className="td text-right whitespace-nowrap">
                      <span className="num text-[14px] font-medium text-ink-900">{c.totalScore || 0}</span>
                      <span className="num text-[11px] text-ink-400">/100</span>
                    </td>
                    <td className="td relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === c._id ? null : c._id) }}
                        className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
                        aria-label={`Actions for ${c.name || 'candidate'}`}
                        aria-expanded={activeMenu === c._id}
                      >
                        <MoreVertical size={15} />
                      </button>
                      {activeMenu === c._id && (
                        <div
                          className="absolute right-4 top-11 z-30 w-44 bg-white border border-line rounded-lg shadow-panel p-1 animate-fade-in"
                          onClick={e => e.stopPropagation()}
                        >
                          <p className="px-2 py-1 text-[11px] text-ink-400">Move to</p>
                          {STAGES.map(stage => (
                            <button
                              key={stage}
                              onClick={() => changeStatus(c._id, stage)}
                              className={`w-full text-left px-2 py-1.5 text-[13px] rounded-md capitalize transition-colors ${
                                c.status === stage
                                  ? 'text-accent-700 bg-accent-50'
                                  : 'text-ink-700 hover:bg-ink-50'
                              }`}
                            >
                              {stage}
                            </button>
                          ))}
                          <div className="border-t border-line my-1" />
                          <button
                            onClick={() => handleDelete(c._id)}
                            className="w-full text-left px-2 py-1.5 text-[13px] text-danger-600 hover:bg-danger-50 rounded-md flex items-center gap-1.5"
                          >
                            <Trash2 size={12} strokeWidth={1.8} />
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11.5px] text-ink-400 mt-3">
        Scores come from resume screening, coding submissions and the AI interview. An assessment
        that has not happened yet adds zero to the weighted total, and is shown as such.
      </p>
    </div>
  )
}
