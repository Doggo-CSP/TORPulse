import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'

import { database } from '../../config/mongoose.js'
import { DataSourceModel } from '../ingestion/data-source.model.js'
import { IngestionJobModel } from '../ingestion/ingestion-job.model.js'
import { SEED_PREFIX, seedProcurementReports } from '../../scripts/seed-procurement-reports.js'
import { TorModel } from '../tor/tor.model.js'
import router from './report.routes.js'

const D1 = 'สำนักการโยธา กทม.'
const D5 = 'สำนักยุทธศาสตร์และประเมินผล'

interface CategoryRow {
  category: string
  avg_reference_price: number | null
  avg_winning_price: number | null
  avg_percentage_diff: number | null
  project_count: number
}

function byLabel(categories: CategoryRow[]): Record<string, CategoryRow> {
  return Object.fromEntries(categories.map((c) => [c.category, c]))
}

test('procurement report endpoints, against a deterministic seeded dataset', async (t) => {
  await database.connect()
  await seedProcurementReports()

  t.after(async () => {
    await TorModel.deleteMany({ externalId: { $regex: `^${SEED_PREFIX}` } })
    await IngestionJobModel.deleteMany({ externalId: { $regex: `^${SEED_PREFIX}` } })
    await DataSourceModel.deleteMany({ key: { $regex: `^${SEED_PREFIX}` } })
    await database.disconnect()
  })

  const app = express()
  app.use('/reports', router)

  await t.test(
    'GET /reports/procurement-comparison with no filters returns all 5 categories',
    async () => {
      const response = await request(app).get('/reports/procurement-comparison')

      assert.equal(response.status, 200)
      assert.equal(response.body.success, true)
      const categories = byLabel(response.body.data.categories)
      assert.equal(response.body.data.categories.length, 5)

      assert.deepEqual(categories['Mobile App'], {
        category: 'Mobile App',
        avg_reference_price: 10.0,
        avg_winning_price: 8.5,
        avg_percentage_diff: -15.0,
        project_count: 2,
      })
      assert.deepEqual(categories['Data / BI'], {
        category: 'Data / BI',
        avg_reference_price: 20.0,
        avg_winning_price: 18.0,
        avg_percentage_diff: -10.0,
        project_count: 2,
      })
      assert.deepEqual(categories['Web Application'], {
        category: 'Web Application',
        avg_reference_price: 15.0,
        avg_winning_price: 12.8,
        avg_percentage_diff: -15.0,
        project_count: 2,
      })
      assert.deepEqual(categories['Enterprise System'], {
        category: 'Enterprise System',
        avg_reference_price: 6.0,
        avg_winning_price: 5.6,
        avg_percentage_diff: -7.5,
        project_count: 2,
      })
      assert.deepEqual(categories['Consulting / Architecture'], {
        category: 'Consulting / Architecture',
        avg_reference_price: 40.0,
        avg_winning_price: 37.0,
        avg_percentage_diff: -7.5,
        project_count: 2,
      })
    },
  )

  await t.test(
    'GET /reports/procurement-comparison filtered by department=D1 narrows to 1 project/category',
    async () => {
      const response = await request(app)
        .get('/reports/procurement-comparison')
        .query({ department: D1 })

      assert.equal(response.status, 200)
      const categories = byLabel(response.body.data.categories)
      assert.equal(response.body.data.categories.length, 5)
      assert.equal(categories['Mobile App']!.project_count, 1)
      assert.equal(categories['Mobile App']!.avg_percentage_diff, -20.0)
      assert.deepEqual(categories['Web Application'], {
        category: 'Web Application',
        avg_reference_price: 15.0,
        avg_winning_price: 13.5,
        avg_percentage_diff: -10.0,
        project_count: 1,
      })
      assert.deepEqual(categories['Enterprise System'], {
        category: 'Enterprise System',
        avg_reference_price: 6.0,
        avg_winning_price: 5.7,
        avg_percentage_diff: -5.0,
        project_count: 1,
      })
    },
  )

  await t.test(
    'GET /reports/procurement-comparison filtered by an unused department returns all 5 categories with zero counts',
    async () => {
      const response = await request(app)
        .get('/reports/procurement-comparison')
        .query({ department: D5 })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.categories.length, 5)
      for (const category of response.body.data.categories) {
        assert.equal(category.project_count, 0)
        assert.equal(category.avg_reference_price, null)
        assert.equal(category.avg_winning_price, null)
        assert.equal(category.avg_percentage_diff, null)
      }
    },
  )

  await t.test(
    'GET /reports/procurement-comparison with period=6m narrows to one project per category',
    async () => {
      const response = await request(app)
        .get('/reports/procurement-comparison')
        .query({ period: '6m' })

      assert.equal(response.status, 200)
      const categories = byLabel(response.body.data.categories)
      assert.equal(categories['Mobile App']!.project_count, 1)
      assert.equal(categories['Mobile App']!.avg_percentage_diff, -20.0)
      assert.equal(categories['Consulting / Architecture']!.project_count, 1)
      assert.equal(categories['Consulting / Architecture']!.avg_percentage_diff, -10.0)
    },
  )

  await t.test(
    'GET /reports/procurement-comparison with budget_min=30 leaves only Consulting/Architecture non-zero',
    async () => {
      const response = await request(app)
        .get('/reports/procurement-comparison')
        .query({ budget_min: 30 })

      assert.equal(response.status, 200)
      const categories = byLabel(response.body.data.categories)
      assert.equal(categories['Consulting / Architecture']!.project_count, 2)
      assert.equal(categories['Mobile App']!.project_count, 0)
      assert.equal(categories['Data / BI']!.project_count, 0)
    },
  )

  await t.test('GET /reports/procurement-comparison rejects an invalid department', async () => {
    const response = await request(app)
      .get('/reports/procurement-comparison')
      .query({ department: 'not-a-real-department' })

    assert.equal(response.status, 400)
    assert.ok(response.body.message)
  })

  await t.test(
    'GET /reports/price-overview with no filters matches hand-computed overall stats',
    async () => {
      const response = await request(app).get('/reports/price-overview')

      assert.equal(response.status, 200)
      assert.equal(response.body.data.avg_reference_price, 18.2)
      assert.equal(response.body.data.avg_winning_price, 16.4)
      assert.equal(response.body.data.avg_percentage_diff, -11.0)
      assert.equal(response.body.data.project_count, 10)
      assert.equal(response.body.data.trend, 'ราคามีแนวโน้มลดลง')
      assert.deepEqual(response.body.data.current_vs_historical, {
        current_avg_reference_price: 15.0,
        current_project_count: 4,
        historical_avg_reference_price: 18.2,
        higher_than_avg_pct: -17.6,
      })
    },
  )

  await t.test(
    'GET /reports/price-overview filtered by category+department matches hand-computed values',
    async () => {
      const response = await request(app)
        .get('/reports/price-overview')
        .query({ category: 'Web Application', department: D1 })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.avg_reference_price, 15.0)
      assert.equal(response.body.data.project_count, 1)
      assert.deepEqual(response.body.data.current_vs_historical, {
        current_avg_reference_price: 14.0,
        current_project_count: 2,
        historical_avg_reference_price: 15.0,
        higher_than_avg_pct: -6.7,
      })
    },
  )

  await t.test('GET /reports/price-overview with zero closed matches returns nulls', async () => {
    const response = await request(app).get('/reports/price-overview').query({ department: D5 })

    assert.equal(response.status, 200)
    assert.equal(response.body.data.avg_reference_price, null)
    assert.equal(response.body.data.project_count, 0)
    assert.equal(response.body.data.trend, null)
  })

  await t.test('GET /reports/price-overview rejects an invalid period', async () => {
    const response = await request(app).get('/reports/price-overview').query({ period: '5y' })

    assert.equal(response.status, 400)
  })

  await t.test(
    'GET /reports/category-price-history returns 5 rows sorted descending by avg_reference_price',
    async () => {
      const response = await request(app).get('/reports/category-price-history')

      assert.equal(response.status, 200)
      const categories: CategoryRow[] = response.body.data.categories
      assert.deepEqual(
        categories.map((c) => c.category),
        [
          'Consulting / Architecture',
          'Data / BI',
          'Web Application',
          'Mobile App',
          'Enterprise System',
        ],
      )
      assert.equal(categories[0]!.avg_reference_price, 40.0)
      assert.equal(categories[4]!.avg_reference_price, 6.0)
    },
  )

  await t.test(
    'GET /reports/category-price-history with period=6m returns one project per category',
    async () => {
      const response = await request(app)
        .get('/reports/category-price-history')
        .query({ period: '6m' })

      assert.equal(response.status, 200)
      const categories: CategoryRow[] = response.body.data.categories
      assert.equal(categories.length, 5)
      for (const category of categories) {
        assert.equal(category.project_count, 1)
      }
    },
  )

  await t.test('GET /reports/category-price-history rejects an invalid period', async () => {
    const response = await request(app)
      .get('/reports/category-price-history')
      .query({ period: 'foo' })

    assert.equal(response.status, 400)
  })
})
