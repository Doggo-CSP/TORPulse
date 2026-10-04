import assert from 'node:assert/strict'
import test from 'node:test'

import session from 'express-session'
import request from 'supertest'
import { Types } from 'mongoose'

import { createApiApp } from '../apps/api/app.js'
import type { ApiAuthConfig } from '../modules/auth/auth.config.js'
import { createPassport } from '../modules/auth/passport.js'
import { User } from '../modules/auth/user.model.js'
import { assertNotProduction, buildSessionData, signSessionId } from './dev-session-token.js'

const config: ApiAuthConfig = {
  googleClientId: 'test-client',
  googleClientSecret: 'test-secret',
  googleCallbackUrl: 'http://localhost:8000/auth/google/callback',
  sessionSecret: 'test-session-secret-that-is-long-enough',
  frontendUrl: 'http://localhost:3000',
  isProduction: false,
}

test('dev:token refuses to run when NODE_ENV=production', () => {
  assert.throws(() => assertNotProduction('production'), /disabled when NODE_ENV=production/)
  assert.doesNotThrow(() => assertNotProduction('development'))
  assert.doesNotThrow(() => assertNotProduction(undefined))
})

test('a token made by dev:token is accepted by the real session middleware', async (t) => {
  const store = new session.MemoryStore()
  const app = createApiApp(config, { sessionStore: store, authPassport: createPassport(config) })
  const userId = new Types.ObjectId()
  t.mock.method(User, 'findById', async () => ({
    _id: userId,
    googleId: 'dev-admin@example.com',
    name: 'admin',
    email: 'admin@example.com',
    image: null,
    role: 'admin',
    status: 'active',
  }))

  await new Promise<void>((resolve, reject) =>
    store.set('dev-session-id', buildSessionData(userId.toString()), (error) =>
      error ? reject(error) : resolve(),
    ),
  )
  const token = signSessionId('dev-session-id', config.sessionSecret)

  const response = await request(app).get('/auth/me').set('Cookie', `torpulse.sid=${token}`)
  const forged = await request(app)
    .get('/auth/me')
    .set('Cookie', `torpulse.sid=${signSessionId('dev-session-id', 'wrong-secret')}`)

  assert.equal(response.status, 200)
  assert.equal(response.body.user.role, 'admin')
  assert.equal(forged.status, 401)
})
