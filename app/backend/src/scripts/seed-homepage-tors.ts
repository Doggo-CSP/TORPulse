import { pathToFileURL } from 'node:url'

import { database } from '../config/mongoose.js'
import { getBangkokWeekRange } from '../modules/homepage/homepage.controller.js'
import { DataSourceModel } from '../modules/ingestion/data-source.model.js'
import { IngestionJobModel } from '../modules/ingestion/ingestion-job.model.js'
import { TorModel } from '../modules/tor/tor.model.js'
import { upsertTor } from '../modules/tor/tor.repository.js'
import type { UpsertTorInput } from '../modules/tor/tor.types.js'

export const SEED_PREFIX = 'seed-homepage-'

interface SeedDataSource {
  key: string
  name: string
}

const SEED_DATA_SOURCES: SeedDataSource[] = [
  { key: `${SEED_PREFIX}gov`, name: 'Seed GovSpending' },
  { key: `${SEED_PREFIX}central`, name: 'Seed Central eGP' },
]

interface TorFixtureSpec {
  externalId: string
  dataSourceIndex: 0 | 1
  sourceAdapter: 'gov_spending' | 'central_egp' | 'bma_egp'
  agencyName: string | null
  budgetBaht: number | null
  midPriceBaht: number | null
  awardedPriceBaht: number | null
  technologies: string[]
  recency: 'this_week' | 'last_week'
}

// Hand-authored, fixed dataset (not random) so tests can assert exact numbers:
// - 2 dataSourceId values -> total_sources = 2
// - budgetBaht sum of the non-null values = 2,000,000 exactly
// - agencyName has 4 distinct real values plus one null and one empty string (both excluded
//   from departments)
// - technologies chosen to hit every deriveCategory() branch: web_application x4, data_bi x1,
//   mobile_app x2, enterprise_system x3 (10 total; consulting_architecture has no fixtures)
// - 6 fixtures land "this week" and 4 "last week" (Asia/Bangkok) -> new_this_week = 6
//
// midPriceBaht / awardedPriceBaht are set so every fixture that has BOTH values has
// awardedPriceBaht = exactly 90% of midPriceBaht. That keeps every per-category average
// (web_application, data_bi, mobile_app, enterprise_system) an exact integer, and keeps the
// overall paired discount at exactly 10.00% regardless of how many fixtures are paired in a
// given category. Some fixtures deliberately have only one of the two prices set (004 has
// neither, 005 has mid only, 006 has awarded only) to exercise the "not both present" branch
// of the aggregation, which must exclude them from the overall (cross-category) average but
// still let them contribute to their category's individual mid/awarded averages where
// applicable.
export const TOR_FIXTURES: TorFixtureSpec[] = [
  {
    externalId: `${SEED_PREFIX}001`,
    dataSourceIndex: 0,
    sourceAdapter: 'gov_spending',
    agencyName: 'Ministry of Education',
    budgetBaht: 100_000,
    midPriceBaht: 1_000_000,
    awardedPriceBaht: 900_000,
    technologies: ['React', 'Node.js'],
    recency: 'this_week',
  },
  {
    externalId: `${SEED_PREFIX}002`,
    dataSourceIndex: 0,
    sourceAdapter: 'gov_spending',
    agencyName: 'Ministry of Education',
    budgetBaht: 200_000,
    midPriceBaht: 2_000_000,
    awardedPriceBaht: 1_800_000,
    technologies: ['Vue', 'Express'],
    recency: 'this_week',
  },
  {
    externalId: `${SEED_PREFIX}003`,
    dataSourceIndex: 1,
    sourceAdapter: 'central_egp',
    agencyName: 'Ministry of Finance',
    budgetBaht: null,
    midPriceBaht: 3_000_000,
    awardedPriceBaht: 2_700_000,
    technologies: ['Python', 'Power BI'],
    recency: 'this_week',
  },
  {
    externalId: `${SEED_PREFIX}004`,
    dataSourceIndex: 1,
    sourceAdapter: 'central_egp',
    agencyName: 'Ministry of Finance',
    budgetBaht: 300_000,
    midPriceBaht: null,
    awardedPriceBaht: null,
    technologies: ['Flutter'],
    recency: 'this_week',
  },
  {
    externalId: `${SEED_PREFIX}005`,
    dataSourceIndex: 0,
    sourceAdapter: 'bma_egp',
    agencyName: null,
    budgetBaht: 400_000,
    midPriceBaht: 4_000_000,
    awardedPriceBaht: null,
    technologies: ['.NET', 'SAP'],
    recency: 'this_week',
  },
  {
    externalId: `${SEED_PREFIX}006`,
    dataSourceIndex: 1,
    sourceAdapter: 'bma_egp',
    agencyName: '',
    budgetBaht: 500_000,
    midPriceBaht: null,
    awardedPriceBaht: 1_000_000,
    technologies: [],
    recency: 'this_week',
  },
  {
    externalId: `${SEED_PREFIX}007`,
    dataSourceIndex: 0,
    sourceAdapter: 'gov_spending',
    agencyName: 'Ministry of Health',
    budgetBaht: null,
    midPriceBaht: 5_000_000,
    awardedPriceBaht: 4_500_000,
    technologies: ['Android', 'Kotlin'],
    recency: 'last_week',
  },
  {
    externalId: `${SEED_PREFIX}008`,
    dataSourceIndex: 1,
    sourceAdapter: 'central_egp',
    agencyName: 'Ministry of Health',
    budgetBaht: 100_000,
    midPriceBaht: 6_000_000,
    awardedPriceBaht: 5_400_000,
    technologies: ['React', 'Python'],
    recency: 'last_week',
  },
  {
    externalId: `${SEED_PREFIX}009`,
    dataSourceIndex: 0,
    sourceAdapter: 'gov_spending',
    agencyName: 'Ministry of Interior',
    budgetBaht: 250_000,
    midPriceBaht: 7_000_000,
    awardedPriceBaht: 6_300_000,
    technologies: ['Java', 'Oracle'],
    recency: 'last_week',
  },
  {
    externalId: `${SEED_PREFIX}010`,
    dataSourceIndex: 1,
    sourceAdapter: 'central_egp',
    agencyName: 'Ministry of Interior',
    budgetBaht: 150_000,
    midPriceBaht: 8_000_000,
    awardedPriceBaht: 7_200_000,
    technologies: ['Angular'],
    recency: 'last_week',
  },
]

export async function seedHomepageTors(): Promise<void> {
  await TorModel.deleteMany({ externalId: { $regex: `^${SEED_PREFIX}` } })
  await IngestionJobModel.deleteMany({ externalId: { $regex: `^${SEED_PREFIX}` } })
  await DataSourceModel.deleteMany({ key: { $regex: `^${SEED_PREFIX}` } })

  const dataSources = await Promise.all(
    SEED_DATA_SOURCES.map((source) => DataSourceModel.create({ key: source.key, name: source.name })),
  )

  const { start } = getBangkokWeekRange(new Date())
  const thisWeekTimestamp = new Date(Date.now() - 60_000)
  const lastWeekTimestamp = new Date(start.getTime() - 24 * 60 * 60 * 1000)

  for (const fixture of TOR_FIXTURES) {
    const dataSourceId = dataSources[fixture.dataSourceIndex]!._id

    const ingestionJob = await IngestionJobModel.create({
      dataSourceId,
      sourceAdapter: fixture.sourceAdapter,
      externalId: fixture.externalId,
    })

    const input: UpsertTorInput = {
      dataSourceId,
      ingestionJobId: ingestionJob._id,
      externalId: fixture.externalId,
      sourceVersion: 'seed-v1',
      sourceAdapter: fixture.sourceAdapter,
      detailUrl: `https://example.com/${fixture.externalId}`,
      projectTitle: `Seed project ${fixture.externalId}`,
      agencyName: fixture.agencyName,
      summary: null,
      objectives: [],
      requirements: [],
      bidderQualifications: [],
      technologies: fixture.technologies,
      budgetBaht: fixture.budgetBaht,
      midPriceBaht: fixture.midPriceBaht,
      awardedPriceBaht: fixture.awardedPriceBaht,
      submissionDeadline: null,
      contactInformation: [],
      classificationReason: 'Seed fixture for homepage API tests',
      confidence: 0.9,
      analysisModel: 'seed-script',
      analysisVersion: 'v1',
      analyzedAt: new Date(),
      documents: [],
    }

    const tor = await upsertTor(input)
    if (!tor) {
      throw new Error(`Failed to seed TOR ${fixture.externalId}`)
    }

    const updatedAt = fixture.recency === 'this_week' ? thisWeekTimestamp : lastWeekTimestamp
    await TorModel.collection.updateOne({ _id: tor._id }, { $set: { updatedAt } })
  }
}

async function main(): Promise<void> {
  await database.connect()
  try {
    await seedHomepageTors()
    console.log(`Seeded ${TOR_FIXTURES.length} homepage TOR fixtures`)
  } finally {
    await database.disconnect()
  }
}

const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  main().catch((error: unknown) => {
    console.error('Homepage TOR seed failed:', error)
    process.exitCode = 1
  })
}