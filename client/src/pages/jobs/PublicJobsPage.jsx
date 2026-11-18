import { useState, useEffect } from 'react'
import {
  Search, Briefcase, MapPin, Send, CheckCircle2, FileText, X, Loader2,
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  PageHeader, EmptyState, Modal, Field, Pagination, Alert,
} from '../../components/ui'

const TYPE_LABEL = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  'contract': 'Contract',
  'internship': 'Internship',
}

const APPLY_EMPTY = { coverLetter: '' }

export default function PublicJobsPage() {
  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)

  const [applyJob, setApplyJob] = useState(null)
  const [applyForm, setApplyForm] = useState(APPLY_EMPTY)
  const [resumeFile, setResumeFile] = useState(null)
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState('')
  const [applied, setApplied] = useState(new Set())

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const params = { page, limit: 9 }
      if (search) params.search = search
      if (typeFilter) params.type = typeFilter
      if (locationFilter) params.location = locationFilter
      const { data } = await api.get('/jobs/public', { params })
      setJobs(data.jobs || [])
      setTotal(data.total || 0)
      setPages(data.pages || 1)
    } catch {
      toast.error('Could not load open roles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchJobs() }, [search, typeFilter, locationFilter, page])

  useEffect(() => {
    api.get('/applications/mine/job-ids')
      .then(({ data }) => setApplied(new Set(data.jobIds || [])))
      .catch(() => {})
  }, [])

  useEffect(() => { setPage(1) }, [search, typeFilter, locationFilter])

  const openApply = (job) => {
    if (applied.has(job._id)) {
      toast('You have already applied to this role')
      return
    }
    setApplyJob(job)
    setApplyForm(APPLY_EMPTY)
    setResumeFile(null)
    setApplyError('')
  }

  const handleApply = async (e) => {
    e.preventDefault()
    if (!applyJob) return
    setApplying(true)
    setApplyError('')
    try {
      const formData = new FormData()
      formData.append('jobId', applyJob._id)
      if (applyForm.coverLetter) formData.append('coverLetter', applyForm.coverLetter)
      if (resumeFile) formData.append('resume', resumeFile)

      await api.post('/applications', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setApplied(prev => new Set([...prev, applyJob._id]))
      toast.success(`Application sent to ${applyJob.title}`)
      setApplyJob(null)
    } catch (err) {
      setApplyError(err.response?.data?.message || 'Application failed. Try again.')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Browse jobs"
        description={loading ? 'Loading open roles' : `${total} open position${total === 1 ? '' : 's'}`}
      />

      <div className="flex flex-wrap items-center gap-2 pb-4">
        <div className="relative flex-1 min-w-[180px] max-w-[300px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Search roles or skills"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-8"
            aria-label="Search roles"
          />
        </div>
        <select
          className="input w-auto min-w-[130px]"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          aria-label="Employment type"
        >
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Location"
          value={locationFilter}
          onChange={e => setLocationFilter(e.target.value)}
          className="input w-auto min-w-[130px]"
          aria-label="Location"
        />
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-[180px] animate-pulse bg-ink-100/60" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Briefcase}
            title="No open roles match those filters"
            description="Try a different search term, type or location."
          />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {jobs.map(job => {
            const hasApplied = applied.has(job._id)
            const salary = job.salaryMin && job.salaryMax
              ? `$${job.salaryMin.toLocaleString()} – $${job.salaryMax.toLocaleString()}`
              : job.salaryMin ? `From $${job.salaryMin.toLocaleString()}` : null

            return (
              <article key={job._id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[14px] font-medium text-ink-900 leading-5">{job.title}</h2>
                    <p className="text-[12.5px] text-ink-500 mt-0.5 truncate">
                      {job.recruiter?.company || job.company}
                    </p>
                  </div>
                  <span className="pill-neutral flex-shrink-0">{TYPE_LABEL[job.type] || job.type}</span>
                </div>

                <dl className="mt-4 space-y-1.5 text-[12.5px] text-ink-600">
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-ink-400" strokeWidth={1.7} />
                    <dd>{job.location || 'Not specified'}</dd>
                  </div>
                  {salary && (
                    <div className="flex items-center gap-2">
                      <span className="num text-ink-400 text-[11px]">USD</span>
                      <dd className="num">{salary}</dd>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Briefcase size={12} className="text-ink-400" strokeWidth={1.7} />
                    <dd>{job.applicantCount || 0} applicant{job.applicantCount === 1 ? '' : 's'}</dd>
                  </div>
                </dl>

                {job.skills?.length > 0 && (
                  <p className="text-[12px] text-ink-500 mt-3 leading-5">
                    {job.skills.slice(0, 4).join(' · ')}
                    {job.skills.length > 4 && ` +${job.skills.length - 4}`}
                  </p>
                )}

                <div className="mt-auto pt-4">
                  {hasApplied ? (
                    <button
                      id={`applied-${job._id}`}
                      onClick={() => openApply(job)}
                      className="btn-secondary w-full text-positive-600"
                    >
                      <CheckCircle2 size={14} strokeWidth={1.8} />
                      Applied
                    </button>
                  ) : (
                    <button
                      id={`apply-${job._id}`}
                      onClick={() => openApply(job)}
                      className="btn-primary w-full"
                    >
                      Apply
                      <Send size={13} strokeWidth={1.8} />
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="mt-4">
        <Pagination page={page} pages={pages} onChange={setPage} />
      </div>

      <Modal
        open={Boolean(applyJob)}
        onClose={() => setApplyJob(null)}
        title={applyJob ? `Apply to ${applyJob.title}` : ''}
        description={applyJob ? (applyJob.recruiter?.company || applyJob.company) : ''}
        footer={
          <>
            <button type="button" onClick={() => setApplyJob(null)} className="btn-secondary">Cancel</button>
            <button
              id="submit-apply-btn"
              type="submit"
              form="apply-form"
              disabled={applying}
              className="btn-primary"
            >
              {applying ? <><Loader2 size={14} className="animate-spin" /> Sending</> : 'Submit application'}
            </button>
          </>
        }
      >
        <form id="apply-form" onSubmit={handleApply} className="space-y-4">
          {applyError && <Alert tone="danger">{applyError}</Alert>}

          <Field label="Resume" hint="PDF, DOC or TXT, up to 5 MB. Screening runs against this file.">
            {resumeFile ? (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-line bg-ink-50">
                <FileText size={15} className="text-ink-500 flex-shrink-0" strokeWidth={1.7} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-ink-900 truncate">{resumeFile.name}</p>
                  <p className="num text-[11px] text-ink-500">{(resumeFile.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={() => setResumeFile(null)}
                  className="p-1 text-ink-400 hover:text-ink-800"
                  aria-label="Remove resume"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 px-3 py-3 rounded-lg border border-dashed border-ink-200 hover:border-ink-300 bg-white cursor-pointer transition-colors">
                <FileText size={15} className="text-ink-400" strokeWidth={1.7} />
                <span className="text-[13px] text-ink-600">Choose a resume file</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    if (f.size > 5 * 1024 * 1024) {
                      toast.error('That file is larger than 5 MB')
                      return
                    }
                    setResumeFile(f)
                  }}
                />
              </label>
            )}
          </Field>

          <Field label="Cover letter" hint="Optional, up to 2000 characters.">
            <textarea
              className="input"
              rows={5}
              placeholder="Why this role, and what you have shipped that is relevant."
              value={applyForm.coverLetter}
              onChange={e => setApplyForm({ coverLetter: e.target.value })}
              maxLength={2000}
            />
            <p className="num text-[11px] text-ink-400 text-right mt-1">
              {applyForm.coverLetter.length}/2000
            </p>
          </Field>
        </form>
      </Modal>
    </div>
  )
}
