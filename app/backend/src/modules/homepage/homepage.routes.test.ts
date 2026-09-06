import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'

import { database } from '../../config/mongoose.js'
import { DataSourceModel } from '../ingestion/data-source.model.js'
import { IngestionJobModel } from '../ingestion/ingestion-job.model.js'
import { SEED_PREFIX, seedHomepageTors } from '../../scripts/seed-homepage-tors.js'
import { TorModel } from '../tor/tor.model.js'
import router from './homepage.routes.js'

test('homepage summary and analytics endpoints, against a deterministic seeded dataset', async (t) => {
  await database.connect()
  await seedHomepageTors()

  t.after(async () => {
    await TorModel.deleteMany({ externalId: { $regex: `^${SEED_PREFIX}` } })
    await IngestionJobModel.deleteMany({ externalId: { $regex: `^${SEED_PREFIX}` } })
    await DataSourceModel.deleteMany({ key: { $regex: `^${SEED_PREFIX}` } })
    await database.disconnect()
  })

  const app = express()
  app.use('/homepage', router)

  await t.test('GET /homepage/summary returns hand-computed totals', async () => {
    const response = await request(app).get('/homepage/summary')

    assert.equal(response.status, 200)
    assert.equal(response.body.total_tors, 10)
    assert.equal(response.body.total_sources, 2)
    assert.equal(response.body.total_budget, 2_000_000)
    assert.equal(response.body.new_this_week, 6)
    assert.notEqual(response.body.last_updated, null)
  })

  await t.test('GET /homepage/analytics returns a category distribution summing to 100%', async () => {
    const response = await request(app).get('/homepage/analytics')

    assert.equal(response.status, 200)

    const byCategory: Record<string, number> = Object.fromEntries(
      response.body.categoryDistribution.map((entry: { category: string; percentage: number }) => [
        entry.category,
        entry.percentage,
      ]),
    )
    assert.equal(byCategory.web_application, 40)
    assert.equal(byCategory.data_bi, 10)
    assert.equal(byCategory.mobile_app, 20)
    assert.equal(byCategory.enterprise_system, 30)

    const topReact = response.body.topTechnologies.find(
      (entry: { _id: string }) => entry._id === 'React',
    )
    assert.ok(topReact, 'expected React to appear in topTechnologies')
    assert.equal(topReact.count, 2)
    assert.equal(topReact.percentage, 12.5)
  })
})
