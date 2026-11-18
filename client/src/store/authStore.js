import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Auth store.
 *
 * Only the user profile is persisted — never the tokens. Access and refresh
 * tokens live in HttpOnly cookies set by the API, so an XSS payload cannot read
 * them (SEC-04). `setAuth` keeps its old signature so existing call sites that
 * still pass `(user, accessToken, refreshToken)` continue to work; the extra
 * arguments are deliberately ignored.
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,

      setAuth: (user) => set({ user }),

      logout: () => set({ user: null }),
    }),
    {
      name: 'nexthire-auth',
      // Migration safety: older builds stored tokens here. Keep the user and
      // drop everything else on the next write.
      partialize: (state) => ({ user: state.user }),
    }
  )
)
