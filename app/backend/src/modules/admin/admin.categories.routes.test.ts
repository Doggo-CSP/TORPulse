import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'
import { Types } from 'mongoose'

import { database } from '../../config/mongoose.js'
import { seedCategories } from '../../scripts/seed-categories.js'
import { User } from '../auth/user.model.js'
import { CategoryModel } from '../category/category.model.js'
import categoryRouter from '../category/category.routes.js'
import { TorModel } from '../tor/tor.model.js'
import router from './admin.routes.js'
import { AuditLogModel } from './audit-log.model.js'

const SEED_PREFIX = 'seed-admin-categories-test-'
const KEY_PREFIX = 'seed_admin_categories_test_'
// A name with no latin letters, to check the generated category_xxxxxx key
const THAI_NAME = 'หมวดทดสอบภาษาไทยล้วน'

test('admin routes: category management (UC-16)', async (t) => {
  await database.connect()
  await seedCategories()

  // A run that died mid-way leaves seed data behind; clear it before starting.
  const cleanup = async (extraCategoryIds: Types.ObjectId[] = []) => {
    const categories = await CategoryModel.find({
      $or: [
        { key: { $regex: `^${KEY_PREFIX}` } },
        { name: { $regex: `^${SEED_PREFIX}` } },
        { name: THAI_NAME },
        { _id: { $in: extraCategoryIds } },
      ],
    }).lean()
    const ids = [...categories.map((category) => category._id), ...extraCategoryIds]
    await AuditLogModel.deleteMany({ targetType: 'category', targetId: { $in: ids } })
    await CategoryModel.deleteMany({ _id: { $in: ids } })
    await User.deleteMany({ googleId: { $regex: `^${SEED_PREFIX}` } })
    await TorModel.deleteMany({ externalId: { $regex: `^${SEED_PREFIX}` } })
  }
  await cleanup()

  const actor = await User.create({
    googleId: `${SEED_PREFIX}actor`,
    name: 'Seed Category Admin',
    email: `${SEED_PREFIX}actor@example.com`,
    image: null,
    role: 'admin',
    status: 'active',
  })
  // Categories created with a Thai name get a generated key without the seed prefix
  const createdIds: Types.ObjectId[] = []

  t.after(async () => {
    await cleanup(createdIds)
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
  app.use('/categories', categoryRouter)

  const categoryUrl = (id: string) => `/admin/categories/${id}`
  const createCategory = async (body: Record<string, unknown>) => {
    const response = await request(app).post('/admin/categories').send(body)
    if (response.body.category?.id) createdIds.push(new Types.ObjectId(response.body.category.id))
    return response
  }

  await t.test('every category endpoint rejects a regular user', async () => {
    currentUser = {
      ...actorUser,
      _id: new Types.ObjectId(),
      role: 'user',
    }
    const id = new Types.ObjectId().toString()
    const responses = await Promise.all([
      request(app).get('/admin/categories'),
      request(app)
        .post('/admin/categories')
        .send({ name: `${SEED_PREFIX}x` }),
      request(app)
        .patch(categoryUrl(id))
        .send({ name: `${SEED_PREFIX}x` }),
      request(app)
        .patch(`${categoryUrl(id)}/status`)
        .send({ isActive: false }),
      request(app).delete(categoryUrl(id)),
    ])
    currentUser = actorUser

    for (const response of responses) {
      assert.equal(response.status, 403)
    }
    assert.equal(await CategoryModel.countDocuments({ name: `${SEED_PREFIX}x` }), 0)
  })

  await t.test(
    'POST creates a category with a key, cleaned keywords, and an audit log',
    async () => {
      const response = await createCategory({
        name: `${SEED_PREFIX}Data Platform`,
        description: 'แพลตฟอร์มข้อมูล',
        keywords: [' Kafka ', 'kafka', 'Spark', '  '],
      })

      assert.equal(response.status, 201)
      const category = response.body.category
      assert.equal(category.key, 'seed_admin_categories_test_data_platform')
      assert.equal(category.name, `${SEED_PREFIX}Data Platform`)
      assert.deepEqual(category.keywords, ['Kafka', 'Spark'])
      assert.equal(category.isActive, true)
      assert.equal(category.userCount, 0)

      const log = await AuditLogModel.findOne({ action: 'category.created', targetId: category.id })
      assert.equal(log?.targetLabel, category.name)

      // Admin-added categories are offered to users straight away
      const publicList = await request(app).get('/categories')
      assert.ok(publicList.body.some((c: { key: string }) => c.key === category.key))
    },
  )

  await t.test('POST generates a category_ key for a Thai or mixed Thai-English name', async () => {
    const response = await createCategory({ name: THAI_NAME })

    assert.equal(response.status, 201)
    assert.match(response.body.category.key, /^category_[0-9a-f]{6}$/)

    // Thai mixed with English must not keep just the English part as the key
    const mixed = await createCategory({ name: `${SEED_PREFIX}หมวดผสม http` })
    assert.equal(mixed.status, 201)
    assert.match(mixed.body.category.key, /^category_[0-9a-f]{6}$/)
  })

  await t.test('POST rejects a duplicate name (any letter case) and a missing name', async () => {
    const duplicate = await createCategory({ name: `${SEED_PREFIX}DATA PLATFORM` })
    assert.equal(duplicate.status, 409)
    assert.equal(duplicate.body.success, false)

    const seededDuplicate = await createCategory({ name: 'งานพัฒนาเว็บไซต์' })
    assert.equal(seededDuplicate.status, 409)

    const missing = await createCategory({ description: 'ไม่มีชื่อ' })
    assert.equal(missing.status, 400)
  })

  await t.test('PATCH edits name, description, and keywords but never the key', async () => {
    const created = await createCategory({ name: `${SEED_PREFIX}Editable` })
    const id = created.body.category.id

    const withKey = await request(app).patch(categoryUrl(id)).send({ key: 'other_key' })
    assert.equal(withKey.status, 400)

    const mixed = await request(app)
      .patch(categoryUrl(id))
      .send({ name: `${SEED_PREFIX}Edited`, key: 'other_key' })
    assert.equal(mixed.status, 400)

    const edited = await request(app)
      .patch(categoryUrl(id))
      .send({ name: `${SEED_PREFIX}Edited`, description: 'ใหม่', keywords: ['A', 'a', 'B'] })
    assert.equal(edited.status, 200)
    assert.equal(edited.body.category.name, `${SEED_PREFIX}Edited`)
    assert.deepEqual(edited.body.category.keywords, ['A', 'B'])
    assert.equal(edited.body.category.key, created.body.category.key)

    const stored = await CategoryModel.findById(id).lean()
    assert.equal(stored?.key, created.body.category.key)

    const log = await AuditLogModel.findOne({ action: 'category.updated', targetId: id }).lean()
    assert.deepEqual(log?.before, { name: `${SEED_PREFIX}Editable`, description: '', keywords: [] })

    const duplicate = await request(app)
      .patch(categoryUrl(id))
      .send({ name: `${SEED_PREFIX}Data Platform` })
    assert.equal(duplicate.status, 409)

    const unknown = await request(app)
      .patch(categoryUrl(new Types.ObjectId().toString()))
      .send({ name: `${SEED_PREFIX}Nobody` })
    assert.equal(unknown.status, 404)
  })

  await t.test('PATCH status hides and shows a category, each with an audit log', async () => {
    const created = await createCategory({ name: `${SEED_PREFIX}Hideable` })
    const { id, key } = created.body.category

    const hidden = await request(app)
      .patch(`${categoryUrl(id)}/status`)
      .send({ isActive: false })
    assert.equal(hidden.status, 200)
    assert.equal(hidden.body.category.isActive, false)

    const publicList = await request(app).get('/categories')
    assert.ok(!publicList.body.some((c: { key: string }) => c.key === key))

    const again = await request(app)
      .patch(`${categoryUrl(id)}/status`)
      .send({ isActive: false })
    assert.equal(again.status, 400)

    const invalid = await request(app)
      .patch(`${categoryUrl(id)}/status`)
      .send({ isActive: 'no' })
    assert.equal(invalid.status, 400)

    const shown = await request(app)
      .patch(`${categoryUrl(id)}/status`)
      .send({ isActive: true })
    assert.equal(shown.status, 200)

    const actions = (
      await AuditLogModel.find({ targetId: id }).sort({ createdAt: 1, _id: 1 }).lean()
    ).map((log) => log.action)
    assert.deepEqual(actions, ['category.created', 'category.hidden', 'category.shown'])

    const feed = await request(app).get('/admin/activity').query({ group: 'system', limit: 100 })
    assert.ok(feed.body.items.some((item: { action: string }) => item.action === 'category.shown'))
  })

  await t.test('GET lists categories in order, searches keywords, and counts users', async () => {
    const created = await createCategory({
      name: `${SEED_PREFIX}Searchable`,
      keywords: ['Quantum Widget'],
    })
    const { key } = created.body.category
    await User.create([
      {
        googleId: `${SEED_PREFIX}fan-1`,
        name: 'Fan 1',
        email: `${SEED_PREFIX}fan-1@example.com`,
        interests: [key, 'ai_ml'],
      },
      {
        googleId: `${SEED_PREFIX}fan-2`,
        name: 'Fan 2',
        email: `${SEED_PREFIX}fan-2@example.com`,
        interests: [key],
      },
    ])

    const all = await request(app).get('/admin/categories')
    assert.equal(all.status, 200)
    const orders = all.body.categories.map((c: { sortOrder: number }) => c.sortOrder)
    assert.deepEqual(
      orders,
      [...orders].sort((a, b) => a - b),
    )
    assert.equal(all.body.total, await CategoryModel.countDocuments())
    assert.equal(all.body.activeCount, await CategoryModel.countDocuments({ isActive: true }))

    const search = await request(app).get('/admin/categories').query({ search: 'quantum widg' })
    assert.equal(search.status, 200)
    assert.deepEqual(
      search.body.categories.map((c: { key: string }) => c.key),
      [key],
    )
    assert.equal(search.body.categories[0].userCount, 2)
    // The summary counts ignore the search box
    assert.equal(search.body.total, all.body.total)
  })

  await t.test(
    'DELETE refuses a category that users or TORs use, and says to hide it',
    async () => {
      const byUser = await createCategory({ name: `${SEED_PREFIX}Used by user` })
      await User.create({
        googleId: `${SEED_PREFIX}user-of-category`,
        name: 'User of category',
        email: `${SEED_PREFIX}user-of-category@example.com`,
        interests: [byUser.body.category.key],
      })

      const userBlocked = await request(app).delete(categoryUrl(byUser.body.category.id))
      assert.equal(userBlocked.status, 409)
      assert.equal(userBlocked.body.userCount, 1)
      assert.equal(userBlocked.body.torCount, 0)
      assert.match(userBlocked.body.message, /ซ่อน/)

      const byTor = await createCategory({ name: `${SEED_PREFIX}Used by TOR` })
      await TorModel.create({
        dataSourceId: new Types.ObjectId(),
        ingestionJobId: new Types.ObjectId(),
        externalId: `${SEED_PREFIX}tor-1`,
        sourceVersion: 'v1',
        sourceAdapter: 'central_egp',
        detailUrl: 'https://example.com/tor-1',
        projectTitle: `${SEED_PREFIX}project`,
        category: byTor.body.category.key,
        classificationReason: 'test',
        confidence: 0.9,
        analysisModel: 'test-model',
        analysisVersion: 'v1',
        analyzedAt: new Date(),
      })

      const torBlocked = await request(app).delete(categoryUrl(byTor.body.category.id))
      assert.equal(torBlocked.status, 409)
      assert.equal(torBlocked.body.torCount, 1)

      assert.ok(await CategoryModel.exists({ _id: byUser.body.category.id }))
      assert.ok(await CategoryModel.exists({ _id: byTor.body.category.id }))
    },
  )

  await t.test('DELETE removes an unused category with an audit log', async () => {
    const created = await createCategory({ name: `${SEED_PREFIX}Unused` })
    const { id } = created.body.category

    const response = await request(app).delete(categoryUrl(id))
    assert.equal(response.status, 200)
    assert.equal(await CategoryModel.exists({ _id: id }), null)

    const log = await AuditLogModel.findOne({ action: 'category.deleted', targetId: id }).lean()
    assert.equal(log?.targetLabel, `${SEED_PREFIX}Unused`)

    const again = await request(app).delete(categoryUrl(id))
    assert.equal(again.status, 404)

    const invalid = await request(app).delete(categoryUrl('not-an-id'))
    assert.equal(invalid.status, 400)
  })
})
