import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'
import { Types } from 'mongoose'

import { database } from '../../config/mongoose.js'
import router from './admin.routes.js'

const SEED_PREFIX = 'seed-admin-routes-test-'

const makeUser = (overrides: Partial<Express.User> = {}): Express.User => ({
  _id: new Types.ObjectId(),
  googleId: `${SEED_PREFIX}google-id`,
  name: 'Test User',
  email: `${SEED_PREFIX}user@example.com`,
  image: null,
  ...overrides,
})

test('admin routes: requireAdmin guard', async (t) => {
  await database.connect()

  t.after(async () => {
    await database.disconnect()
  })

  let currentUser: Express.User | undefined

  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = currentUser
    next()
  })
  app.use('/admin', router)

  await t.test('GET /admin/stats rejects a guest with 401', async () => {
    currentUser = undefined

    const response = await request(app).get('/admin/stats')

    assert.equal(response.status, 401)
    assert.equal(response.body.success, false)
  })

  await t.test('GET /admin/stats rejects a regular user with 403', async () => {
    currentUser = makeUser({ role: 'user', status: 'active' })

    const response = await request(app).get('/admin/stats')

    assert.equal(response.status, 403)
    assert.equal(response.body.success, false)
  })

  await t.test('GET /admin/stats rejects an editor with 403', async () => {
    currentUser = makeUser({ role: 'editor', status: 'active' })

    const response = await request(app).get('/admin/stats')

    assert.equal(response.status, 403)
  })

  await t.test('GET /admin/stats rejects a suspended admin with 403', async () => {
    currentUser = makeUser({ role: 'admin', status: 'suspended' })

    const response = await request(app).get('/admin/stats')

    assert.equal(response.status, 403)
  })

  await t.test('GET /admin/stats rejects a pending admin with 403', async () => {
    currentUser = makeUser({ role: 'admin', status: 'pending' })

    const response = await request(app).get('/admin/stats')

    assert.equal(response.status, 403)
  })

  await t.test('PATCH /admin/users/:userId/role is guarded before the handler runs', async () => {
    currentUser = makeUser({ role: 'user', status: 'active' })

    const response = await request(app)
      .patch(`/admin/users/${new Types.ObjectId().toString()}/role`)
      .send({ role: 'admin' })

    assert.equal(response.status, 403)
  })

  await t.test('GET /admin/stats allows an active admin', async () => {
    currentUser = makeUser({ role: 'admin', status: 'active' })

    const response = await request(app).get('/admin/stats')

    assert.equal(response.status, 200)
    assert.equal(typeof response.body.stats.total_tors, 'number')
    assert.equal(typeof response.body.role_counts.admins, 'number')
  })

  await t.test('GET /admin/stats allows an admin without a stored status', async () => {
    currentUser = makeUser({ role: 'admin' })

    const response = await request(app).get('/admin/stats')

    assert.equal(response.status, 200)
  })
})
