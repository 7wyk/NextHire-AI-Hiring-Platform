import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import api from '../../services/api'
import Logo from '../../components/Logo'
import { Alert, Field, Spinner } from '../../components/ui'

export default function ResetPasswordPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!password) return setError('Enter a new password.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')

    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
      setTimeout(() => navigate('/candidate/login'), 2500)
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. The link may have expired.')
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
          {done ? (
            <>
              <CheckCircle2 size={20} className="text-positive-600" strokeWidth={1.6} />
              <h1 className="text-[22px] leading-7 font-semibold text-ink-900 mt-3">
                Password updated
              </h1>
              <p className="text-[13.5px] text-ink-500 mt-1.5">
                Taking you to the sign-in screen.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-[22px] leading-7 font-semibold text-ink-900">Set a new password</h1>
              <p className="text-[13.5px] text-ink-500 mt-1.5">
                Choose a password with at least 8 characters.
              </p>

              <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                {error && <Alert tone="danger">{error}</Alert>}

                <Field label="New password" required>
                  <div className="relative">
                    <input
                      id="reset-password"
                      type={showPw ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="New password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-ink-400 hover:text-ink-700"
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                    >
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </Field>

                <Field label="Confirm password" required>
                  <input
                    id="reset-confirm"
                    type="password"
                    className="input"
                    placeholder="Repeat password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </Field>

                {password.length > 0 && password.length < 8 && (
                  <p className="text-xs text-warn-600">That password is too short.</p>
                )}

                <button id="reset-submit" type="submit" disabled={loading} className="btn-accent w-full">
                  {loading ? <><Spinner /> Updating</> : 'Update password'}
                </button>
              </form>

              <p className="text-[12.5px] text-ink-500 mt-6 pt-5 border-t border-line">
                <Link to="/candidate/login" className="link">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
