import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import api from '../../services/api'

export default function ForgotPasswordPage() {
  const [email,     setEmail]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [sent,      setSent]      = useState(false)
  const [error,     setError]     = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email) return setError('Email is required')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-surface-800 border border-white/[0.07] rounded-2xl p-8 shadow-2xl">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Check your console</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                A reset link has been generated. In dev mode it is printed to the<br />
                server console. Check your terminal.
              </p>
              <Link to="/login"
                className="mt-6 inline-flex items-center gap-2 text-primary-400 hover:text-primary-300 text-sm transition-colors">
                <ArrowLeft size={14} /> Back to login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="w-11 h-11 rounded-xl bg-primary-500/10 flex items-center justify-center mb-4">
                  <Mail className="w-5 h-5 text-primary-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Forgot password?</h2>
                <p className="text-slate-400 text-sm mt-1">Enter your email and we'll send a reset link.</p>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Email address</label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-surface-700 border border-white/[0.07]
                      text-white placeholder-slate-500 text-sm focus:outline-none
                      focus:border-primary-500/40 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  id="forgot-submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-accent-600
                    text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50
                    flex items-center justify-center gap-2 transition-all"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>

              <p className="text-center text-slate-500 text-sm mt-6">
                Remember your password?{' '}
                <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
