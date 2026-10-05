import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Briefcase, MapPin, Clock, Users,
  Pencil, Trash2, X, ChevronDown, ArrowRight
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'

const typeColors = {
  'full-time':   'badge-primary',
  'part-time':   'badge-warning',
  'contract':    'badge-success',
  'internship':  'badge',
}

const statusColors = {
  active: 'badge-success',
  draft:  'badge-warning',
  closed: 'badge-danger',
}

const EMPTY_FORM = {
  title: '', company: '', location: 'Remote', type: 'full-time',
  description: '', requirements: '', skills: '', salaryMin: '', salaryMax: '', status: 'active'
}

export default function JobsPage() {
  const navigate = useNavigate()
  const [jobs, setJobs]       = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)
  const [search, setSearch]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/jobs', { params })
      setJobs(data.jobs)
      setTotal(data.total)
    } catch {
      toast.error('Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchJobs() }, [search, statusFilter])

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit   = (job) => {
    setEditing(job._id)
    setForm({
      ...job,
      requirements: job.requirements?.join('\n') || '',
      skills: job.skills?.join(', ') || '',
    })
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        requirements: form.requirements.split('\n').map(s => s.trim()).filter(Boolean),
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        salaryMin: Number(form.salaryMin) || undefined,
        salaryMax: Number(form.salaryMax) || undefined,
      }
      if (editing) {
        const { data } = await api.put(`/jobs/${editing}`, payload)
        setJobs(prev => prev.map(j => j._id === editing ? data.job : j))
        toast.success('Job updated')
      } else {
        const { data } = await api.post('/jobs', payload)
        setJobs(prev => [data.job, ...prev])
        toast.success('Job created!')
      }
      setShowModal(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this job?')) return
    try {
      await api.delete(`/jobs/${id}`)
      setJobs(prev => prev.filter(j => j._id !== id))
      toast.success('Job deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-slate-400 text-sm">{total} job{total !== 1 ? 's' : ''} found</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input
              type="text" placeholder="Search jobs…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9 w-52"
            />
          </div>
          {/* Status filter */}
          <div className="relative">
            <select
              className="input pr-9 appearance-none cursor-pointer"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="closed">Closed</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
          </div>
          <button id="create-job-btn" onClick={openCreate} className="btn-primary">
            <Plus size={16} /> New Job
          </button>
        </div>
      </div>

      {/* Job Cards */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-48 animate-pulse bg-surface-700" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="card text-center py-16">
          <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No jobs yet. Create your first job posting!</p>
          <button onClick={openCreate} className="btn-primary mt-4 mx-auto">
            <Plus size={16} /> Create Job
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job, i) => (
            <motion.div
              key={job._id}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary-500/15 border border-primary-500/20 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-primary-400" />
                </div>
                <div className="flex gap-1.5">
                  <span className={`${statusColors[job.status]} badge capitalize`}>{job.status}</span>
                </div>
              </div>

              <h3 className="font-semibold text-white mb-1 line-clamp-1">{job.title}</h3>
              <p className="text-slate-400 text-sm mb-3">{job.company}</p>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`${typeColors[job.type]} badge capitalize`}>{job.type}</span>
                {job.salaryMin && (
                  <span className="badge bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                    ${job.salaryMin.toLocaleString()}+
                  </span>
                )}
              </div>

              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <MapPin size={12} /> {job.location}
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <Users size={12} /> {job.applicantCount} applicant{job.applicantCount !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <Clock size={12} /> {new Date(job.createdAt).toLocaleDateString()}
                </div>
              </div>

              {job.skills?.slice(0, 3).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {job.skills.slice(0, 3).map(s => (
                    <span key={s} className="badge bg-surface-600 text-slate-300 border-white/10 text-xs">{s}</span>
                  ))}
                  {job.skills.length > 3 && <span className="text-slate-500 text-xs">+{job.skills.length - 3}</span>}
                </div>
              )}

              {/* View Applicants — always visible */}
              <button
                id={`view-applicants-${job._id}`}
                onClick={() => navigate(`/jobs/${job._id}/applicants`)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl
                  bg-primary-500/10 border border-primary-500/20 text-primary-300
                  hover:bg-primary-500/20 transition-all text-xs font-medium mt-3"
              >
                <span className="flex items-center gap-1.5">
                  <Users size={13} />
                  View Applicants
                  {job.applicantCount > 0 && (
                    <span className="bg-primary-500/30 text-primary-200 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                      {job.applicantCount}
                    </span>
                  )}
                </span>
                <ArrowRight size={13} />
              </button>

              {/* Edit / Delete — hover only */}
              <div className="flex gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(job)}
                  className="btn-ghost text-xs gap-1.5 flex-1 justify-center"
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(job._id)}
                  className="btn-ghost text-xs gap-1.5 flex-1 justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-800 border border-white/[0.1] rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">
                  {editing ? 'Edit Job' : 'Create New Job'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm text-slate-300 mb-1">Job Title *</label>
                    <input className="input" placeholder="e.g. Senior React Engineer" required
                      value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Company *</label>
                    <input className="input" placeholder="Company name" required
                      value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Location</label>
                    <input className="input" placeholder="Remote / City"
                      value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Type</label>
                    <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                      <option value="full-time">Full-time</option>
                      <option value="part-time">Part-time</option>
                      <option value="contract">Contract</option>
                      <option value="internship">Internship</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Status</label>
                    <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="draft">Draft</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Min Salary ($)</label>
                    <input className="input" type="number" placeholder="e.g. 80000"
                      value={form.salaryMin} onChange={e => setForm({ ...form, salaryMin: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Max Salary ($)</label>
                    <input className="input" type="number" placeholder="e.g. 120000"
                      value={form.salaryMax} onChange={e => setForm({ ...form, salaryMax: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-slate-300 mb-1">Skills (comma separated)</label>
                    <input className="input" placeholder="React, TypeScript, Node.js"
                      value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-slate-300 mb-1">Description *</label>
                    <textarea className="input resize-none" rows={3} placeholder="Job description…" required
                      value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-slate-300 mb-1">Requirements (one per line)</label>
                    <textarea className="input resize-none font-mono text-xs" rows={4}
                      placeholder="3+ years React experience&#10;TypeScript proficiency&#10;REST API experience"
                      value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value })} />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">
                    Cancel
                  </button>
                  <button id="save-job-btn" type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                    {saving ? 'Saving…' : editing ? 'Update Job' : 'Create Job'}
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
