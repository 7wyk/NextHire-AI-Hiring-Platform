import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, User, Mail, Lock } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'recruiter', // default — admin removed (blocked by backend)
  })
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
      const { data } = await api.post('/auth/register', form)

      // ✅ FIX: backend returns `accessToken` + `refreshToken`, NOT `token`
      setAuth(data.user, data.accessToken, data.refreshToken)

      toast.success('Account created! Welcome to NextHire AI 🚀')
      const dest = data.user.role === 'candidate' ? '/public-jobs' : '/dashboard'
      navigate(dest, { replace: true })
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <div className="card-glow p-8">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-white">
            NextHire <span className="glow-text">AI</span>
          </span>
        </div>

        <h2 className="text-2xl font-bold text-white mb-1">Create your account</h2>
        <p className="text-slate-400 text-sm mb-8">Join as a recruiter or candidate — free forever</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input
                id="name"
                type="text"
                placeholder="Jane Recruiter"
                className="input pl-10"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={2}
                autoComplete="name"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input
                id="reg-email"
                type="email"
                placeholder="you@company.com"
                className="input pl-10"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input
                id="reg-password"
                type="password"
                placeholder="Min. 8 characters"
                className="input pl-10"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Role — admin removed, backend blocks self-registration as admin */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">I am a…</label>
            <select
              id="role"
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="recruiter">Recruiter</option>
              <option value="candidate">Candidate</option>
            </select>
          </div>

          <button
            id="register-btn"
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center py-3 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Creating account…
              </span>
            ) : 'Create Free Account'}
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </motion.div>
  )
}
