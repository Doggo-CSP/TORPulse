import assert from 'node:assert/strict'
import test from 'node:test'

import { getApiAuthConfig } from './auth.config.js'

const authEnvironment = {
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:8000/auth/google/callback',
  SESSION_SECRET: 'a-session-secret-with-at-least-32-characters',
  FRONTEND_URL: 'http://localhost:3000',
}

test('API auth settings are validated only when requested', () => {
  const previous = Object.fromEntries(
    Object.keys(authEnvironment).map((key) => [key, process.env[key]]),
  )

  try {
    Object.assign(process.env, authEnvironment)
    const config = getApiAuthConfig()

    assert.equal(config.frontendUrl, authEnvironment.FRONTEND_URL)
    assert.equal(config.googleCallbackUrl, authEnvironment.GOOGLE_CALLBACK_URL)

    delete process.env.GOOGLE_CLIENT_ID
    assert.throws(() => getApiAuthConfig(), /GOOGLE_CLIENT_ID is required to start the API/)
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
})
