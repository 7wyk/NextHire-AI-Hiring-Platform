import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Briefcase, Pencil, Trash2, ArrowRight,
} from 'lucide-react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  PageHeader, StatusPill, EmptyState, Modal, Field, LoadingBlock,
} from '../../components/ui'

const EMPTY_FORM = {
  title: '', company: '', location: 'Remote', type: 'full-time',
  description: '', requirements: '', skills: '', salaryMin: '', salaryMax: '', status: 'active',
}

const TYPE_LABEL = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  'contract': 'Contract',
  'internship': 'Internship',
}

export default function JobsPage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/jobs', { params })
      setJobs(data.jobs || [])
      setTotal(data.total || 0)
    } catch {
      toast.error('Could not load jobs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchJobs() }, [search, statusFilter])

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }

  const openEdit = (job) => {
    setEditing(job._id)
    setForm({
      ...job,
      salaryMin: job.salaryMin ?? '',
      salaryMax: job.salaryMax ?? '',
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
        setTotal(t => t + 1)
        toast.success('Job published')
      }
      setShowModal(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this job? Applications stay on the candidate records.')) return
    try {
      await api.delete(`/jobs/${id}`)
      setJobs(prev => prev.filter(j => j._id !== id))
      setTotal(t => Math.max(0, t - 1))
      toast.success('Job deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Jobs"
        description={loading ? 'Loading roles' : `${total} role${total === 1 ? '' : 's'} in this workspace`}
        actions={
          <button id="create-job-btn" onClick={openCreate} className="btn-primary btn-sm sm:h-9 sm:px-3.5">
            <Plus size={14} strokeWidth={1.9} />
            New job
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 pb-4">
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Search roles"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-8"
            aria-label="Search jobs"
          />
        </div>
        <select
          className="input w-auto min-w-[130px]"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <LoadingBlock label="Loading jobs" />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={search || statusFilter ? 'No roles match those filters' : 'No roles yet'}
            description={search || statusFilter
              ? 'Clear the filters or search for a different title.'
              : 'Publish your first role to start collecting applications.'}
            action={!search && !statusFilter && (
              <button onClick={openCreate} className="btn-primary btn-sm">
                <Plus size={14} /> Create job
              </button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Role</th>
                  <th className="th">Type</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Applicants</th>
                  <th className="th">Posted</th>
                  <th className="th w-[120px]"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job._id} className="hover:bg-ink-50/60 transition-colors">
                    <td className="td">
                      <button
                        onClick={() => navigate(`/jobs/${job._id}/applicants`)}
                        className="text-left group"
                      >
                        <span className="block text-[13.5px] text-ink-900 group-hover:text-accent-600">
                          {job.title}
                        </span>
                        <span className="block text-[12px] text-ink-500">
                          {job.company}
                          {job.location ? ` · ${job.location}` : ''}
                        </span>
                      </button>
                    </td>
                    <td className="td text-ink-600">{TYPE_LABEL[job.type] || job.type}</td>
                    <td className="td"><StatusPill status={job.status} /></td>
                    <td className="td text-right">
                      <button
                        id={`view-applicants-${job._id}`}
                        onClick={() => navigate(`/jobs/${job._id}/applicants`)}
                        className="num text-[13px] text-ink-900 hover:text-accent-600 inline-flex items-center gap-1.5"
                      >
                        {job.applicantCount || 0}
                        <ArrowRight size={12} className="text-ink-300" />
                      </button>
                    </td>
                    <td className="td num text-[12.5px] text-ink-500">
                      {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => openEdit(job)}
                          className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
                          title="Edit job"
                          aria-label={`Edit ${job.title}`}
                        >
                          <Pencil size={14} strokeWidth={1.7} />
                        </button>
                        <button
                          onClick={() => handleDelete(job._id)}
                          className="p-1.5 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger-50"
                          title="Delete job"
                          aria-label={`Delete ${job.title}`}
                        >
                          <Trash2 size={14} strokeWidth={1.7} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit job' : 'New job'}
        description={editing ? 'Changes apply to the public listing immediately.' : 'The description and skills guide every screening and test.'}
        width="max-w-2xl"
        footer={
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button
              id="save-job-btn"
              type="submit"
              form="job-form"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Saving' : editing ? 'Save changes' : 'Publish job'}
            </button>
          </>
        }
      >
        <form id="job-form" onSubmit={handleSave} className="space-y-4">
          <Field label="Job title" required>
            <input
              className="input"
              placeholder="Senior React Engineer"
              required
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company" required>
              <input
                className="input"
                placeholder="Company name"
                required
                value={form.company}
                onChange={e => setForm({ ...form, company: e.target.value })}
              />
            </Field>
            <Field label="Location">
              <input
                className="input"
                placeholder="Remote, or a city"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
              />
            </Field>
            <Field label="Employment type">
              <select
                className="input"
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
              >
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className="input"
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
            <Field label="Salary minimum (USD)">
              <input
                className="input num"
                type="number"
                placeholder="80000"
                value={form.salaryMin}
                onChange={e => setForm({ ...form, salaryMin: e.target.value })}
              />
            </Field>
            <Field label="Salary maximum (USD)">
              <input
                className="input num"
                type="number"
                placeholder="120000"
                value={form.salaryMax}
                onChange={e => setForm({ ...form, salaryMax: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Skills" hint="Comma separated. Used to match resumes and generate tests.">
            <input
              className="input"
              placeholder="React, TypeScript, Node.js"
              value={form.skills}
              onChange={e => setForm({ ...form, skills: e.target.value })}
            />
          </Field>

          <Field label="Description" required>
            <textarea
              className="input font-sans"
              rows={4}
              placeholder="What the role owns, who it reports to, what the team is building."
              required
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </Field>

          <Field label="Requirements" hint="One per line.">
            <textarea
              className="input font-mono text-[12.5px]"
              rows={4}
              placeholder={'3+ years with React\nTypeScript proficiency\nREST API experience'}
              value={form.requirements}
              onChange={e => setForm({ ...form, requirements: e.target.value })}
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}
