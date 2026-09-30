import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'
import { Types } from 'mongoose'

import { database } from '../../config/mongoose.js'
import { User } from '../auth/user.model.js'
import router from './admin.routes.js'
import { AuditLogModel } from './audit-log.model.js'

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

test('admin routes: user accounts & roles (UC-13)', async (t) => {
  await database.connect()

  const actor = await User.create({
    googleId: `${SEED_PREFIX}actor`,
    name: 'Seed Admin',
    email: `${SEED_PREFIX}actor@example.com`,
    image: null,
    role: 'admin',
    status: 'active',
  })
  const target = await User.create({
    googleId: `${SEED_PREFIX}target`,
    name: 'Seed Target',
    email: `${SEED_PREFIX}target@example.com`,
    image: null,
    role: 'user',
    status: 'active',
  })
  const otherAdmin = await User.create({
    googleId: `${SEED_PREFIX}other-admin`,
    name: 'Seed Other Admin',
    email: `${SEED_PREFIX}other-admin@example.com`,
    image: null,
    role: 'admin',
    status: 'active',
  })
  const seededIds = [actor._id, target._id, otherAdmin._id]

  t.after(async () => {
    await AuditLogModel.deleteMany({ targetId: { $in: seededIds } })
    await User.deleteMany({ _id: { $in: seededIds } })
    await database.disconnect()
  })

  const actorUser: Express.User = {
    _id: actor._id,
    googleId: actor.googleId,
    name: actor.name,
    email: actor.email,
    image: actor.image,
    role: 'admin',
    status: 'active',
  }
  let currentUser: Express.User | undefined = actorUser

  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = currentUser
    next()
  })
  app.use('/admin', router)

  const targetUrl = (id: Types.ObjectId | string) => `/admin/users/${id.toString()}`

  await t.test('GET /admin/users treats regex characters in q as plain text', async () => {
    const response = await request(app).get('/admin/users').query({ q: '(' })

    assert.equal(response.status, 200)
    assert.ok(Array.isArray(response.body.users))
  })

  await t.test('GET /admin/users/:userId returns the user detail', async () => {
    const response = await request(app).get(targetUrl(target._id))

    assert.equal(response.status, 200)
    assert.equal(response.body.user._id, target._id.toString())
    assert.equal(response.body.user.email, target.email)
    assert.equal(response.body.user.role, 'user')
    assert.equal(response.body.user.status, 'active')
    assert.equal(response.body.user.bookmarkedCount, 0)
  })

  await t.test('GET /admin/users/:userId rejects an invalid id with 400', async () => {
    const response = await request(app).get(targetUrl('not-an-id'))

    assert.equal(response.status, 400)
    assert.equal(response.body.success, false)
  })

  await t.test('GET /admin/users/:userId returns 404 for an unknown user', async () => {
    const response = await request(app).get(targetUrl(new Types.ObjectId()))

    assert.equal(response.status, 404)
  })

  await t.test('non-admins cannot read or change users', async () => {
    currentUser = makeUser({ role: 'user', status: 'active' })

    const detail = await request(app).get(targetUrl(target._id))
    const status = await request(app)
      .patch(`${targetUrl(target._id)}/status`)
      .send({ status: 'suspended' })

    currentUser = actorUser

    assert.equal(detail.status, 403)
    assert.equal(status.status, 403)
    assert.equal((await User.findById(target._id).lean())?.status, 'active')
  })

  await t.test('PATCH role rejects an invalid role, invalid id, and unknown user', async () => {
    const badRole = await request(app)
      .patch(`${targetUrl(target._id)}/role`)
      .send({ role: 'root' })
    const badId = await request(app)
      .patch(`${targetUrl('not-an-id')}/role`)
      .send({ role: 'user' })
    const unknown = await request(app)
      .patch(`${targetUrl(new Types.ObjectId())}/role`)
      .send({ role: 'user' })

    assert.equal(badRole.status, 400)
    assert.equal(badId.status, 400)
    assert.equal(unknown.status, 404)
  })

  await t.test('PATCH role changes the role and writes an audit log', async () => {
    const response = await request(app)
      .patch(`${targetUrl(target._id)}/role`)
      .send({ role: 'editor' })

    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal((await User.findById(target._id).lean())?.role, 'editor')

    const log = await AuditLogModel.findOne({
      targetId: target._id,
      action: 'user.role.update',
    }).lean()
    assert.ok(log)
    assert.equal(log.actorId.toString(), actor._id.toString())
    assert.equal(log.targetType, 'user')
    assert.deepEqual(log.before, { role: 'user' })
    assert.deepEqual(log.after, { role: 'editor' })
  })

  await t.test('PATCH status suspends and reactivates with an audit log each time', async () => {
    const suspend = await request(app)
      .patch(`${targetUrl(target._id)}/status`)
      .send({ status: 'suspended' })
    assert.equal(suspend.status, 200)
    assert.equal((await User.findById(target._id).lean())?.status, 'suspended')

    const reactivate = await request(app)
      .patch(`${targetUrl(target._id)}/status`)
      .send({ status: 'active' })
    assert.equal(reactivate.status, 200)
    assert.equal((await User.findById(target._id).lean())?.status, 'active')

    const logs = await AuditLogModel.find({ targetId: target._id, action: 'user.status.update' })
      .sort({ createdAt: 1 })
      .lean()
    assert.equal(logs.length, 2)
    assert.deepEqual(logs[0]?.after, { status: 'suspended' })
    assert.deepEqual(logs[1]?.before, { status: 'suspended' })
  })

  await t.test('PATCH status rejects an invalid status', async () => {
    const response = await request(app)
      .patch(`${targetUrl(target._id)}/status`)
      .send({ status: 'deleted' })

    assert.equal(response.status, 400)
  })

  await t.test('an admin cannot change their own role or status', async () => {
    const role = await request(app)
      .patch(`${targetUrl(actor._id)}/role`)
      .send({ role: 'user' })
    const status = await request(app)
      .patch(`${targetUrl(actor._id)}/status`)
      .send({ status: 'suspended' })

    assert.equal(role.status, 400)
    assert.equal(status.status, 400)

    const stored = await User.findById(actor._id).lean()
    assert.equal(stored?.role, 'admin')
    assert.equal(stored?.status, 'active')
  })

  await t.test('the last active admin cannot be demoted or suspended', async (st) => {
    st.mock.method(User, 'countDocuments', async () => 0)

    const role = await request(app)
      .patch(`${targetUrl(otherAdmin._id)}/role`)
      .send({ role: 'user' })
    const status = await request(app)
      .patch(`${targetUrl(otherAdmin._id)}/status`)
      .send({ status: 'suspended' })

    assert.equal(role.status, 400)
    assert.equal(status.status, 400)

    const stored = await User.findById(otherAdmin._id).lean()
    assert.equal(stored?.role, 'admin')
    assert.equal(stored?.status, 'active')
  })

  await t.test('an admin can be demoted while another active admin remains', async () => {
    const response = await request(app)
      .patch(`${targetUrl(otherAdmin._id)}/role`)
      .send({ role: 'user' })

    assert.equal(response.status, 200)
    assert.equal((await User.findById(otherAdmin._id).lean())?.role, 'user')
  })
})

test('admin routes: transactional role changes and the audit activity feed', async (t) => {
  await database.connect()

  const createSeedUser = (key: string, role: 'admin' | 'user') =>
    User.create({
      googleId: `${SEED_PREFIX}${key}`,
      name: `Seed ${key}`,
      email: `${SEED_PREFIX}${key}@example.com`,
      image: null,
      role,
      status: 'active',
    })

  const adminA = await createSeedUser('race-admin-a', 'admin')
  const adminB = await createSeedUser('race-admin-b', 'admin')
  const member = await createSeedUser('feed-member', 'user')
  const seededIds = [adminA._id, adminB._id, member._id]

  t.after(async () => {
    await AuditLogModel.deleteMany({ targetId: { $in: seededIds } })
    await User.deleteMany({ _id: { $in: seededIds } })
    await database.disconnect()
  })

  const toSessionUser = (user: typeof adminA): Express.User => ({
    _id: user._id,
    googleId: user.googleId,
    name: user.name,
    email: user.email,
    image: user.image,
    role: 'admin',
    status: 'active',
  })
  const actors = new Map([
    [adminA._id.toString(), toSessionUser(adminA)],
    [adminB._id.toString(), toSessionUser(adminB)],
  ])

  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = actors.get(req.header('x-test-actor') ?? '')
    next()
  })
  app.use('/admin', router)

  await t.test('two admins demoting each other at once cannot remove every admin', async (st) => {
    // Pretend the seeded admins are the only admins in the system.
    const originalCount = User.countDocuments.bind(User)
    st.mock.method(User, 'countDocuments', (filter: Record<string, unknown>, options: unknown) =>
      originalCount(
        { ...filter, _id: { $in: [adminA._id, adminB._id], ...(filter._id as object) } },
        options as never,
      ),
    )

    const [aDemotesB, bDemotesA] = await Promise.all([
      request(app)
        .patch(`/admin/users/${adminB._id.toString()}/role`)
        .set('x-test-actor', adminA._id.toString())
        .send({ role: 'user' }),
      request(app)
        .patch(`/admin/users/${adminA._id.toString()}/role`)
        .set('x-test-actor', adminB._id.toString())
        .send({ role: 'user' }),
    ])

    const statuses = [aDemotesB.status, bDemotesA.status].sort()
    assert.deepEqual(statuses, [200, 400])

    const remainingAdmins = await User.countDocuments({
      _id: { $in: [adminA._id, adminB._id] },
      role: 'admin',
    })
    assert.equal(remainingAdmins, 1)
  })

  await t.test('GET /admin/activities lists audit log entries, newest first', async () => {
    const actorId = (await User.findOne({ _id: { $in: [adminA._id, adminB._id] }, role: 'admin' }))!
      ._id
    const actorHeader = actorId.toString()

    const change = await request(app)
      .patch(`/admin/users/${member._id.toString()}/status`)
      .set('x-test-actor', actorHeader)
      .send({ status: 'suspended' })
    assert.equal(change.status, 200)

    const response = await request(app).get('/admin/activities').set('x-test-actor', actorHeader)

    assert.equal(response.status, 200)
    const latest = response.body.activities[0]
    assert.equal(latest.type, 'user_role')
    assert.equal(latest.title, 'เปลี่ยนสถานะผู้ใช้งาน')
    assert.equal(latest.target, member.email)
    assert.equal(latest.description, 'status: active → suspended')
    assert.equal(latest.actor, `Seed race-admin-${actorId.equals(adminA._id) ? 'a' : 'b'}`)
  })
})
