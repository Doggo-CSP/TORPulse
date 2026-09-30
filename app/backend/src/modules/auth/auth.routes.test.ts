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
import { AuditLogModel } from '../admin/audit-log.model.js'
import { SettingsModel } from '../admin/settings.model.js'
import { createPassport, newUserDefaults } from './passport.js'
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

test('newUserDefaults: new accounts are pending unless a verified .go.th email is auto-approved', () => {
  assert.deepEqual(newUserDefaults('a@example.com', true, true), {
    status: 'pending',
    autoApproved: false,
  })
  assert.deepEqual(newUserDefaults('officer@dga.or.th', true, true), {
    status: 'pending',
    autoApproved: false,
  })
  assert.deepEqual(newUserDefaults('officer@DGA.GO.TH', true, true), {
    status: 'active',
    accountType: 'agency',
    autoApproved: true,
  })
  assert.deepEqual(newUserDefaults('officer@dga.go.th', false, true), {
    status: 'pending',
    autoApproved: false,
  })
  assert.deepEqual(newUserDefaults('officer@dga.go.th', true, false), {
    status: 'pending',
    autoApproved: false,
  })
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

const mockSettings = (
  context: test.TestContext,
  settings: { autoApproveGovEmails: boolean } | null,
) => {
  context.mock.method(SettingsModel, 'findOne', () => ({
    session: () => ({ lean: async () => settings }),
  }))
}

test('Google login auto-approves a new verified .go.th account and logs it as system', async (t) => {
  const authPassport = createPassport(config)
  const userId = new Types.ObjectId()
  let capturedUpdate: Record<string, Record<string, unknown>> | undefined
  const auditDocs: unknown[] = []

  mockSettings(t, { autoApproveGovEmails: true })
  t.mock.method(User, 'findOneAndUpdate', async (_filter: unknown, update: unknown) => {
    capturedUpdate = update as Record<string, Record<string, unknown>>
    return {
      value: { _id: userId, status: 'active' },
      lastErrorObject: { updatedExisting: false },
    }
  })
  t.mock.method(AuditLogModel, 'create', async (docs: unknown[]) => {
    auditDocs.push(...docs)
    return docs
  })

  const user = await runGoogleVerify(authPassport, {
    id: 'google-1',
    displayName: 'Officer',
    emails: [{ value: 'Officer@DGA.go.th', verified: true }],
  })

  assert.deepEqual(user, { _id: userId, status: 'active' })
  assert.equal(capturedUpdate?.$setOnInsert?.status, 'active')
  assert.equal(capturedUpdate?.$setOnInsert?.accountType, 'agency')
  assert.equal(auditDocs.length, 1)
  assert.equal((auditDocs[0] as { actorType: string }).actorType, 'system')
  assert.equal((auditDocs[0] as { action: string }).action, 'user.approved')
})

test('Google login leaves a new non-government account pending and writes no log', async (t) => {
  const authPassport = createPassport(config)
  let capturedUpdate: Record<string, Record<string, unknown>> | undefined
  const create = t.mock.method(AuditLogModel, 'create', async (docs: unknown[]) => docs)

  mockSettings(t, null)
  t.mock.method(User, 'findOneAndUpdate', async (_filter: unknown, update: unknown) => {
    capturedUpdate = update as Record<string, Record<string, unknown>>
    return {
      value: { _id: new Types.ObjectId(), status: 'pending' },
      lastErrorObject: { updatedExisting: false },
    }
  })

  await runGoogleVerify(authPassport, {
    id: 'google-2',
    displayName: 'Person',
    emails: [{ value: 'person@example.com', verified: true }],
  })

  assert.equal(capturedUpdate?.$setOnInsert?.status, 'pending')
  assert.equal(capturedUpdate?.$setOnInsert?.accountType, undefined)
  assert.equal(create.mock.callCount(), 0)
})

test('Google login does not re-approve or log an existing account', async (t) => {
  const authPassport = createPassport(config)
  const create = t.mock.method(AuditLogModel, 'create', async (docs: unknown[]) => docs)

  mockSettings(t, { autoApproveGovEmails: true })
  t.mock.method(User, 'findOneAndUpdate', async () => ({
    value: { _id: new Types.ObjectId(), status: 'pending' },
    lastErrorObject: { updatedExisting: true },
  }))

  const user = await runGoogleVerify(authPassport, {
    id: 'google-3',
    displayName: 'Waiting',
    emails: [{ value: 'waiting@dga.go.th', verified: true }],
  })

  assert.deepEqual((user as { status: string }).status, 'pending')
  assert.equal(create.mock.callCount(), 0)
})
