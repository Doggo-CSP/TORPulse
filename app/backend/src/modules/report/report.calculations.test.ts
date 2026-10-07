import assert from 'node:assert/strict'
import test from 'node:test'

import { pickLatestSnapshot, toFinishedTor, type FinishedTor } from './finished-tors.js'
import {
  categoryComparison,
  filterFinishedTors,
  findSimilarProjects,
  median,
  monthlyTimeline,
  priceOverview,
  procurementList,
  savingsBucketOf,
  savingsDistribution,
  summarizeSimilar,
} from './report.calculations.js'

// Pure unit tests: no database. Every expected number is worked out by hand in the comments.

const finished = (overrides: Partial<FinishedTor> & { externalId: string }): FinishedTor => ({
  projectTitle: `Project ${overrides.externalId}`,
  agencyName: null,
  departmentName: 'กรม ก',
  category: 'web_application',
  categories: ['web_application'],
  technologies: [],
  requirements: [],
  summary: null,
  budgetBaht: null,
  midPriceBaht: 1_000_000,
  awardedPriceBaht: 900_000,
  announceDate: null,
  analyzedAt: new Date('2026-10-04T00:00:00Z'),
  detailUrl: null,
  ...overrides,
})

// A: web, saves 10%    B: web, saves 15%    C: data, 5% ABOVE mid    D: enterprise, saves 2%
const A = finished({
  externalId: 'A',
  midPriceBaht: 1_000_000,
  awardedPriceBaht: 900_000,
  announceDate: new Date('2026-01-15T00:00:00Z'),
  technologies: ['react'],
})
const B = finished({
  externalId: 'B',
  departmentName: 'กรม ข',
  categories: ['web_application', 'cloud_infrastructure'],
  midPriceBaht: 2_000_000,
  awardedPriceBaht: 1_700_000,
  announceDate: new Date('2026-02-10T00:00:00Z'),
})
const C = finished({
  externalId: 'C',
  category: 'data_bi',
  categories: ['data_bi'],
  midPriceBaht: 4_000_000,
  awardedPriceBaht: 4_200_000,
  announceDate: new Date('2025-06-01T00:00:00Z'),
})
// No announce date: placed by analyzedAt (2026-10-04)
const D = finished({
  externalId: 'D',
  category: 'enterprise_system',
  categories: ['enterprise_system'],
  midPriceBaht: 1_000_000,
  awardedPriceBaht: 980_000,
})
const ALL = [A, B, C, D]

test('priceOverview sums prices and savings over all projects', () => {
  // mid 8,000,000 · awarded 7,780,000 · savings 220,000 (2.75%) · savings % = 10, 15, -5, 2
  assert.deepEqual(priceOverview(ALL), {
    project_count: 4,
    total_mid_price_baht: 8_000_000,
    total_awarded_price_baht: 7_780_000,
    total_savings_baht: 220_000,
    overall_savings_pct: 2.8,
    avg_mid_price_baht: 2_000_000,
    avg_awarded_price_baht: 1_945_000,
    avg_savings_baht: 55_000,
    median_savings_pct: 6, // (2 + 10) / 2
    pct_projects_below_reference: 75, // A, B, D
    max_savings_pct: 15,
  })
})

test('priceOverview of no projects has zero totals and null averages', () => {
  const empty = priceOverview([])
  assert.equal(empty.project_count, 0)
  assert.equal(empty.total_mid_price_baht, 0)
  assert.equal(empty.overall_savings_pct, null)
  assert.equal(empty.avg_mid_price_baht, null)
  assert.equal(empty.max_savings_pct, null)
})

test('savingsBucketOf puts a bid above the mid price in its own bucket', () => {
  assert.equal(savingsBucketOf(-5), 'over')
  assert.equal(savingsBucketOf(0), 'lt5')
  assert.equal(savingsBucketOf(4.99), 'lt5')
  assert.equal(savingsBucketOf(5), '5to10')
  assert.equal(savingsBucketOf(10), '10to15')
  assert.equal(savingsBucketOf(15), 'gt15')
  assert.equal(savingsBucketOf(80), 'gt15')
})

test('savingsDistribution counts each bucket once', () => {
  const { total_projects, buckets } = savingsDistribution(ALL)
  assert.equal(total_projects, 4)
  assert.deepEqual(
    buckets.map((b) => [b.key, b.count, b.pct]),
    [
      ['over', 1, 25], // C
      ['lt5', 1, 25], // D
      ['5to10', 0, 0],
      ['10to15', 1, 25], // A
      ['gt15', 1, 25], // B
    ],
  )
})

test('filterFinishedTors applies period, category, department, search and bucket', () => {
  const ids = (items: FinishedTor[]) => items.map((t) => t.externalId)
  // D has no announce date, so its analyzedAt (2026-10-04) is used
  assert.deepEqual(ids(filterFinishedTors(ALL, { cutoff: new Date('2026-01-01T00:00:00Z') })), [
    'A',
    'B',
    'D',
  ])
  assert.deepEqual(ids(filterFinishedTors(ALL, { category: 'web_application' })), ['A', 'B'])
  assert.deepEqual(ids(filterFinishedTors(ALL, { departmentName: 'กรม ข' })), ['B'])
  assert.deepEqual(ids(filterFinishedTors(ALL, { q: 'project c' })), ['C'])
  assert.deepEqual(ids(filterFinishedTors(ALL, { savingsBucket: 'over' })), ['C'])
  assert.deepEqual(ids(filterFinishedTors(ALL, {})), ['A', 'B', 'C', 'D'])
})

test('categoryComparison lists every active category, then unknown keys with projects', () => {
  const categories = [
    { key: 'web_application', name: 'เว็บ', isActive: true },
    { key: 'data_bi', name: 'ข้อมูล', isActive: true },
    { key: 'mobile_app', name: 'มือถือ', isActive: true },
    { key: 'hidden_unused', name: 'ซ่อน', isActive: false },
  ]
  const rows = categoryComparison(ALL, categories)

  // hidden_unused has no project so it is left out; enterprise_system is not in the list
  // but has project D, so it is appended with its key as the label
  assert.deepEqual(
    rows.map((r) => r.category),
    ['web_application', 'data_bi', 'mobile_app', 'enterprise_system'],
  )
  assert.deepEqual(rows[0], {
    category: 'web_application',
    category_label: 'เว็บ',
    project_count: 2,
    total_mid_price_baht: 3_000_000,
    total_awarded_price_baht: 2_600_000,
    avg_mid_price_baht: 1_500_000,
    avg_awarded_price_baht: 1_300_000,
    avg_savings_pct: 12.5, // (10 + 15) / 2
  })
  assert.equal(rows[2]!.project_count, 0)
  assert.equal(rows[2]!.avg_mid_price_baht, null)
  assert.equal(rows[3]!.category_label, 'enterprise_system')
})

test('monthlyTimeline groups by Bangkok calendar month, oldest first', () => {
  const lateJanuaryUtc = finished({
    externalId: 'E',
    // 2026-01-31 20:00 UTC is 2026-02-01 03:00 in Bangkok
    announceDate: new Date('2026-01-31T20:00:00Z'),
  })
  const months = monthlyTimeline([...ALL, lateJanuaryUtc])

  assert.deepEqual(
    months.map((m) => [m.month, m.project_count]),
    [
      ['2025-06', 1],
      ['2026-01', 1],
      ['2026-02', 2],
      ['2026-10', 1],
    ],
  )
  assert.deepEqual(months[1], {
    month: '2026-01',
    project_count: 1,
    total_mid_price_baht: 1_000_000,
    total_awarded_price_baht: 900_000,
    total_savings_baht: 100_000,
    avg_savings_pct: 10,
  })
})

test('procurementList sorts and pages the rows', () => {
  const names = new Map([['web_application', 'เว็บ']])
  const page2 = procurementList(
    ALL,
    { sortBy: 'savings_pct', sortOrder: 'desc', page: 2, pageSize: 3 },
    names,
  )
  // savings % desc: B 15, A 10, D 2, C -5
  assert.equal(page2.total_count, 4)
  assert.equal(page2.total_pages, 2)
  assert.deepEqual(
    page2.items.map((r) => [r.external_id, r.savings_pct, r.savings_amount_baht]),
    [['C', -5, -200_000]],
  )

  const byDate = procurementList(
    ALL,
    { sortBy: 'announceDate', sortOrder: 'desc', page: 1, pageSize: 10 },
    names,
  )
  assert.deepEqual(
    byDate.items.map((r) => r.external_id),
    ['D', 'B', 'A', 'C'],
  )
  assert.equal(byDate.items[1]!.category_label, 'เว็บ')
})

test('findSimilarProjects scores shared categories and technologies', () => {
  const target = {
    externalId: 'X',
    category: 'web_application',
    categories: ['web_application', 'cloud_infrastructure'],
    technologies: ['React', 'PostgreSQL'],
  }
  const E = finished({
    externalId: 'E',
    category: 'cloud_infrastructure',
    categories: ['cloud_infrastructure'],
    technologies: ['postgresql ', 'Docker'],
  })
  // Same project as the TOR being viewed: never its own match
  const self = finished({ externalId: 'X' })

  const matches = findSimilarProjects(target, [A, B, C, E, self])

  // A: same primary (3) + react (1) = 4 · B: same primary (3) + cloud (1) = 4, newer than A
  // E: cloud (1) + postgresql (1) = 2 · C: no shared category, left out
  assert.deepEqual(
    matches.map((m) => [m.tor.externalId, m.match.score]),
    [
      ['B', 4],
      ['A', 4],
      ['E', 2],
    ],
  )
  assert.deepEqual(matches[1]!.match.matchedTechnologies, ['react'])
  assert.deepEqual(matches[2]!.match.matchedCategories, ['cloud_infrastructure'])
  assert.equal(findSimilarProjects(target, [A, B, E], 1).length, 1)

  // With a budget, equal scores go to the closest size: A's mid (1,000,000) is nearer to
  // 1,100,000 than B's (2,000,000), so A now comes before the newer B
  assert.deepEqual(
    findSimilarProjects({ ...target, budgetBaht: 1_100_000 }, [A, B]).map((m) => m.tor.externalId),
    ['A', 'B'],
  )
})

test('summarizeSimilar compares the TOR budget with similar awarded prices', () => {
  // medians of A and B: mid 1,500,000 · awarded 1,300,000
  // budget 1,800,000 is (1,800,000 - 1,300,000) / 1,300,000 = 38.46% above
  assert.deepEqual(summarizeSimilar([A, B], 1_800_000), {
    project_count: 2,
    median_mid_price_baht: 1_500_000,
    median_awarded_price_baht: 1_300_000,
    avg_savings_pct: 12.5,
    budget_vs_median_awarded_pct: 38.5,
  })
  assert.deepEqual(summarizeSimilar([], 1_000_000), {
    project_count: 0,
    median_mid_price_baht: null,
    median_awarded_price_baht: null,
    avg_savings_pct: null,
    budget_vs_median_awarded_pct: null,
  })
  assert.equal(summarizeSimilar([A], null).budget_vs_median_awarded_pct, null)
})

test('median of odd and even lists', () => {
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([4, 1, 3, 2]), 2.5)
  assert.equal(median([]), null)
})

test('pickLatestSnapshot picks the newest dated tors_bk_ collection', () => {
  assert.deepEqual(
    pickLatestSnapshot([
      'tors',
      'tors_bk',
      'tors_bk_20260930',
      'tors_bk_20261004',
      'tors_bk_20261003',
      'tors_bk_2026',
      'users',
    ]),
    { collection: 'tors_bk_20261004', snapshotDate: '2026-10-04' },
  )
  assert.equal(pickLatestSnapshot(['tors', 'tors_bk']), null)
})

test('toFinishedTor keeps only projects with both prices and resolves the category', () => {
  const base = {
    externalId: '69000000001',
    projectTitle: 'ระบบทดสอบ',
    midPriceBaht: 1_000_000,
    awardedPriceBaht: 950_000,
  }
  assert.equal(toFinishedTor({ ...base, awardedPriceBaht: null }), null)
  assert.equal(toFinishedTor({ ...base, midPriceBaht: 0 }), null)
  assert.equal(toFinishedTor({ ...base, externalId: '' }), null)

  const stored = toFinishedTor({ ...base, category: 'ai_ml', categories: ['ai_ml', 'data_bi'] })
  assert.equal(stored?.category, 'ai_ml')
  assert.deepEqual(stored?.categories, ['ai_ml', 'data_bi'])

  // No stored category: the keyword fallback decides, and categories lists it
  const derived = toFinishedTor({ ...base, category: null, technologies: ['Flutter'] })
  assert.equal(derived?.category, 'mobile_app')
  assert.deepEqual(derived?.categories, ['mobile_app'])
  assert.equal(derived?.announceDate, null)
})
