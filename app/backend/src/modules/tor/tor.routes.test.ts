import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'

import { database } from '../../config/mongoose.js'
import { DataSourceModel } from '../ingestion/data-source.model.js'
import { IngestionJobModel } from '../ingestion/ingestion-job.model.js'
import { SEED_PREFIX, seedHomepageTors } from '../../scripts/seed-homepage-tors.js'
import { TorModel } from './tor.model.js'
import router from './tor.routes.js'

test('tor list + filter-options routes, against a deterministic seeded dataset', async (t) => {
  await database.connect()
  await seedHomepageTors()

  t.after(async () => {
    await TorModel.deleteMany({ externalId: { $regex: `^${SEED_PREFIX}` } })
    await IngestionJobModel.deleteMany({ externalId: { $regex: `^${SEED_PREFIX}` } })
    await DataSourceModel.deleteMany({ key: { $regex: `^${SEED_PREFIX}` } })
    await database.disconnect()
  })

  const app = express()
  app.use('/tors', router)

  await t.test('GET /tors/filter-options lists departments, budgetYears and categories', async () => {
    const response = await request(app).get('/tors/filter-options')

    assert.equal(response.status, 200)
    assert.deepEqual(response.body.departments, [
      'Ministry of Education',
      'Ministry of Finance',
      'Ministry of Health',
      'Ministry of Interior',
    ])
    assert.equal(response.body.budgetType, undefined)
    assert.equal(response.body.operationStatus, undefined)
    assert.equal(response.body.categories.length, 5)
  })

  await t.test('GET /tors filters by department', async () => {
    const response = await request(app).get('/tors').query({ department: 'Ministry of Health' })

    assert.equal(response.status, 200)
    assert.equal(response.body.total, 2)
  })

  await t.test('GET /tors filters by derived category', async () => {
    const response = await request(app).get('/tors').query({ technologies: 'mobile_app' })

    assert.equal(response.status, 200)
    assert.equal(response.body.total, 2)
    for (const item of response.body.items) {
      assert.equal(item.category, 'mobile_app')
    }
  })

  await t.test('GET /tors paginates', async () => {
    const response = await request(app).get('/tors').query({ page: 1, limit: 3 })

    assert.equal(response.status, 200)
    assert.equal(response.body.items.length, 3)
    assert.equal(response.body.total, 10)
    assert.equal(response.body.totalPages, 4)
  })
})
