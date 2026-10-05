import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Briefcase, MapPin, Clock, Users,
  ChevronDown, X, Send, CheckCircle2, DollarSign,
  FileText, Upload, Loader2
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const typeColors = {
  'full-time':  'badge-primary',
  'part-time':  'badge-warning',
  'contract':   'badge-success',
  'internship': 'badge',
}

const APPLY_EMPTY = { coverLetter: '' }

export default function PublicJobsPage() {
  const [jobs, setJobs]           = useState([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [page, setPage]           = useState(1)
  const [pages, setPages]         = useState(1)

  // Apply modal state
  const [applyJob, setApplyJob]   = useState(null)
  const [applyForm, setApplyForm] = useState(APPLY_EMPTY)
  const [resumeFile, setResumeFile] = useState(null)
  const [applying, setApplying]   = useState(false)
  const [applied, setApplied]     = useState(new Set())

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const params = { page, limit: 9 }
      if (search)        params.search   = search
      if (typeFilter)    params.type     = typeFilter
      if (locationFilter) params.location = locationFilter
      const { data } = await api.get('/jobs/public', { params })
      setJobs(data.jobs)
      setTotal(data.total)
      setPages(data.pages || 1)
    } catch {
      toast.error('Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchJobs() }, [search, typeFilter, locationFilter, page])

  // Applied roles must survive a page refresh and a new browser session.
  useEffect(() => {
    api.get('/applications/mine/job-ids')
      .then(({ data }) => setApplied(new Set(data.jobIds || [])))
      .catch(() => {})
  }, [])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, typeFilter, locationFilter])

  const openApply = (job) => {
    if (applied.has(job._id)) {
      toast('Already applied for this role.', { icon: 'ℹ️' })
      return
    }
    setApplyJob(job)
    setApplyForm(APPLY_EMPTY)
    setResumeFile(null)
  }

  const handleApply = async (e) => {
    e.preventDefault()
    if (!applyJob) return
    setApplying(true)
    try {
      // Use FormData to send resume file + text fields
      const formData = new FormData()
      formData.append('jobId', applyJob._id)
      if (applyForm.coverLetter) formData.append('coverLetter', applyForm.coverLetter)
      if (resumeFile) formData.append('resume', resumeFile)

      await api.post('/applications', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setApplied(prev => new Set([...prev, applyJob._id]))
      toast.success(`Applied to "${applyJob.title}" successfully! 🎉`)
      setApplyJob(null)
    } catch (err) {
      const msg = err.response?.data?.message || 'Application failed'
      toast.error(msg)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Browse Jobs</h1>
        <p className="text-slate-400 text-sm">{total} open position{total !== 1 ? 's' : ''} available</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Search roles, skills…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>

        {/* Type filter */}
        <div className="relative">
          <select
            className="input pr-9 appearance-none cursor-pointer"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
        </div>

        {/* Location filter */}
        <div className="relative">
          <input
            type="text"
            placeholder="Location…"
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value)}
            className="input w-36"
          />
        </div>
      </div>

      {/* Job Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-52 animate-pulse bg-surface-700" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="card text-center py-16">
          <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No open positions match your filters.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job, i) => {
            const hasApplied = applied.has(job._id)
            return (
              <motion.div
                key={job._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card flex flex-col"
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-500/15 border border-primary-500/20 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-primary-400" />
                  </div>
                  <span className={`${typeColors[job.type] || 'badge'} badge capitalize`}>{job.type}</span>
                </div>

                <h3 className="font-semibold text-white mb-1 line-clamp-1">{job.title}</h3>
                <p className="text-slate-400 text-sm mb-3">
                  {job.recruiter?.company || job.company}
                </p>

                {/* Meta */}
                <div className="space-y-1.5 mb-3 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <MapPin size={12} /> {job.location}
                  </div>
                  {(job.salaryMin || job.salaryMax) && (
                    <div className="flex items-center gap-2">
                      <DollarSign size={12} />
                      {job.salaryMin ? `$${job.salaryMin.toLocaleString()}` : ''}
                      {job.salaryMax ? ` – $${job.salaryMax.toLocaleString()}` : ''}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users size={12} /> {job.applicantCount} applicant{job.applicantCount !== 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={12} /> {new Date(job.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Skills */}
                {job.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {job.skills.slice(0, 4).map(s => (
                      <span key={s} className="badge bg-surface-600 text-slate-300 border-white/10 text-xs">{s}</span>
                    ))}
                    {job.skills.length > 4 && (
                      <span className="text-slate-500 text-xs">+{job.skills.length - 4}</span>
                    )}
                  </div>
                )}

                {/* Apply button */}
                <div className="mt-auto pt-3 border-t border-white/[0.06]">
                  {hasApplied ? (
                    <button
                      id={`applied-${job._id}`}
                      onClick={() => openApply(job)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-emerald-400 text-sm font-medium bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors"
                    >
                      <CheckCircle2 size={16} /> Applied
                    </button>
                  ) : (
                    <button
                      id={`apply-${job._id}`}
                      onClick={() => openApply(job)}
                      className="btn-primary w-full justify-center text-sm"
                    >
                      <Send size={14} /> Apply Now
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost text-sm disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-slate-400 text-sm">Page {page} of {pages}</span>
          <button
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="btn-ghost text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}

      {/* Apply Modal */}
      <AnimatePresence>
        {applyJob && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={e => e.target === e.currentTarget && setApplyJob(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-800 border border-white/[0.1] rounded-2xl p-6 w-full max-w-md"
            >
              {/* Modal header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{applyJob.title}</h3>
                  <p className="text-slate-400 text-sm">{applyJob.recruiter?.company || applyJob.company}</p>
                </div>
                <button
                  onClick={() => setApplyJob(null)}
                  className="text-slate-400 hover:text-white p-1 ml-3"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleApply} className="space-y-4">
                {/* Resume Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Resume <span className="text-primary-400">*recommended</span>
                  </label>
                  {resumeFile ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-500/10 border border-primary-500/20">
                      <FileText size={18} className="text-primary-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{resumeFile.name}</p>
                        <p className="text-slate-400 text-xs">{(resumeFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button type="button" onClick={() => setResumeFile(null)}
                        className="text-slate-400 hover:text-red-400 transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed border-white/10 hover:border-primary-500/30 bg-surface-700/50 cursor-pointer transition-colors">
                      <Upload size={22} className="text-slate-500" />
                      <p className="text-slate-400 text-sm">Click to upload PDF, DOC, or TXT</p>
                      <p className="text-slate-600 text-xs">Max 5MB</p>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) {
                            if (f.size > 5 * 1024 * 1024) {
                              toast.error('File too large (max 5MB)')
                              return
                            }
                            setResumeFile(f)
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* Cover Letter */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Cover Letter <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <textarea
                    className="input resize-none"
                    rows={4}
                    placeholder="Introduce yourself, highlight relevant experience…"
                    value={applyForm.coverLetter}
                    onChange={e => setApplyForm({ coverLetter: e.target.value })}
                    maxLength={2000}
                  />
                  <p className="text-slate-500 text-xs mt-1 text-right">
                    {applyForm.coverLetter.length}/2000
                  </p>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setApplyJob(null)}
                    className="btn-secondary flex-1 justify-center"
                  >
                    Cancel
                  </button>
                  <button
                    id="submit-apply-btn"
                    type="submit"
                    disabled={applying}
                    className="btn-primary flex-1 justify-center"
                  >
                    {applying ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" /> Submitting…
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Send size={14} /> Submit Application
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
