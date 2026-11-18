import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'
import toast from 'react-hot-toast'
import AuthShell from '../../components/AuthShell'
import { Alert, Field, Spinner } from '../../components/ui'

export default function CandidateSignup() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setError('')
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/candidate/register', {
        name: form.name,
        email: form.email,
        password: form.password,
      })
      setAuth(data.user, data.accessToken, data.refreshToken)
      toast.success('Candidate account created')
      navigate('/public-jobs', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create your account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      role="candidate"
      eyebrow="Candidate sign up"
      title="Create your candidate account"
      description="One account for applications, assessments and interviews."
      footer={
        <p className="text-[12.5px] text-ink-500">
          Already registered?{' '}
          <Link to="/candidate/login" className="link">Sign in</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Full name" required>
          <input
            id="candidate-signup-name"
            type="text"
            className="input"
            placeholder="Your name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            minLength={2}
            autoComplete="name"
          />
        </Field>

        <Field label="Email" required>
          <input
            id="candidate-signup-email"
            type="email"
            className="input"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            autoComplete="email"
          />
        </Field>

        <Field label="Password" hint="At least 8 characters." required>
          <div className="relative">
            <input
              id="candidate-signup-password"
              type={showPass ? 'text' : 'password'}
              className="input pr-10"
              placeholder="Create a password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
              autoComplete="new-password"
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

        <button
          id="candidate-signup-btn"
          type="submit"
          disabled={loading}
          className="btn-accent w-full"
        >
          {loading ? <><Spinner /> Creating account</> : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}
