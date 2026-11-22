import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import session from 'express-session'
import passport from 'passport'
import request from 'supertest'
import { Types } from 'mongoose'

import { createApiApp } from '../../apps/api/app.js'
import type { ApiAuthConfig } from './auth.config.js'
import { createAuthRouter } from './auth.routes.js'
import type { GoogleIdTokenClaims } from './oidc.js'
import { createPassport } from './passport.js'
import { User } from './user.model.js'

const config: ApiAuthConfig = {
  googleClientId: 'test-client',
  googleClientSecret: 'test-secret',
  googleCallbackUrl: 'http://localhost:8000/auth/google/callback',
  sessionSecret: 'test-session-secret-that-is-long-enough',
  frontendUrl: 'http://localhost:3000',
  isProduction: false,
}

test('GET /auth/me returns 401 for a guest and allows only the configured frontend origin', async () => {
  const app = createApiApp(config, {
    sessionStore: new session.MemoryStore(),
    authPassport: new passport.Passport(),
  })

  const allowed = await request(app).get('/auth/me').set('Origin', config.frontendUrl)

  assert.equal(allowed.status, 401)
  assert.deepEqual(allowed.body, { user: null })
  assert.equal(allowed.headers['access-control-allow-origin'], config.frontendUrl)
  assert.equal(allowed.headers['access-control-allow-credentials'], 'true')

  const otherOrigin = await request(app).get('/auth/me').set('Origin', 'https://example.com')
  assert.equal(otherOrigin.headers['access-control-allow-origin'], undefined)
})

test('GET /auth/me exposes only the public authenticated-user fields', async () => {
  const app = express()
  const fakePassport = {
    authenticate:
      () => (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
        next(),
  } as unknown as passport.Authenticator

  app.use((req, _res, next) => {
    req.user = {
      _id: new Types.ObjectId('64b000000000000000000001'),
      googleId: 'private-google-id',
      name: 'Test User',
      email: 'test@example.com',
      image: null,
    }
    next()
  })
  app.use('/auth', createAuthRouter(fakePassport, config))

  const response = await request(app).get('/auth/me')

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    user: {
      id: '64b000000000000000000001',
      name: 'Test User',
      email: 'test@example.com',
      image: null,
      role: 'user',
      status: 'active',
      scopes: [
        'profile:read',
        'profile:write',
        'bookmarks:read',
        'bookmarks:write',
        'qualification:read',
        'qualification:run',
      ],
    },
  })
})

test('POST /auth/logout clears the named session cookie', async () => {
  const app = createApiApp(config, {
    sessionStore: new session.MemoryStore(),
    authPassport: new passport.Passport(),
  })

  const response = await request(app).post('/auth/logout')

  assert.equal(response.status, 204)
  assert.match(response.headers['set-cookie']?.[0] ?? '', /^torpulse\.sid=;/)
  assert.match(response.headers['set-cookie']?.[0] ?? '', /HttpOnly/)
  assert.match(response.headers['set-cookie']?.[0] ?? '', /SameSite=Lax/)
  assert.equal(response.headers['clear-site-data'], '"cache", "storage"')
})

test('production uses a Secure __Host- session cookie', async () => {
  const app = createApiApp(
    { ...config, isProduction: true },
    {
      sessionStore: new session.MemoryStore(),
      authPassport: new passport.Passport(),
      mailer: { send: async () => {} },
    },
  )

  const response = await request(app).post('/auth/logout')
  const cookie = response.headers['set-cookie']?.[0] ?? ''

  assert.equal(response.status, 204)
  assert.match(cookie, /^__Host-torpulse\.sid=;/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /Path=\//)
  assert.doesNotMatch(cookie, /Domain=/)
})

const deserialize = (authPassport: passport.Authenticator, id: string) =>
  new Promise<unknown>((resolve, reject) => {
    authPassport.deserializeUser(id, (error: unknown, user?: unknown) => {
      if (error) {
        reject(error)
        return
      }
      resolve(user)
    })
  })

test('deserializeUser treats a suspended account as logged out', async (t) => {
  const authPassport = createPassport(config)
  t.mock.method(User, 'findById', async () => ({
    _id: new Types.ObjectId('64b000000000000000000002'),
    status: 'suspended',
  }))

  const user = await deserialize(authPassport, '64b000000000000000000002')

  assert.equal(user, false)
})

test('deserializeUser keeps an active account logged in', async (t) => {
  const authPassport = createPassport(config)
  const stored = { _id: new Types.ObjectId('64b000000000000000000003'), status: 'active' }
  t.mock.method(User, 'findById', async () => stored)

  const user = await deserialize(authPassport, '64b000000000000000000003')

  assert.equal(user, stored)
})

type GoogleVerify = (
  req: unknown,
  accessToken: string,
  refreshToken: string,
  params: { id_token?: string },
  profile: unknown,
  done: (error: unknown, user?: unknown, info?: unknown) => void,
) => void

const NONCE = 'test-nonce'

const fakeVerifier = (claims: Record<string, unknown>) => async (): Promise<GoogleIdTokenClaims> =>
  ({ sub: 'google-1', email_verified: true, nonce: NONCE, ...claims }) as GoogleIdTokenClaims

const runGoogleVerify = (
  authPassport: passport.Authenticator,
  profile: { id: string } & Record<string, unknown>,
  session: Record<string, unknown> = { oidcNonce: NONCE },
  user?: unknown,
) =>
  new Promise<{ user: unknown; info: unknown }>((resolve, reject) => {
    const strategy = (
      authPassport as unknown as { _strategy(name: string): { _verify: GoogleVerify } }
    )._strategy('google')
    strategy._verify(
      { session, user },
      'access',
      'refresh',
      { id_token: 'signed.jwt.token' },
      profile,
      (error, verifiedUser, info) =>
        error ? reject(error) : resolve({ user: verifiedUser, info }),
    )
  })

test('Google login creates new accounts as active users', async (t) => {
  const authPassport = createPassport(config, { verifyIdToken: fakeVerifier({ sub: 'google-1' }) })
  const stored = { _id: new Types.ObjectId(), status: 'active' }
  let capturedUpdate: Record<string, Record<string, unknown>> | undefined

  t.mock.method(User, 'findOneAndUpdate', async (_filter: unknown, update: unknown) => {
    capturedUpdate = update as Record<string, Record<string, unknown>>
    return stored
  })

  const { user } = await runGoogleVerify(authPassport, {
    id: 'google-1',
    displayName: 'Officer',
    emails: [{ value: 'Officer@DGA.go.th', verified: true }],
  })

  assert.equal(user, stored)
  assert.deepEqual(capturedUpdate?.$setOnInsert, {
    googleId: 'google-1',
    role: 'user',
    status: 'active',
  })
  assert.equal(capturedUpdate?.$set?.email, 'officer@dga.go.th')
})

test('Google login rejects a suspended account', async (t) => {
  const authPassport = createPassport(config, { verifyIdToken: fakeVerifier({ sub: 'google-2' }) })

  t.mock.method(User, 'findOneAndUpdate', async () => ({
    _id: new Types.ObjectId(),
    status: 'suspended',
  }))

  const { user, info } = await runGoogleVerify(authPassport, {
    id: 'google-2',
    displayName: 'Suspended',
    emails: [{ value: 'suspended@example.com', verified: true }],
  })

  assert.equal(user, false)
  assert.equal((info as { reason: string }).reason, 'suspended')
})

test('ID token is refused on a nonce mismatch, an unverified email, or another subject', async () => {
  const profile = { id: 'google-1', emails: [{ value: 'a@example.com' }] }
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ nonce: 'someone-else' }, 'nonce_mismatch'],
    [{ email_verified: false }, 'email_not_verified'],
    [{ sub: 'google-999' }, 'subject_mismatch'],
  ]

  for (const [claims, reason] of cases) {
    const authPassport = createPassport(config, { verifyIdToken: fakeVerifier(claims) })
    const { user, info } = await runGoogleVerify(authPassport, profile)
    assert.equal(user, false, reason)
    assert.equal((info as { reason: string }).reason, reason)
  }
})

test('ID token whose signature check fails is refused', async () => {
  const authPassport = createPassport(config, {
    verifyIdToken: async () => {
      throw new Error('signature verification failed')
    },
  })

  const { user, info } = await runGoogleVerify(authPassport, { id: 'google-1' })

  assert.equal(user, false)
  assert.match((info as { reason: string }).reason, /^id_token_invalid/)
})

test('re-authentication needs an auth_time after the flow started, for the same account', async () => {
  const startedAt = Date.now()
  const current = { _id: new Types.ObjectId(), googleId: 'google-1' }
  const reauthSession = () => ({
    oidcNonce: NONCE,
    oauthMode: 'reauth',
    reauth: { startedAt, returnTo: '/admin' },
  })
  const profile = { id: 'google-1' }

  const stale = createPassport(config, {
    verifyIdToken: fakeVerifier({ auth_time: Math.floor(startedAt / 1000) - 3600 }),
  })
  const staleResult = await runGoogleVerify(stale, profile, reauthSession(), current)
  assert.equal(staleResult.user, false)
  assert.equal((staleResult.info as { reason: string }).reason, 'reauth_not_fresh')

  const fresh = createPassport(config, {
    verifyIdToken: fakeVerifier({ auth_time: Math.floor(startedAt / 1000) + 5 }),
  })
  const freshResult = await runGoogleVerify(fresh, profile, reauthSession(), current)
  assert.equal(freshResult.user, current)

  const other = createPassport(config, {
    verifyIdToken: fakeVerifier({ sub: 'google-2', auth_time: Math.floor(startedAt / 1000) + 5 }),
  })
  const otherResult = await runGoogleVerify(other, { id: 'google-2' }, reauthSession(), current)
  assert.equal(otherResult.user, false)
  assert.equal((otherResult.info as { reason: string }).reason, 'reauth_different_account')
})
