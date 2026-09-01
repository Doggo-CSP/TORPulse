export interface ApiAuthConfig {
  googleClientId: string
  googleClientSecret: string
  googleCallbackUrl: string
  sessionSecret: string
  frontendUrl: string
  isProduction: boolean
}

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
  }
}
