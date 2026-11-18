/**
 * cookies.js
 *
 * Session cookies for the browser client. Tokens now live in HttpOnly cookies
 * so XSS can no longer read them (SEC-04); the old Bearer flow still works for
 * API clients and tests, which keeps existing integrations functioning.
 */

const isProduction = () => process.env.NODE_ENV === 'production'

export const ACCESS_COOKIE = 'nh_access'
export const REFRESH_COOKIE = 'nh_refresh'
export const CSRF_COOKIE = 'nh_csrf'

const minutes = (value, fallbackMinutes) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallbackMinutes
}

export const accessCookieMaxAge = () =>
  minutes(process.env.ACCESS_TOKEN_MINUTES, 15) * 60 * 1000

export const refreshCookieMaxAge = () =>
  minutes(process.env.REFRESH_TOKEN_DAYS, 7) * 24 * 60 * 60 * 1000

/**
 * The frontend (Vercel) and API (Render) are different sites in production, so
 * the cookies must be `SameSite=None; Secure` for the browser to send them.
 * In development the Vite proxy makes them same-origin, where `Lax` is safer.
 */
export const baseCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: isProduction() ? 'none' : 'lax',
  path: '/',
})

export const setAuthCookies = (res, { accessToken, refreshToken, csrfToken }) => {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookieOptions(), maxAge: accessCookieMaxAge() })
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...baseCookieOptions(),
      maxAge: refreshCookieMaxAge(),
    })
  }
  // Readable by JS on purpose: the client must echo it back in a header.
  res.cookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure: isProduction(),
    sameSite: isProduction() ? 'none' : 'lax',
    path: '/',
    maxAge: refreshCookieMaxAge(),
  })
}

export const clearAuthCookies = (res) => {
  const opts = { ...baseCookieOptions(), maxAge: 0 }
  res.clearCookie(ACCESS_COOKIE, opts)
  res.clearCookie(REFRESH_COOKIE, opts)
  res.clearCookie(CSRF_COOKIE, { ...opts, httpOnly: false })
}

/** Minimal cookie header parser — avoids pulling in another dependency. */
export const parseCookies = (header) => {
  const out = {}
  if (!header || typeof header !== 'string') return out

  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const key = part.slice(0, idx).trim()
    if (!key) continue
    try {
      out[key] = decodeURIComponent(part.slice(idx + 1).trim())
    } catch {
      out[key] = part.slice(idx + 1).trim()
    }
  }
  return out
}

export const cookieParser = (req, _res, next) => {
  if (!req.cookies) req.cookies = parseCookies(req.headers.cookie)
  next()
}
