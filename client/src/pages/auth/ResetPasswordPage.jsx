import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, CheckCircle2, Loader2 } from 'lucide-react'
import api from '../../services/api'

export default function ResetPasswordPage() {
  const { token }            = useParams()
  const navigate             = useNavigate()
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!password)              return setError('Password is required')
    if (password.length < 8)    return setError('Password must be at least 8 characters')
    if (password !== confirm)   return setError('Passwords do not match')

    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. Link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-surface-800 border border-white/[0.07] rounded-2xl p-8 shadow-2xl">
          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Password reset!</h2>
              <p className="text-slate-400 text-sm">Redirecting to login...</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="w-11 h-11 rounded-xl bg-primary-500/10 flex items-center justify-center mb-4">
                  <Lock className="w-5 h-5 text-primary-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Set new password</h2>
                <p className="text-slate-400 text-sm mt-1">Choose a strong password for your account.</p>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">New password</label>
                  <div className="relative">
                    <input
                      id="reset-password"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full px-4 py-3 pr-10 rounded-xl bg-surface-700 border border-white/[0.07]
                        text-white placeholder-slate-500 text-sm focus:outline-none
                        focus:border-primary-500/40 transition-all"
                    />
                    <button type="button" onClick={() => setShowPw(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Confirm password</label>
                  <input
                    id="reset-confirm"
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full px-4 py-3 rounded-xl bg-surface-700 border border-white/[0.07]
                      text-white placeholder-slate-500 text-sm focus:outline-none
                      focus:border-primary-500/40 transition-all"
                  />
                </div>

                {/* Strength bar */}
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[8, 12, 16].map((len, i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300
                        ${password.length >= len ? (i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-primary-500' : 'bg-emerald-500') : 'bg-surface-700'}`} />
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {password.length === 0 ? '' :
                     password.length < 8  ? 'Too short' :
                     password.length < 12 ? 'Fair' :
                     password.length < 16 ? 'Good' : 'Strong 💪'}
                  </p>
                </div>

                <button
                  type="submit"
                  id="reset-submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-accent-600
                    text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50
                    flex items-center justify-center gap-2 transition-all"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                  {loading ? 'Resetting...' : 'Reset password'}
                </button>
              </form>

              <p className="text-center text-slate-500 text-sm mt-6">
                <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
                  Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
