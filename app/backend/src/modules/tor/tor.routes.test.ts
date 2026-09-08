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

  await t.test('GET /tors/filter-options lists database years and technologies', async () => {
    const response = await request(app).get('/tors/filter-options')

    assert.equal(response.status, 200)
    assert.ok(response.body.years.includes(new Date().getFullYear()))
    assert.deepEqual(response.body.technologies, [...response.body.technologies].sort((a, b) => a.localeCompare(b)))
    assert.ok(response.body.technologies.includes('React'))
    assert.ok(response.body.technologies.includes('Power BI'))
  })

  await t.test('GET /tors filters by exact technology and accepts all', async () => {
    const response = await request(app)
      .get('/tors')
      .query({ q: 'seed project seed-homepage-004', technologies: 'Flutter' })

    assert.equal(response.status, 200)
    assert.equal(response.body.total, 1)
    assert.deepEqual(response.body.items[0].technologies, ['Flutter'])

    const allResponse = await request(app)
      .get('/tors')
      .query({ q: 'seed project seed-homepage-004', technologies: 'all' })
    assert.equal(allResponse.body.total, 1)
  })

  await t.test('GET /tors filters by title, year, and budget range', async () => {
    const response = await request(app)
      .get('/tors')
      .query({ q: 'seed project seed-homepage-004', year: new Date().getFullYear(), budget_min: 250000, budget_max: 350000 })

    assert.equal(response.status, 200)
    assert.equal(response.body.total, 1)
    assert.equal(response.body.items[0].externalId, 'seed-homepage-004')
    assert.equal(response.body.items[0].sourceAdapter, 'central_egp')
    assert.ok(response.body.items[0].createdAt)
  })

  await t.test('GET /tors paginates', async () => {
    const response = await request(app).get('/tors').query({ q: 'seed project seed-homepage-', page: 1, limit: 3 })

    assert.equal(response.status, 200)
    assert.equal(response.body.items.length, 3)
    assert.equal(response.body.total, 10)
    assert.equal(response.body.totalPages, 4)
  })
})
