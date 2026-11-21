import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'
import { Types } from 'mongoose'

import { requireAuth, requireScope } from '../../middleware/admin.middleware.js'
import { ADMIN_SCOPES, SCOPES, USER_SCOPES, hasScopes, missingScopes, scopesFor } from './scopes.js'

const account = (overrides: Partial<Express.User> = {}): Express.User => ({
  _id: new Types.ObjectId(),
  googleId: 'scopes-test',
  name: 'Scopes Test',
  email: 'scopes@example.com',
  image: null,
  ...overrides,
})

test('scopesFor: admin holds every scope', () => {
  assert.deepEqual(scopesFor(account({ role: 'admin', status: 'active' })), [...SCOPES])
})

test('scopesFor: a user holds only user scopes', () => {
  const scopes: string[] = scopesFor(account({ role: 'user', status: 'active' }))

  for (const adminScope of ADMIN_SCOPES) {
    assert.equal(scopes.includes(adminScope), false, adminScope)
  }
  assert.deepEqual(scopes, [...USER_SCOPES])
})

test('scopesFor: a record without a role is treated as a user', () => {
  assert.deepEqual(scopesFor(account()), [...USER_SCOPES])
})

test('scopesFor: suspended accounts and guests hold no scopes', () => {
  assert.deepEqual(scopesFor(account({ role: 'admin', status: 'suspended' })), [])
  assert.deepEqual(scopesFor(undefined), [])
})

test('missingScopes / hasScopes', () => {
  const user = account({ role: 'user' })

  assert.deepEqual(missingScopes(user, ['profile:read', 'users:manage']), ['users:manage'])
  assert.equal(hasScopes(user, ['profile:read', 'bookmarks:write']), true)
  assert.equal(hasScopes(user, ['tors:delete']), false)
})

const appWith = (user: Express.User | undefined) => {
  const app = express()
  app.use((req, _res, next) => {
    req.user = user
    next()
  })
  app.get('/tors/:id', requireScope('tors:delete'), (_req, res) => {
    res.json({ ok: true })
  })
  app.get('/me', requireAuth, (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

test('requireScope: guest gets 401', async () => {
  const response = await request(appWith(undefined)).get('/tors/1')

  assert.equal(response.status, 401)
  assert.equal(response.body.success, false)
})

test('requireScope: user without the scope gets 403 naming the missing scope', async () => {
  const response = await request(appWith(account({ role: 'user' }))).get('/tors/1')

  assert.equal(response.status, 403)
  assert.deepEqual(response.body.missingScopes, ['tors:delete'])
})

test('requireScope: suspended admin gets 403', async () => {
  const response = await request(appWith(account({ role: 'admin', status: 'suspended' }))).get(
    '/tors/1',
  )

  assert.equal(response.status, 403)
})

test('requireScope: admin with the scope passes', async () => {
  const response = await request(appWith(account({ role: 'admin', status: 'active' }))).get(
    '/tors/1',
  )

  assert.equal(response.status, 200)
})

test('requireAuth: 401 for guests, 403 for suspended, next() for active accounts', async () => {
  assert.equal((await request(appWith(undefined)).get('/me')).status, 401)
  assert.equal((await request(appWith(account({ status: 'suspended' }))).get('/me')).status, 403)
  assert.equal((await request(appWith(account({ status: 'active' }))).get('/me')).status, 200)
})
