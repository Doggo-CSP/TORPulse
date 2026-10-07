import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isBiddingClosed,
  mockAwardedPrice,
  mockSavingsPct,
  toFinishedTor,
  type FinishedTor,
} from './finished-tors.js'
import {
  categoryComparison,
  filterFinishedTors,
  findSimilarProjects,
  median,
  monthlyTimeline,
  priceOverview,
  procurementList,
  reportDateOf,
  savingsBucketOf,
  withVisibleCategories,
  savingsDistribution,
  summarizeSimilar,
} from './report.calculations.js'

// Pure unit tests: no database. Every expected number is worked out by hand in the comments.

const finished = (overrides: Partial<FinishedTor> & { externalId: string }): FinishedTor => ({
  id: `id-${overrides.externalId}`,
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
  awardedIsMock: false,
  announceDate: null,
  submissionDeadlineAt: null,
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

test('categoryComparison lists only active categories (hidden ones are a soft delete)', () => {
  const categories = [
    { key: 'web_application', name: 'เว็บ', isActive: true },
    { key: 'data_bi', name: 'ข้อมูล', isActive: false }, // hidden, but project C uses it
    { key: 'mobile_app', name: 'มือถือ', isActive: true },
    { key: 'hidden_unused', name: 'ซ่อน', isActive: false },
  ]
  const rows = categoryComparison(ALL, categories)

  // data_bi is hidden: no bar even though project C is in it. enterprise_system (project D) is
  // not in the categories collection at all: no bar either. mobile_app is active: a 0 bar.
  assert.deepEqual(
    rows.map((r) => r.category),
    ['web_application', 'mobile_app'],
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
  assert.equal(rows[1]!.project_count, 0)
  assert.equal(rows[1]!.avg_mid_price_baht, null)
})

test('withVisibleCategories hides inactive categories without changing anything else', () => {
  const visible = new Set(['web_application', 'mobile_app'])
  // B: primary web (visible), secondary cloud (not visible)
  const b = withVisibleCategories(B, visible)
  assert.equal(b.category, 'web_application')
  assert.deepEqual(b.categories, ['web_application'])
  assert.equal(b.midPriceBaht, B.midPriceBaht)
  // C: primary data_bi not visible -> no category at all
  const c = withVisibleCategories(C, visible)
  assert.equal(c.category, null)
  assert.deepEqual(c.categories, [])

  // A filter on a hidden category finds nothing; the table shows no label
  const shown = [A, B, C, D].map((tor) => withVisibleCategories(tor, visible))
  assert.deepEqual(filterFinishedTors(shown, { category: 'data_bi' }), [])
  const rows = procurementList(
    shown,
    { sortBy: 'savings_pct', sortOrder: 'desc', page: 1, pageSize: 10 },
    new Map([['web_application', 'เว็บ']]),
  ).items
  const rowC = rows.find((r) => r.external_id === 'C')!
  assert.equal(rowC.category, null)
  assert.equal(rowC.category_label, null)
  assert.equal(rows.find((r) => r.external_id === 'A')!.category_label, 'เว็บ')
})

test('findSimilarProjects never matches on a hidden category', () => {
  const visible = new Set(['web_application'])
  // Target and C share only data_bi, which is hidden
  const target = { externalId: 'X', category: null, categories: [], technologies: [] }
  const matches = findSimilarProjects(
    target,
    [C].map((tor) => withVisibleCategories(tor, visible)),
  )
  assert.deepEqual(matches, [])
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

// "Now" for the tests below: 2026-10-07 10:00 in Bangkok
const NOW = new Date('2026-10-07T03:00:00Z')

test('isBiddingClosed: closed only once the Bangkok submission day is over', () => {
  // 2026-10-06 12:00 Bangkok: yesterday
  assert.equal(isBiddingClosed(new Date('2026-10-06T05:00:00Z'), NOW), true)
  // 2026-10-07 12:00 Bangkok: today, still open until the day ends
  assert.equal(isBiddingClosed(new Date('2026-10-07T05:00:00Z'), NOW), false)
  // 2026-10-06 23:30 UTC is already 2026-10-07 06:30 in Bangkok: today, still open
  assert.equal(isBiddingClosed(new Date('2026-10-06T23:30:00Z'), NOW), false)
  assert.equal(isBiddingClosed(new Date('2026-10-20T05:00:00Z'), NOW), false)
  // No deadline: treated as open
  assert.equal(isBiddingClosed(null, NOW), false)
})

test('mockSavingsPct follows the real savings bands', () => {
  assert.equal(mockSavingsPct(0), -3)
  assert.equal(mockSavingsPct(0.005), -1.5) // middle of the 1% "above mid" band
  assert.equal(mockSavingsPct(0.01), 0)
  assert.equal(mockSavingsPct(0.305), 2.5) // middle of the 59% 0-5% band
  assert.equal(mockSavingsPct(0.6), 5)
  assert.equal(mockSavingsPct(0.79), 15)
  assert.ok(mockSavingsPct(0.999999) < 30)
})

test('mockAwardedPrice is deterministic, within -3% .. +30% savings, shaped like real data', () => {
  assert.equal(
    mockAwardedPrice('69099316505', 7_087_000),
    mockAwardedPrice('69099316505', 7_087_000),
  )
  const n = 2000
  let above = 0
  let small = 0
  for (let i = 0; i < n; i += 1) {
    const awarded = mockAwardedPrice(`ext-${i}`, 1_000_000)
    assert.ok(awarded >= 700_000 && awarded <= 1_030_000, `ext-${i} -> ${awarded}`)
    assert.equal(awarded % 100, 0)
    if (awarded > 1_000_000) above += 1
    if (awarded <= 1_000_000 && awarded > 950_000) small += 1
  }
  // About 1% above the mid price and about 59% saving 0-5% (loose bounds for hashing noise)
  assert.ok(above / n < 0.03, `above ${above}`)
  assert.ok(small / n > 0.5 && small / n < 0.68, `small ${small}`)
})

test('toFinishedTor: a TOR still open for bids never gets an awarded price', () => {
  const base = {
    _id: 'a1',
    externalId: '69000000001',
    projectTitle: 'ระบบทดสอบ',
    midPriceBaht: 1_000_000,
    awardedPriceBaht: null,
  }
  const open = { ...base, submissionDeadlineAt: new Date('2026-10-20T05:00:00Z') }
  const dueToday = { ...base, submissionDeadlineAt: new Date('2026-10-07T05:00:00Z') }
  const noDeadline = { ...base, submissionDeadlineAt: null }
  assert.equal(toFinishedTor(open, NOW), null)
  assert.equal(toFinishedTor(dueToday, NOW), null)
  assert.equal(toFinishedTor(noDeadline, NOW), null)
})

test('toFinishedTor: closed TORs get a labelled mock, cancelled ones none, real prices win', () => {
  const closed = {
    _id: 'a2',
    externalId: '69000000002',
    projectTitle: 'ระบบที่ปิดรับแล้ว',
    midPriceBaht: 1_000_000,
    awardedPriceBaht: null,
    submissionDeadlineAt: new Date('2026-09-01T05:00:00Z'),
    contractStatusCode: 'S1',
  }

  const mocked = toFinishedTor(closed, NOW)
  assert.equal(mocked?.awardedIsMock, true)
  assert.equal(mocked?.awardedPriceBaht, mockAwardedPrice('69000000002', 1_000_000))
  assert.equal(mocked?.id, 'a2')

  // Cancelled project (S5): no winner, so no price at all
  assert.equal(toFinishedTor({ ...closed, contractStatusCode: 'S5' }, NOW), null)

  // A real awarded price is used as is, even before the deadline
  const real = toFinishedTor(
    {
      ...closed,
      awardedPriceBaht: 950_000,
      submissionDeadlineAt: new Date('2026-10-20T05:00:00Z'),
    },
    NOW,
  )
  assert.equal(real?.awardedIsMock, false)
  assert.equal(real?.awardedPriceBaht, 950_000)

  // No mid price: left out
  assert.equal(toFinishedTor({ ...closed, midPriceBaht: null }, NOW), null)
  assert.equal(toFinishedTor({ ...closed, externalId: '' }, NOW), null)
})

test('toFinishedTor resolves the category', () => {
  const base = {
    _id: 'a3',
    externalId: '69000000003',
    midPriceBaht: 1_000_000,
    awardedPriceBaht: 950_000,
  }
  const stored = toFinishedTor(
    { ...base, category: 'ai_ml', categories: ['ai_ml', 'data_bi'] },
    NOW,
  )
  assert.equal(stored?.category, 'ai_ml')
  assert.deepEqual(stored?.categories, ['ai_ml', 'data_bi'])

  // No stored category: the keyword fallback decides, and categories lists it
  const derived = toFinishedTor({ ...base, category: null, technologies: ['Flutter'] }, NOW)
  assert.equal(derived?.category, 'mobile_app')
  assert.deepEqual(derived?.categories, ['mobile_app'])
  assert.equal(derived?.announceDate, null)
})

test('reportDateOf: announce date, else submission deadline, else analysed date', () => {
  const deadline = new Date('2026-09-01T05:00:00Z')
  const analyzed = new Date('2026-10-04T00:00:00Z')
  const announce = new Date('2026-08-01T00:00:00Z')
  assert.equal(
    reportDateOf({ announceDate: announce, submissionDeadlineAt: deadline, analyzedAt: analyzed }),
    announce,
  )
  assert.equal(
    reportDateOf({ announceDate: null, submissionDeadlineAt: deadline, analyzedAt: analyzed }),
    deadline,
  )
  assert.equal(
    reportDateOf({ announceDate: null, submissionDeadlineAt: null, analyzedAt: analyzed }),
    analyzed,
  )
})
