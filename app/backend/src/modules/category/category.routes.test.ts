import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'

import { database } from '../../config/mongoose.js'
import { seedCategories } from '../../scripts/seed-categories.js'
import { CATEGORY_SEED } from './category.constants.js'
import { CategoryModel } from './category.model.js'
import router from './category.routes.js'

const HIDDEN_KEY = 'seed_category_routes_test_hidden'

test('GET /categories', async (t) => {
  await database.connect()
  await seedCategories()
  await CategoryModel.deleteMany({ key: HIDDEN_KEY })

  t.after(async () => {
    await CategoryModel.deleteMany({ key: HIDDEN_KEY })
    await database.disconnect()
  })

  const app = express()
  app.use('/categories', router)

  await t.test('lists the seeded categories in display order with Thai names', async () => {
    const response = await request(app).get('/categories')

    assert.equal(response.status, 200)
    // Other categories an admin added may also be listed; the seeded 8 keep their order.
    const seedKeys = new Set(CATEGORY_SEED.map((category) => category.key))
    const seeded = (response.body as { key: string }[]).filter((c) => seedKeys.has(c.key))
    assert.deepEqual(
      seeded,
      CATEGORY_SEED.map(({ key, name, description }) => ({ key, name, description })),
    )
  })

  await t.test('leaves out hidden categories', async () => {
    await CategoryModel.create({ key: HIDDEN_KEY, name: 'หมวดทดสอบที่ซ่อน', isActive: false })

    const response = await request(app).get('/categories')

    assert.equal(response.status, 200)
    assert.ok(!(response.body as { key: string }[]).some((c) => c.key === HIDDEN_KEY))
  })
})
