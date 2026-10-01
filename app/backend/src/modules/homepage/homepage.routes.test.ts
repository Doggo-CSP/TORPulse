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

  await t.test('GET /homepage/analytics returns per-category price comparison and an overall price summary', async () => {
    const response = await request(app).get('/homepage/analytics')

    assert.equal(response.status, 200)

    // consulting_architecture has no fixtures at all, so it must be omitted entirely
    // rather than appearing with midCount/awardedCount of 0.
    assert.equal(response.body.priceComparison.length, 4)

    const byCategory: Record<string, { avgMidPriceBaht: number | null; avgAwardedPriceBaht: number | null }> =
      Object.fromEntries(
        response.body.priceComparison.map(
          (entry: { category: string; avgMidPriceBaht: number | null; avgAwardedPriceBaht: number | null }) => [
            entry.category,
            { avgMidPriceBaht: entry.avgMidPriceBaht, avgAwardedPriceBaht: entry.avgAwardedPriceBaht },
          ],
        ),
      )

    // web_application: fixtures 001, 002, 008, 010 — all have both prices set
    assert.deepEqual(byCategory.web_application, {
      avgMidPriceBaht: 4_250_000,
      avgAwardedPriceBaht: 3_825_000,
    })

    // data_bi: fixture 003 only
    assert.deepEqual(byCategory.data_bi, {
      avgMidPriceBaht: 3_000_000,
      avgAwardedPriceBaht: 2_700_000,
    })

    // mobile_app: fixture 004 has neither price set, so only fixture 007 contributes
    assert.deepEqual(byCategory.mobile_app, {
      avgMidPriceBaht: 5_000_000,
      avgAwardedPriceBaht: 4_500_000,
    })

    // enterprise_system: fixture 005 has mid only, fixture 006 has awarded only,
    // fixture 009 has both — each side averages independently over whichever
    // fixtures actually supplied that value
    assert.deepEqual(byCategory.enterprise_system, {
      avgMidPriceBaht: 5_500_000, // (4,000,000 + 7,000,000) / 2
      avgAwardedPriceBaht: 3_650_000, // (1,000,000 + 6,300,000) / 2
    })

    // Overall summary is computed only over fixtures with BOTH prices present
    // (001, 002, 003, 007, 008, 009, 010 — 7 of the 10 fixtures), so 004/005/006
    // are excluded here even though 005 and 006 each contribute to their
    // category's individual mid/awarded averages above.
    assert.equal(response.body.priceSummary.avgMidPriceBaht, 4_571_429)
    assert.equal(response.body.priceSummary.avgAwardedPriceBaht, 4_114_286)
    assert.equal(response.body.priceSummary.avgDiscountPct, 10)
  })
})