import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import { Types } from 'mongoose'
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

  await t.test('GET /tors/filter-options lists fiscal years, departments, statuses, categories', async () => {
    const seededTor = await TorModel.findOne({ externalId: 'seed-homepage-004' }).lean()
    assert.ok(seededTor?.category)

    const response = await request(app).get('/tors/filter-options')

    assert.equal(response.status, 200)
    assert.ok(response.body.years.includes(2568))
    assert.deepEqual(response.body.years, [...response.body.years].sort((a, b) => b - a))
    assert.ok(response.body.departments.includes('กรมบัญชีกลาง'))
    assert.ok(response.body.statuses.includes('ระหว่างดำเนินการ'))
    assert.ok(
      response.body.categories.some((c: { key: string }) => c.key === seededTor.category),
    )
    assert.equal(response.body.technologies, undefined)
  })

  await t.test('GET /tors filters by category key and accepts all', async () => {
    const seededTor = await TorModel.findOne({ externalId: 'seed-homepage-004' }).lean()
    assert.ok(seededTor?.category)

    const response = await request(app)
      .get('/tors')
      .query({ q: 'seed project seed-homepage-004', categories: seededTor.category })
    assert.equal(response.status, 200)
    assert.equal(response.body.total, 1)

    const otherResponse = await request(app)
      .get('/tors')
      .query({ q: 'seed project seed-homepage-004', categories: 'no-such-category' })
    assert.equal(otherResponse.body.total, 0)

    const allResponse = await request(app)
      .get('/tors')
      .query({ q: 'seed project seed-homepage-004', categories: 'all' })
    assert.equal(allResponse.body.total, 1)
  })

  await t.test('GET /tors filters by title, fiscal year, department, status, and budget', async () => {
    const response = await request(app)
      .get('/tors')
      .query({
        q: 'seed project seed-homepage-',
        year: 2568,
        department: 'กรมบัญชีกลาง',
        status: 'ระหว่างดำเนินการ',
        budget_min: 250000,
        budget_max: 350000,
      })

    assert.equal(response.status, 200)
    assert.equal(response.body.total, 1)
    assert.equal(response.body.items[0].externalId, 'seed-homepage-004')
    assert.equal(response.body.items[0].sourceAdapter, 'central_egp')
    assert.ok(response.body.items[0].createdAt)

    const wrongYear = await request(app)
      .get('/tors')
      .query({ q: 'seed project seed-homepage-004', year: 2567 })
    assert.equal(wrongYear.body.total, 0)
  })

  await t.test('GET /tors paginates', async () => {
    const response = await request(app)
      .get('/tors')
      .query({ q: 'seed project seed-homepage-', page: 1, limit: 3 })

    assert.equal(response.status, 200)
    assert.equal(response.body.items.length, 3)
    assert.equal(response.body.total, 10)
    assert.equal(response.body.totalPages, 4)
  })

  await t.test('GET /tors/:id returns a normalized TOR detail', async () => {
    const seededTor = await TorModel.findOne({ externalId: 'seed-homepage-004' }).lean()
    assert.ok(seededTor)

    const response = await request(app).get(`/tors/${seededTor._id}`)

    assert.equal(response.status, 200)
    assert.equal(response.body.id, String(seededTor._id))
    assert.equal(response.body.externalId, 'seed-homepage-004')
    assert.equal(response.body.projectTitle, 'Seed project seed-homepage-004')
    assert.deepEqual(response.body.technologies, ['Flutter'])
    assert.ok(response.body.createdAt)
    assert.ok(response.body.updatedAt)
    assert.equal(response.body._id, undefined)
    assert.equal(response.body.dataSourceId, undefined)
    assert.equal(response.body.ingestionJobId, undefined)
  })

  await t.test('GET /tors/:id rejects a malformed id', async () => {
    const response = await request(app).get('/tors/not-an-object-id')

    assert.equal(response.status, 400)
    assert.deepEqual(response.body, { message: 'Invalid TOR id' })
  })

  await t.test('GET /tors/:id returns 404 for an absent TOR', async () => {
    const response = await request(app).get(`/tors/${new Types.ObjectId()}`)

    assert.equal(response.status, 404)
    assert.deepEqual(response.body, { message: 'TOR not found' })
  })
})
