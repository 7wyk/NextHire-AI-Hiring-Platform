import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import Logo from '../../components/Logo'
import { Alert, Field, Spinner } from '../../components/ui'
import { CheckCircle2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email) return setError('Enter the email address on your account.')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="px-5 h-14 flex items-center">
        <Logo to="/" />
      </div>

      <div className="flex-1 flex items-start sm:items-center justify-center px-5 pb-16">
        <div className="w-full max-w-[368px] animate-rise-in">
          {sent ? (
            <>
              <CheckCircle2 size={20} className="text-positive-600" strokeWidth={1.6} />
              <h1 className="text-[22px] leading-7 font-semibold text-ink-900 mt-3">
                Reset link generated
              </h1>
              <p className="text-[13.5px] text-ink-500 mt-1.5 leading-6">
                If an account exists for {email}, a reset link has been created. In development the
                link is printed to the server console.
              </p>
              <Link to="/candidate/login" className="btn-secondary mt-6">
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-[22px] leading-7 font-semibold text-ink-900">Reset your password</h1>
              <p className="text-[13.5px] text-ink-500 mt-1.5">
                Enter your email and we will generate a reset link.
              </p>

              <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                {error && <Alert tone="danger">{error}</Alert>}
                <Field label="Email" required>
                  <input
                    id="forgot-email"
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </Field>
                <button id="forgot-submit" type="submit" disabled={loading} className="btn-accent w-full">
                  {loading ? <><Spinner /> Sending</> : 'Send reset link'}
                </button>
              </form>

              <p className="text-[12.5px] text-ink-500 mt-6 pt-5 border-t border-line">
                Remembered it?{' '}
                <Link to="/candidate/login" className="link">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
