/**
 * port.js
 *
 * Resolves the HTTP port from the environment.
 *
 * `PORT=0` is truthy, so the previous `process.env.PORT || 5000` bound an
 * ephemeral port and the Vite `/api` proxy (fixed at 5000) could not reach the
 * API. Anything that is not a usable TCP port now falls back to 5000, while a
 * valid value from the environment (deployment) is still honoured.
 */

export const DEFAULT_PORT = 5000

export const resolvePort = (value, fallback = DEFAULT_PORT) => {
  const text = typeof value === 'number' ? String(value) : String(value ?? '').trim()
  if (!/^\d+$/.test(text)) return fallback

  const port = Number.parseInt(text, 10)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return fallback
  return port
}
