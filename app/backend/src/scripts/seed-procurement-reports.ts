import { pathToFileURL } from 'node:url'

import { database } from '../config/mongoose.js'
import { DataSourceModel } from '../modules/ingestion/data-source.model.js'
import { IngestionJobModel } from '../modules/ingestion/ingestion-job.model.js'
import { TorModel } from '../modules/tor/tor.model.js'
import { upsertTor } from '../modules/tor/tor.repository.js'
import type { UpsertTorInput } from '../modules/tor/tor.types.js'

export const SEED_PREFIX = 'seed-report-'

export const SEED_AGENCY_ALPHA = 'Seed Agency Alpha'
export const SEED_AGENCY_BETA = 'Seed Agency Beta'

const daysAgo = (days: number): Date => new Date(Date.now() - days * 24 * 60 * 60 * 1000)

interface ClosedFixtureSpec {
  externalId: string
  technologies: string[]
  agencyName: string | null
  midPriceBaht: number
  awardedPriceBaht: number
  analyzedAtDaysAgo: number
}

// Hand-authored, fixed dataset (not random). Every fixture uses the same
// midPriceBaht (10,000,000 baht = 10.0 million) so savings_pct and
// savings_amount are trivial to hand-verify, and every awardedPriceBaht is
// chosen to land the fixture's savings_pct in a distinct spot:
//   SA (agencyName=Seed Agency Alpha, analyzedAt 30 days ago -> "recent"):
//     mobile_app x2:  20.0%, 10.0%
//     data_bi x2:      8.0%,  6.0%
//     web_application: -5.0%  (over budget -> NOT below-reference)
//   SB (agencyName=Seed Agency Beta, analyzedAt 730 days ago -> "old", outside 1y/6m):
//     web_application:  3.0%
//     enterprise_system x2: 12.0%, 14.0%
//     consulting_architecture x2: 18.0%, 16.0%
//
// Hand-computed expectations (agencyName=Seed Agency Alpha, period=all or 6m):
//   project_count=5, total_mid_price=50.0, total_awarded_price=46.1,
//   total_savings=3.9, overall_savings_pct=7.8, avg_mid_price=10.0,
//   avg_savings_baht=0.78, pct_projects_below_reference=80.0 (4/5),
//   max_savings_pct=20.0
// Hand-computed expectations (agencyName=Seed Agency Beta, period=all or 3y):
//   project_count=5, total_mid_price=50.0, total_awarded_price=43.7,
//   total_savings=6.3, overall_savings_pct=12.6, avg_mid_price=10.0,
//   avg_savings_baht=1.26, pct_projects_below_reference=100.0 (5/5),
//   max_savings_pct=18.0
// agencyName=Seed Agency Beta + period=1y -> 0 matches (730 days is outside 1y).
export const CLOSED_FIXTURES: ClosedFixtureSpec[] = [
  {
    externalId: `${SEED_PREFIX}closed-001`,
    technologies: ['Flutter'],
    agencyName: SEED_AGENCY_ALPHA,
    midPriceBaht: 10_000_000,
    awardedPriceBaht: 8_000_000, // savings_pct 20.0
    analyzedAtDaysAgo: 30,
  },
  {
    externalId: `${SEED_PREFIX}closed-002`,
    technologies: ['Kotlin'],
    agencyName: SEED_AGENCY_ALPHA,
    midPriceBaht: 10_000_000,
    awardedPriceBaht: 9_000_000, // savings_pct 10.0
    analyzedAtDaysAgo: 30,
  },
  {
    externalId: `${SEED_PREFIX}closed-003`,
    technologies: ['Python', 'Power BI'],
    agencyName: SEED_AGENCY_ALPHA,
    midPriceBaht: 10_000_000,
    awardedPriceBaht: 9_200_000, // savings_pct 8.0
    analyzedAtDaysAgo: 30,
  },
  {
    externalId: `${SEED_PREFIX}closed-004`,
    technologies: ['SQL Server'],
    agencyName: SEED_AGENCY_ALPHA,
    midPriceBaht: 10_000_000,
    awardedPriceBaht: 9_400_000, // savings_pct 6.0
    analyzedAtDaysAgo: 30,
  },
  {
    externalId: `${SEED_PREFIX}closed-005`,
    technologies: ['Vue'],
    agencyName: SEED_AGENCY_ALPHA,
    midPriceBaht: 10_000_000,
    awardedPriceBaht: 10_500_000, // savings_pct -5.0 (over budget)
    analyzedAtDaysAgo: 30,
  },
  {
    externalId: `${SEED_PREFIX}closed-006`,
    technologies: ['React', 'Node.js'],
    agencyName: SEED_AGENCY_BETA,
    midPriceBaht: 10_000_000,
    awardedPriceBaht: 9_700_000, // savings_pct 3.0
    analyzedAtDaysAgo: 730,
  },
  {
    externalId: `${SEED_PREFIX}closed-007`,
    technologies: ['.NET', 'SAP'],
    agencyName: SEED_AGENCY_BETA,
    midPriceBaht: 10_000_000,
    awardedPriceBaht: 8_800_000, // savings_pct 12.0
    analyzedAtDaysAgo: 730,
  },
  {
    externalId: `${SEED_PREFIX}closed-008`,
    technologies: ['COBOL', 'Mainframe'],
    agencyName: SEED_AGENCY_BETA,
    midPriceBaht: 10_000_000,
    awardedPriceBaht: 8_600_000, // savings_pct 14.0
    analyzedAtDaysAgo: 730,
  },
  {
    externalId: `${SEED_PREFIX}closed-009`,
    technologies: ['IT Consulting'],
    agencyName: SEED_AGENCY_BETA,
    midPriceBaht: 10_000_000,
    awardedPriceBaht: 8_200_000, // savings_pct 18.0
    analyzedAtDaysAgo: 730,
  },
  {
    externalId: `${SEED_PREFIX}closed-010`,
    technologies: ['Enterprise Architecture Advisory'],
    agencyName: SEED_AGENCY_BETA,
    midPriceBaht: 10_000_000,
    awardedPriceBaht: 8_400_000, // savings_pct 16.0
    analyzedAtDaysAgo: 730,
  },
  {
    // agencyName: null -> exercises the "อื่นๆ" department bucket.
    externalId: `${SEED_PREFIX}closed-011`,
    technologies: ['Django'],
    agencyName: null,
    midPriceBaht: 10_000_000,
    awardedPriceBaht: 9_000_000, // savings_pct 10.0
    analyzedAtDaysAgo: 30,
  },
]

interface OpenFixtureSpec {
  externalId: string
  technologies: string[]
  agencyName: string
  midPriceBaht: number
  analyzedAtDaysAgo: number
}

// Not-yet-awarded projects (awardedPriceBaht: null) — must be excluded from
// every report endpoint's aggregates, since all of them gate on
// awardedPriceBaht != null.
export const OPEN_FIXTURES: OpenFixtureSpec[] = [
  {
    externalId: `${SEED_PREFIX}open-001`,
    technologies: ['React'],
    agencyName: SEED_AGENCY_ALPHA,
    midPriceBaht: 12_000_000,
    analyzedAtDaysAgo: 5,
  },
  {
    externalId: `${SEED_PREFIX}open-002`,
    technologies: ['Python'],
    agencyName: SEED_AGENCY_BETA,
    midPriceBaht: 9_000_000,
    analyzedAtDaysAgo: 5,
  },
]

function baseInput(
  externalId: string,
  technologies: string[],
  agencyName: string | null,
  dataSourceId: UpsertTorInput['dataSourceId'],
  ingestionJobId: UpsertTorInput['ingestionJobId'],
): UpsertTorInput {
  return {
    dataSourceId,
    ingestionJobId,
    externalId,
    sourceVersion: 'seed-v1',
    sourceAdapter: 'gov_spending',
    detailUrl: `https://example.com/${externalId}`,
    projectTitle: `Seed procurement report project ${externalId}`,
    agencyName,
    summary: null,
    objectives: [],
    requirements: [],
    bidderQualifications: [],
    technologies,
    budgetBaht: null,
    submissionDeadline: null,
    contactInformation: [],
    classificationReason: 'Seed fixture for procurement report API tests',
    confidence: 0.9,
    analysisModel: 'seed-script',
    analysisVersion: 'v1',
    analyzedAt: new Date(),
    documents: [],
  }
}

export async function seedProcurementReports(): Promise<void> {
  await TorModel.deleteMany({ externalId: { $regex: `^${SEED_PREFIX}` } })
  await IngestionJobModel.deleteMany({ externalId: { $regex: `^${SEED_PREFIX}` } })
  await DataSourceModel.deleteMany({ key: { $regex: `^${SEED_PREFIX}` } })

  const dataSource = await DataSourceModel.create({
    key: `${SEED_PREFIX}ds`,
    name: 'Seed Procurement Reports',
  })

  for (const fixture of CLOSED_FIXTURES) {
    const ingestionJob = await IngestionJobModel.create({
      dataSourceId: dataSource._id,
      sourceAdapter: 'gov_spending',
      externalId: fixture.externalId,
    })

    const input: UpsertTorInput = {
      ...baseInput(
        fixture.externalId,
        fixture.technologies,
        fixture.agencyName,
        dataSource._id,
        ingestionJob._id,
      ),
      midPriceBaht: fixture.midPriceBaht,
      awardedPriceBaht: fixture.awardedPriceBaht,
      analyzedAt: daysAgo(fixture.analyzedAtDaysAgo),
    }

    const tor = await upsertTor(input)
    if (!tor) {
      throw new Error(`Failed to seed closed TOR ${fixture.externalId}`)
    }
  }

  for (const fixture of OPEN_FIXTURES) {
    const ingestionJob = await IngestionJobModel.create({
      dataSourceId: dataSource._id,
      sourceAdapter: 'gov_spending',
      externalId: fixture.externalId,
    })

    const input: UpsertTorInput = {
      ...baseInput(
        fixture.externalId,
        fixture.technologies,
        fixture.agencyName,
        dataSource._id,
        ingestionJob._id,
      ),
      midPriceBaht: fixture.midPriceBaht,
      awardedPriceBaht: null,
      analyzedAt: daysAgo(fixture.analyzedAtDaysAgo),
    }

    const tor = await upsertTor(input)
    if (!tor) {
      throw new Error(`Failed to seed open TOR ${fixture.externalId}`)
    }
  }
}

async function main(): Promise<void> {
  await database.connect()
  try {
    await seedProcurementReports()
    console.log(
      `Seeded ${CLOSED_FIXTURES.length} closed + ${OPEN_FIXTURES.length} open procurement report fixtures`,
    )
  } finally {
    await database.disconnect()
  }
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  main().catch((error: unknown) => {
    console.error('Procurement report seed failed:', error)
    process.exitCode = 1
  })
}
