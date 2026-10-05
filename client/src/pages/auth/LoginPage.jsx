import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [form, setForm]       = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setAuth }           = useAuthStore()
  const navigate              = useNavigate()
  const [searchParams]        = useSearchParams()

  useEffect(() => {
    if (searchParams.get('verified') === '1') {
      toast.success('Email verified! You can now sign in.')
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)

      // ✅ FIX: backend returns `accessToken` + `refreshToken`, NOT `token`
      setAuth(data.user, data.accessToken, data.refreshToken)

      toast.success(`Welcome back, ${data.user.name}!`)

      // Role-based redirect
      const dest = data.user.role === 'candidate' ? '/public-jobs' : '/dashboard'
      navigate(dest, { replace: true })
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Check your credentials.'
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

        <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
        <p className="text-slate-400 text-sm mb-8">Sign in as a recruiter or candidate</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
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
                id="password"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                className="input pl-10 pr-10"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Forgot password */}
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs text-slate-500 hover:text-primary-400 transition-colors">
              Forgot password?
            </Link>
          </div>

          <button
            id="login-btn"
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
                Signing in…
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-6">
          No account?{' '}
          <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">
            Create one free
          </Link>
        </p>
      </div>
    </motion.div>
  )
}
