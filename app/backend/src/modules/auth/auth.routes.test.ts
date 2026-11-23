import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import session from 'express-session'
import passport from 'passport'
import request from 'supertest'
import { Types } from 'mongoose'

import { createApiApp } from '../../apps/api/app.js'
import type { ApiAuthConfig } from './auth.config.js'
import { createAuthRouter, safeReturnTo } from './auth.routes.js'
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
  accessToken: string,
  refreshToken: string,
  profile: unknown,
  done: (error: unknown, user?: unknown) => void,
) => void

const runGoogleVerify = (authPassport: passport.Authenticator, profile: unknown) =>
  new Promise<unknown>((resolve, reject) => {
    const strategy = (
      authPassport as unknown as { _strategy(name: string): { _verify: GoogleVerify } }
    )._strategy('google')
    strategy._verify('access', 'refresh', profile, (error, user) =>
      error ? reject(error) : resolve(user),
    )
  })

test('Google login creates new accounts as active users', async (t) => {
  const authPassport = createPassport(config)
  const stored = { _id: new Types.ObjectId(), status: 'active' }
  let capturedUpdate: Record<string, Record<string, unknown>> | undefined

  t.mock.method(User, 'findOneAndUpdate', async (_filter: unknown, update: unknown) => {
    capturedUpdate = update as Record<string, Record<string, unknown>>
    return stored
  })

  const user = await runGoogleVerify(authPassport, {
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
  const authPassport = createPassport(config)

  t.mock.method(User, 'findOneAndUpdate', async () => ({
    _id: new Types.ObjectId(),
    status: 'suspended',
  }))

  const user = await runGoogleVerify(authPassport, {
    id: 'google-2',
    displayName: 'Suspended',
    emails: [{ value: 'suspended@example.com', verified: true }],
  })

  assert.equal(user, false)
})

test('safeReturnTo keeps paths on this site and rejects anything that could leave it', () => {
  assert.equal(safeReturnTo('/tor/6adf12a387f73f72d242088a'), '/tor/6adf12a387f73f72d242088a')
  assert.equal(safeReturnTo('/homepage?tour=1'), '/homepage?tour=1')
  for (const unsafe of [
    undefined,
    '',
    'tor/abc',
    '//evil.example.com',
    '/\\evil.example.com',
    'https://evil.example.com',
    '/tor/abc\r\nSet-Cookie: x=1',
    `/${'a'.repeat(600)}`,
    ['/tor/abc'],
  ]) {
    assert.equal(safeReturnTo(unsafe), null, `should reject ${JSON.stringify(unsafe)}`)
  }
})

// Stands in for the Google strategy: no code -> redirect to Google, code=ok -> success,
// anything else -> failure
const createFakeGooglePassport = () => {
  const authPassport = new passport.Passport()
  authPassport.use('google', {
    name: 'google',
    authenticate(
      this: { success(u: unknown): void; fail(): void; redirect(url: string): void },
      req: express.Request,
    ) {
      if (req.query.code === 'ok') this.success({ id: 'user-1' })
      else if (req.query.code) this.fail()
      else this.redirect('https://accounts.google.com/o/oauth2/v2/auth')
    },
  } as unknown as passport.Strategy)
  authPassport.serializeUser((user, done) => done(null, (user as unknown as { id: string }).id))
  authPassport.deserializeUser((id, done) => done(null, { id } as unknown as Express.User))
  return authPassport
}

const createLoginApp = () => {
  const authPassport = createFakeGooglePassport()
  const app = express()
  app.use(
    session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: new session.MemoryStore(),
    }),
  )
  app.use(authPassport.initialize())
  app.use(authPassport.session())
  app.use('/auth', createAuthRouter(authPassport, config))
  return app
}

test('Google login returns to the page given in returnTo', async () => {
  const agent = request.agent(createLoginApp())

  const start = await agent.get(`/auth/google?returnTo=${encodeURIComponent('/tor/abc?x=1')}`)
  assert.equal(start.status, 302)
  assert.match(start.headers.location ?? '', /^https:\/\/accounts\.google\.com\//)

  const callback = await agent.get('/auth/google/callback?code=ok')
  assert.equal(callback.status, 302)
  assert.equal(callback.headers.location, 'http://localhost:3000/tor/abc?x=1')

  // The next login without returnTo must not reuse the old page
  await agent.get('/auth/google')
  const second = await agent.get('/auth/google/callback?code=ok')
  assert.equal(second.headers.location, 'http://localhost:3000/homepage')
})

test('Google login ignores an off-site returnTo and goes to the homepage', async () => {
  const agent = request.agent(createLoginApp())

  await agent.get(`/auth/google?returnTo=${encodeURIComponent('//evil.example.com/phish')}`)
  const callback = await agent.get('/auth/google/callback?code=ok')

  assert.equal(callback.headers.location, 'http://localhost:3000/homepage')
})

test('Google login with no returnTo goes to the homepage, and a failed login to the login page', async () => {
  const agent = request.agent(createLoginApp())

  await agent.get('/auth/google')
  const ok = await agent.get('/auth/google/callback?code=ok')
  assert.equal(ok.headers.location, 'http://localhost:3000/homepage')

  const failedAgent = request.agent(createLoginApp())
  await failedAgent.get(`/auth/google?returnTo=${encodeURIComponent('/tor/abc')}`)
  const failed = await failedAgent.get('/auth/google/callback?code=denied')
  assert.equal(failed.headers.location, 'http://localhost:3000/auth?error=google')
})
