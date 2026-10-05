import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, User, Mail, Lock, Building2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
import toast from 'react-hot-toast'

export default function RecruiterSignup() {
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '' })
  const [loading, setLoading] = useState(false)
  const { setAuth }           = useAuthStore()
  const navigate              = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/recruiter/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        company: form.company,
      })
      setAuth(data.user, data.accessToken, data.refreshToken)
      toast.success('Account created! Welcome to NextHire AI 🚀')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
      <div className="card-glow p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-white">
            NextHire <span className="glow-text">AI</span>
          </span>
        </div>

        <h2 className="text-2xl font-bold text-white mb-1">Create Recruiter Account</h2>
        <p className="text-slate-400 text-sm mb-8">Post jobs, screen resumes, and hire with AI</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input id="recruiter-signup-name" type="text" placeholder="Jane Smith"
                className="input pl-10" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required minLength={2} autoComplete="name" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Company</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input id="recruiter-signup-company" type="text" placeholder="Acme Corp"
                className="input pl-10" value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                autoComplete="organization" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input id="recruiter-signup-email" type="email" placeholder="you@company.com"
                className="input pl-10" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required autoComplete="email" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input id="recruiter-signup-password" type="password" placeholder="Min. 8 characters"
                className="input pl-10" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required minLength={8} autoComplete="new-password" />
            </div>
          </div>

          <button id="recruiter-signup-btn" type="submit" disabled={loading}
            className="btn-primary w-full justify-center py-3 mt-2 disabled:opacity-60">
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Creating account…
              </span>
            ) : 'Create Recruiter Account'}
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/recruiter/login" className="text-primary-400 hover:text-primary-300 font-medium">
            Sign in
          </Link>
        </p>
        <p className="text-center text-slate-500 text-xs mt-3">
          Are you a candidate?{' '}
          <Link to="/candidate/signup" className="text-slate-400 hover:text-primary-400 transition-colors">
            Sign up here
          </Link>
        </p>
      </div>
    </motion.div>
  )
}
