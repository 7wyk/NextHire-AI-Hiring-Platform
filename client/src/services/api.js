import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// ── Attach access token to every outgoing request ─────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Auto-refresh on 401 ───────────────────────────────────────────────────
let isRefreshing = false
let failedQueue  = []

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)))
  failedQueue = []
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

    if (
      err.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) =>
          failedQueue.push({ resolve, reject })
        )
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`
            return api(original)
          })
          .catch((e) => Promise.reject(e))
      }

      original._retry  = true
      isRefreshing     = true

      const { refreshToken, user, setAuth, logout } = useAuthStore.getState()

      if (!refreshToken) {
        logout()
        window.location.href = '/login'
        return Promise.reject(err)
      }

      try {
        // Use raw axios (not api) to avoid interceptor loop
        const { data } = await axios.post('/api/auth/refresh', { refreshToken })
        setAuth(user, data.accessToken, data.refreshToken)
        api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`
        processQueue(null, data.accessToken)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        logout()
        window.location.href = '/login'
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(err)
  }
)

export default api
