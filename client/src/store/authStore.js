
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Auth store — persisted in localStorage under 'nexthire-auth'.
 *
 * Fields:
 *   user         – { id, name, email, role, company }
 *   token        – short-lived JWT access token (15 min)
 *   refreshToken – long-lived refresh token (7 days)
 *
 * Setters:
 *   setAuth(user, token, refreshToken) – called after login / register / refresh
 *   logout()                           – clears everything
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      user:         null,
      token:        null,
      refreshToken: null,

      setAuth: (user, token, refreshToken = null) =>
        set({ user, token, refreshToken }),

      logout: () =>
        set({ user: null, token: null, refreshToken: null }),
    }),
    { name: 'nexthire-auth' }
  )
)
