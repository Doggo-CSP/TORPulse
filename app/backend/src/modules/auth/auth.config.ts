export interface ApiAuthConfig {
  googleClientId: string
  googleClientSecret: string
  googleCallbackUrl: string
  sessionSecret: string
  frontendUrl: string
  isProduction: boolean
  // Login timeout. Optional so callers (tests) can omit them; the API falls back to the defaults.
  sessionIdleTimeoutMs?: number
  sessionAbsoluteTimeoutMs?: number
}

// Production uses the __Host- prefix (ASVS V3.3.1): the browser then only accepts the cookie when
// it is Secure, has Path=/ and no Domain, so a sibling subdomain cannot set or overwrite it.
// Plain-HTTP local development cannot use the prefix, so it keeps the bare name.
export const sessionCookieName = (isProduction: boolean): string =>
  isProduction ? '__Host-torpulse.sid' : 'torpulse.sid'

export const DEFAULT_SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000
export const DEFAULT_SESSION_ABSOLUTE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000

const required = (name: string): string => {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required to start the API`)
  }

  return value
}

const parseUrl = (name: string, value: string): string => {
  try {
    return new URL(value).origin + new URL(value).pathname.replace(/\/$/, '')
  } catch {
    throw new Error(`${name} must be a valid URL`)
  }
}

const positiveMs = (name: string, fallback: number): number => {
  const raw = process.env[name]?.trim()
  const value = raw ? Number(raw) : fallback

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number of milliseconds`)
  }

  return value
}

export const getApiAuthConfig = (): ApiAuthConfig => {
  const sessionSecret = required('SESSION_SECRET')

  if (sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters')
  }

  return {
    googleClientId: required('GOOGLE_CLIENT_ID'),
    googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
    googleCallbackUrl: parseUrl('GOOGLE_CALLBACK_URL', required('GOOGLE_CALLBACK_URL')),
    sessionSecret,
    frontendUrl: parseUrl('FRONTEND_URL', required('FRONTEND_URL')),
    isProduction: process.env.NODE_ENV === 'production',
    sessionIdleTimeoutMs: positiveMs('SESSION_IDLE_TIMEOUT_MS', DEFAULT_SESSION_IDLE_TIMEOUT_MS),
    sessionAbsoluteTimeoutMs: positiveMs(
      'SESSION_ABSOLUTE_TIMEOUT_MS',
      DEFAULT_SESSION_ABSOLUTE_TIMEOUT_MS,
    ),
  }
}
