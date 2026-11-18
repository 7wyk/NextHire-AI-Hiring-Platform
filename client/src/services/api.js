import axios from 'axios'
import { useAuthStore } from '../store/authStore'

/**
 * API client.
 *
 * Authentication lives in HttpOnly cookies set by the API (SEC-04), so no
 * token is stored in JavaScript or localStorage any more. `withCredentials`
 * makes the browser send those cookies; a readable `nh_csrf` cookie is echoed
 * back in `X-CSRF-Token` on mutations (double-submit CSRF protection).
 *
 * VITE_API_URL points at the deployed API in production; the Vite proxy and
 * Vercel rewrite both make `/api` work when it is unset.
 */
const baseURL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

const readCookie = (name) => {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

const MUTATING = new Set(['post', 'put', 'patch', 'delete'])

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase()
  if (MUTATING.has(method)) {
    const csrf = readCookie('nh_csrf')
    if (csrf) config.headers['X-CSRF-Token'] = csrf
  }
  return config
})

// ── Auto-refresh on 401 ───────────────────────────────────────────────────
// The refresh token is an HttpOnly cookie, so this call carries no body.
let isRefreshing = false
let failedQueue  = []

const processQueue = (error) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()))
  failedQueue = []
}

const clearSession = () => {
  useAuthStore.getState().logout()
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
  }
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

    if (
      err.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
          .then(() => api(original))
          .catch((e) => Promise.reject(e))
      }

      original._retry = true
      isRefreshing = true

      try {
        await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
        processQueue(null)
        return api(original)
      } catch (refreshErr) {
        processQueue(refreshErr)
        clearSession()
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(err)
  }
)

export default api
