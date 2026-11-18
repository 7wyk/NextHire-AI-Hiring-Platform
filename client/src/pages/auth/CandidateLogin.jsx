import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
import toast from 'react-hot-toast'
import AuthShell from '../../components/AuthShell'
import { Alert, Field, Spinner } from '../../components/ui'

export default function CandidateLogin() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (searchParams.get('verified') === '1') {
      toast.success('Email verified. You can sign in now.')
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/candidate/login', {
        email: form.email,
        password: form.password,
      })
      setAuth(data.user, data.accessToken, data.refreshToken)
      toast.success(`Signed in as ${data.user.name}`)
      navigate('/public-jobs', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Sign in failed. Check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      role="candidate"
      eyebrow="Candidate sign in"
      title="Sign in to your account"
      description="Track applications, coding tests and interviews in one place."
      footer={
        <p className="text-[12.5px] text-ink-500">
          New to Nexthire?{' '}
          <Link to="/candidate/signup" className="link">Create a candidate account</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Email" required>
          <input
            id="candidate-login-email"
            type="email"
            className="input"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            autoComplete="email"
          />
        </Field>

        <Field label="Password" required>
          <div className="relative">
            <input
              id="candidate-login-password"
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
          id="candidate-login-btn"
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
