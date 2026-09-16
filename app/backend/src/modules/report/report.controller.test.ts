import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'

import { database } from '../../config/mongoose.js'
import { DataSourceModel } from '../ingestion/data-source.model.js'
import { IngestionJobModel } from '../ingestion/ingestion-job.model.js'
import {
  SEED_AGENCY_ALPHA,
  SEED_AGENCY_BETA,
  SEED_PREFIX,
  seedProcurementReports,
} from '../../scripts/seed-procurement-reports.js'
import { TorModel } from '../tor/tor.model.js'
import router from './report.routes.js'

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
    'GET /reports/price-overview for Seed Agency Alpha matches hand-computed totals',
    async () => {
      const response = await request(app)
        .get('/reports/price-overview')
        .query({ agencyName: SEED_AGENCY_ALPHA })

      assert.equal(response.status, 200)
      assert.equal(response.body.success, true)
      assert.deepEqual(response.body.data, {
        total_mid_price: 50.0,
        total_awarded_price: 46.1,
        avg_mid_price: 10.0,
        project_count: 5,
        total_savings: 3.9,
        overall_savings_pct: 7.8,
        avg_savings_baht: 0.78,
        pct_projects_below_reference: 80.0,
        max_savings_pct: 20.0,
      })
    },
  )

  await t.test(
    'GET /reports/price-overview for Seed Agency Beta matches hand-computed totals',
    async () => {
      const response = await request(app)
        .get('/reports/price-overview')
        .query({ agencyName: SEED_AGENCY_BETA })

      assert.equal(response.status, 200)
      assert.deepEqual(response.body.data, {
        total_mid_price: 50.0,
        total_awarded_price: 43.7,
        avg_mid_price: 10.0,
        project_count: 5,
        total_savings: 6.3,
        overall_savings_pct: 12.6,
        avg_savings_baht: 1.26,
        pct_projects_below_reference: 100.0,
        max_savings_pct: 18.0,
      })
    },
  )

  await t.test(
    'GET /reports/price-overview with period=1y excludes Seed Agency Beta (730 days old)',
    async () => {
      const response = await request(app)
        .get('/reports/price-overview')
        .query({ agencyName: SEED_AGENCY_BETA, period: '1y' })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.project_count, 0)
      assert.equal(response.body.data.avg_mid_price, null)
      assert.equal(response.body.data.overall_savings_pct, null)
      assert.equal(response.body.data.max_savings_pct, null)
    },
  )

  await t.test(
    'GET /reports/price-overview with category+agency isolating a single over-budget project yields max_savings_pct null',
    async () => {
      const response = await request(app)
        .get('/reports/price-overview')
        .query({ category: 'งานพัฒนาเว็บไซต์', agencyName: SEED_AGENCY_ALPHA })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.project_count, 1)
      assert.equal(response.body.data.overall_savings_pct, -5.0)
      assert.equal(response.body.data.pct_projects_below_reference, 0.0)
      assert.equal(response.body.data.max_savings_pct, null)
    },
  )

  await t.test('GET /reports/price-overview rejects an unknown agencyName', async () => {
    const response = await request(app)
      .get('/reports/price-overview')
      .query({ agencyName: 'ไม่มีหน่วยงานนี้จริง' })

    assert.equal(response.status, 400)
  })

  await t.test('GET /reports/price-overview rejects an invalid period', async () => {
    const response = await request(app).get('/reports/price-overview').query({ period: '5y' })

    assert.equal(response.status, 400)
  })

  await t.test(
    'GET /reports/savings-distribution for Seed Agency Alpha buckets projects correctly',
    async () => {
      const response = await request(app)
        .get('/reports/savings-distribution')
        .query({ agencyName: SEED_AGENCY_ALPHA })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.total_projects, 5)
      assert.deepEqual(response.body.data.buckets, [
        { label: 'ประหยัด < 5%', count: 1, pct: 20.0 },
        { label: 'ประหยัด 5% - 10%', count: 2, pct: 40.0 },
        { label: 'ประหยัด 10% - 15%', count: 1, pct: 20.0 },
        { label: 'ประหยัดสูง > 15%', count: 1, pct: 20.0 },
      ])
    },
  )

  await t.test(
    'GET /reports/savings-distribution for Seed Agency Beta buckets projects correctly',
    async () => {
      const response = await request(app)
        .get('/reports/savings-distribution')
        .query({ agencyName: SEED_AGENCY_BETA })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.total_projects, 5)
      assert.deepEqual(response.body.data.buckets, [
        { label: 'ประหยัด < 5%', count: 1, pct: 20.0 },
        { label: 'ประหยัด 5% - 10%', count: 0, pct: 0.0 },
        { label: 'ประหยัด 10% - 15%', count: 2, pct: 40.0 },
        { label: 'ประหยัดสูง > 15%', count: 2, pct: 40.0 },
      ])
    },
  )

  await t.test(
    'GET /reports/category-comparison for Seed Agency Alpha returns all 5 categories, 2 empty',
    async () => {
      const response = await request(app)
        .get('/reports/category-comparison')
        .query({ agencyName: SEED_AGENCY_ALPHA })

      assert.equal(response.status, 200)
      const categories: Record<string, unknown>[] = response.body.data.categories
      assert.equal(categories.length, 5)
      const byCategory = Object.fromEntries(categories.map((c) => [c.category, c]))

      assert.deepEqual(byCategory.mobile_app, {
        category: 'mobile_app',
        category_label: 'งานแอปพลิเคชันมือถือ',
        total_mid_price: 20.0,
        total_awarded_price: 17.0,
        avg_savings_pct: 15.0,
        project_count: 2,
      })
      assert.deepEqual(byCategory.data_bi, {
        category: 'data_bi',
        category_label: 'งานข้อมูลและวิเคราะห์',
        total_mid_price: 20.0,
        total_awarded_price: 18.6,
        avg_savings_pct: 7.0,
        project_count: 2,
      })
      assert.deepEqual(byCategory.web_application, {
        category: 'web_application',
        category_label: 'งานพัฒนาเว็บไซต์',
        total_mid_price: 10.0,
        total_awarded_price: 10.5,
        avg_savings_pct: -5.0,
        project_count: 1,
      })
      assert.deepEqual(byCategory.enterprise_system, {
        category: 'enterprise_system',
        category_label: 'งานระบบองค์กร',
        total_mid_price: 0,
        total_awarded_price: 0,
        avg_savings_pct: null,
        project_count: 0,
      })
      assert.deepEqual(byCategory.consulting_architecture, {
        category: 'consulting_architecture',
        category_label: 'Consulting / Architecture',
        total_mid_price: 0,
        total_awarded_price: 0,
        avg_savings_pct: null,
        project_count: 0,
      })
    },
  )

  await t.test(
    'GET /reports/category-comparison for Seed Agency Beta returns the complementary empty categories',
    async () => {
      const response = await request(app)
        .get('/reports/category-comparison')
        .query({ agencyName: SEED_AGENCY_BETA })

      assert.equal(response.status, 200)
      const categories: Record<string, unknown>[] = response.body.data.categories
      const byCategory = Object.fromEntries(categories.map((c) => [c.category, c]))

      assert.equal(byCategory.mobile_app!.project_count, 0)
      assert.equal(byCategory.data_bi!.project_count, 0)
      assert.deepEqual(byCategory.enterprise_system, {
        category: 'enterprise_system',
        category_label: 'งานระบบองค์กร',
        total_mid_price: 20.0,
        total_awarded_price: 17.4,
        avg_savings_pct: 13.0,
        project_count: 2,
      })
      assert.deepEqual(byCategory.consulting_architecture, {
        category: 'consulting_architecture',
        category_label: 'Consulting / Architecture',
        total_mid_price: 20.0,
        total_awarded_price: 16.6,
        avg_savings_pct: 17.0,
        project_count: 2,
      })
    },
  )

  await t.test(
    'GET /reports/procurement-list for Seed Agency Alpha sorts by savings_amount desc by default and paginates',
    async () => {
      const page1 = await request(app)
        .get('/reports/procurement-list')
        .query({ agencyName: SEED_AGENCY_ALPHA, page_size: 2, page: 1 })

      assert.equal(page1.status, 200)
      assert.equal(page1.body.data.total_count, 5)
      assert.equal(page1.body.data.total_pages, 3)
      assert.equal(page1.body.data.items.length, 2)
      assert.equal(page1.body.data.items[0].external_id, `${SEED_PREFIX}closed-001`)
      assert.equal(page1.body.data.items[0].savings_amount, 2_000_000)
      assert.equal(page1.body.data.items[0].savings_pct, 20.0)

      const lastPage = await request(app)
        .get('/reports/procurement-list')
        .query({ agencyName: SEED_AGENCY_ALPHA, page_size: 2, page: 3 })

      assert.equal(lastPage.body.data.items.length, 1)
      assert.equal(lastPage.body.data.items[0].external_id, `${SEED_PREFIX}closed-005`)
      assert.equal(lastPage.body.data.items[0].savings_amount, -500_000)
    },
  )

  await t.test('GET /reports/procurement-list sorts ascending by awardedPriceBaht', async () => {
    const response = await request(app).get('/reports/procurement-list').query({
      agencyName: SEED_AGENCY_ALPHA,
      sort_by: 'awardedPriceBaht',
      sort_order: 'asc',
      page_size: 10,
    })

    assert.equal(response.status, 200)
    const items: { external_id: string; awarded_price_baht: number }[] = response.body.data.items
    assert.equal(items[0]!.external_id, `${SEED_PREFIX}closed-001`)
    assert.equal(items[0]!.awarded_price_baht, 8_000_000)
    assert.equal(items[4]!.external_id, `${SEED_PREFIX}closed-005`)
    assert.equal(items[4]!.awarded_price_baht, 10_500_000)
  })

  await t.test(
    'GET /reports/procurement-list with budget_min above all fixtures returns an empty page',
    async () => {
      const response = await request(app)
        .get('/reports/procurement-list')
        .query({ agencyName: SEED_AGENCY_ALPHA, budget_min: 15 })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.total_count, 0)
      assert.equal(response.body.data.total_pages, 0)
      assert.deepEqual(response.body.data.items, [])
    },
  )

  await t.test(
    'GET /reports/procurement-list includes the null-agencyName fixture under the "อื่นๆ" bucket',
    async () => {
      const response = await request(app)
        .get('/reports/procurement-list')
        .query({ agencyName: 'อื่นๆ', page_size: 100 })

      assert.equal(response.status, 200)
      const externalIds: string[] = response.body.data.items.map(
        (item: { external_id: string }) => item.external_id,
      )
      assert.ok(externalIds.includes(`${SEED_PREFIX}closed-011`))
    },
  )

  await t.test('GET /reports/procurement-list rejects an invalid sort_by', async () => {
    const response = await request(app)
      .get('/reports/procurement-list')
      .query({ sort_by: 'not_a_field' })

    assert.equal(response.status, 400)
  })

  await t.test(
    'GET /reports/filters/departments includes both seeded agencies, sorted',
    async () => {
      const response = await request(app).get('/reports/filters/departments')

      assert.equal(response.status, 200)
      const departments: string[] = response.body.data.departments
      assert.ok(departments.includes(SEED_AGENCY_ALPHA))
      assert.ok(departments.includes(SEED_AGENCY_BETA))
      const knownOnly = departments.filter((d) => d !== 'อื่นๆ')
      assert.deepEqual(
        knownOnly,
        [...knownOnly].sort((a, b) => a.localeCompare(b)),
      )
    },
  )
})
