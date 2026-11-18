import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
import toast from 'react-hot-toast'
import AuthShell from '../../components/AuthShell'
import { Alert, Field, Spinner } from '../../components/ui'

export default function RecruiterLogin() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const verified = searchParams.get('verified') === '1'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/recruiter/login', {
        email: form.email,
        password: form.password,
      })
      setAuth(data.user, data.accessToken, data.refreshToken)
      toast.success(`Signed in as ${data.user.name}`)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Sign in failed. Check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      role="recruiter"
      eyebrow="Recruiter sign in"
      title="Sign in to your workspace"
      description="Jobs, candidates, assessments and rankings for your team."
      footer={
        <p className="text-[12.5px] text-ink-500">
          No workspace yet?{' '}
          <Link to="/recruiter/signup" className="link">Create a recruiter account</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {verified && !error && (
          <Alert tone="positive">Email verified. You can sign in now.</Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Work email" required>
          <input
            id="recruiter-login-email"
            type="email"
            className="input"
            placeholder="you@company.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            autoComplete="email"
          />
        </Field>

        <Field label="Password" required>
          <div className="relative">
            <input
              id="recruiter-login-password"
              type={showPass ? 'text' : 'password'}
              className="input pr-10"
              placeholder="Your password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-ink-400 hover:text-ink-700"
              aria-label={showPass ? 'Hide password' : 'Show password'}
            >
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>

        <div className="flex justify-end -mt-1">
          <Link to="/forgot-password" className="text-[12.5px] text-ink-500 hover:text-ink-800">
            Forgot password?
          </Link>
        </div>

        <button
          id="recruiter-login-btn"
          type="submit"
          disabled={loading}
          className="btn-accent w-full"
        >
          {loading ? <><Spinner /> Signing in</> : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  )
}
