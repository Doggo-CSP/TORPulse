import { pathToFileURL } from 'node:url'

import { database } from '../config/mongoose.js'
import { DataSourceModel } from '../modules/ingestion/data-source.model.js'
import { IngestionJobModel } from '../modules/ingestion/ingestion-job.model.js'
import { TorModel } from '../modules/tor/tor.model.js'
import { upsertTor } from '../modules/tor/tor.repository.js'
import type { UpsertTorInput } from '../modules/tor/tor.types.js'

export const SEED_PREFIX = 'seed-report-'

// Fixed department shorthands used throughout this seed's comments/tables.
const D1 = 'สำนักการโยธา กทม.'
const D2 = 'สำนักการแพทย์ กทม.'
const D3 = 'สำนักป้องกันและบรรเทาสาธารณภัย'
// D4/D5/D6 are intentionally never used by any fixture below — they are the
// "department filter matches nothing" test case (all 5 categories returned
// with project_count: 0 and null prices).

const daysAgo = (days: number): Date => new Date(Date.now() - days * 24 * 60 * 60 * 1000)

interface ClosedFixtureSpec {
  externalId: string
  technologies: string[]
  department: string
  referencePriceBaht: number
  winningPriceBaht: number
  announcementDaysAgo: number // recent=30 (in 6m), mid=270 (in 1y, out 6m), old=730 (in 3y, out 1y), ancient=1500 (out 3y)
}

// Hand-authored, fixed dataset (not random) so tests can assert exact numbers.
// 2 closed fixtures per category, prices chosen so every average is an exact
// 1-decimal value:
//   mobile_app:               10.0 / 8.5  / -15.0  (n=2)
//   data_bi:                  20.0 / 18.0 / -10.0  (n=2)
//   web_application:          15.0 / 12.8 / -15.0  (n=2)  (12.75 -> rounds to 12.8)
//   enterprise_system:         6.0 / 5.6  / -7.5   (n=2)  (5.55 -> rounds to 5.6)
//   consulting_architecture:  40.0 / 37.0 / -7.5   (n=2)
// Overall (unfiltered, period=all): 18.2 / 16.4 / -11.0 (n=10) (16.36 -> rounds to 16.4)
export const CLOSED_FIXTURES: ClosedFixtureSpec[] = [
  {
    externalId: `${SEED_PREFIX}closed-001`,
    technologies: ['Flutter'],
    department: D1,
    referencePriceBaht: 10_000_000,
    winningPriceBaht: 8_000_000,
    announcementDaysAgo: 30,
  },
  {
    externalId: `${SEED_PREFIX}closed-002`,
    technologies: ['Kotlin'],
    department: D2,
    referencePriceBaht: 10_000_000,
    winningPriceBaht: 9_000_000,
    announcementDaysAgo: 270,
  },
  {
    externalId: `${SEED_PREFIX}closed-003`,
    technologies: ['Python', 'Power BI'],
    department: D1,
    referencePriceBaht: 20_000_000,
    winningPriceBaht: 17_000_000,
    announcementDaysAgo: 30,
  },
  {
    externalId: `${SEED_PREFIX}closed-004`,
    technologies: ['SQL Server'],
    department: D3,
    referencePriceBaht: 20_000_000,
    winningPriceBaht: 19_000_000,
    announcementDaysAgo: 1500,
  },
  {
    externalId: `${SEED_PREFIX}closed-005`,
    technologies: ['React', 'Node.js'],
    department: D2,
    referencePriceBaht: 15_000_000,
    winningPriceBaht: 12_000_000,
    announcementDaysAgo: 30,
  },
  {
    externalId: `${SEED_PREFIX}closed-006`,
    technologies: ['Vue'],
    department: D1,
    referencePriceBaht: 15_000_000,
    winningPriceBaht: 13_500_000,
    announcementDaysAgo: 730,
  },
  {
    externalId: `${SEED_PREFIX}closed-007`,
    technologies: ['.NET', 'SAP'],
    department: D3,
    referencePriceBaht: 6_000_000,
    winningPriceBaht: 5_400_000,
    announcementDaysAgo: 30,
  },
  {
    externalId: `${SEED_PREFIX}closed-008`,
    technologies: ['COBOL', 'Mainframe'],
    department: D1,
    referencePriceBaht: 6_000_000,
    winningPriceBaht: 5_700_000,
    announcementDaysAgo: 1500,
  },
  {
    externalId: `${SEED_PREFIX}closed-009`,
    technologies: ['IT Consulting'],
    department: D2,
    referencePriceBaht: 40_000_000,
    winningPriceBaht: 36_000_000,
    announcementDaysAgo: 30,
  },
  {
    externalId: `${SEED_PREFIX}closed-010`,
    technologies: ['Enterprise Architecture Advisory'],
    department: D1,
    referencePriceBaht: 40_000_000,
    winningPriceBaht: 38_000_000,
    announcementDaysAgo: 730,
  },
]

interface OpenFixtureSpec {
  externalId: string
  technologies: string[]
  department: string
  referencePriceBaht: number
}

// Currently-open projects (no winner yet) used only by price-overview's
// current_vs_historical bucket. Not filtered by period, so no date bucketing
// needed here — announcementDate is set to a recent, arbitrary date.
// current_avg_reference_price (unfiltered) = (12+16+8+24)/4 = 15.0, n=4
export const OPEN_FIXTURES: OpenFixtureSpec[] = [
  {
    externalId: `${SEED_PREFIX}open-001`,
    technologies: ['React'],
    department: D1,
    referencePriceBaht: 12_000_000,
  },
  {
    externalId: `${SEED_PREFIX}open-002`,
    technologies: ['React'],
    department: D1,
    referencePriceBaht: 16_000_000,
  },
  {
    externalId: `${SEED_PREFIX}open-003`,
    technologies: ['.NET'],
    department: D3,
    referencePriceBaht: 8_000_000,
  },
  {
    externalId: `${SEED_PREFIX}open-004`,
    technologies: ['Python'],
    department: D2,
    referencePriceBaht: 24_000_000,
  },
]

function baseInput(
  externalId: string,
  technologies: string[],
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
    agencyName: null,
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
      ...baseInput(fixture.externalId, fixture.technologies, dataSource._id, ingestionJob._id),
      department: fixture.department,
      status: 'closed',
      referencePriceBaht: fixture.referencePriceBaht,
      winningPriceBaht: fixture.winningPriceBaht,
      announcementDate: daysAgo(fixture.announcementDaysAgo),
      contractSignedDate: daysAgo(Math.max(fixture.announcementDaysAgo - 15, 0)),
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
      ...baseInput(fixture.externalId, fixture.technologies, dataSource._id, ingestionJob._id),
      department: fixture.department,
      status: 'open',
      referencePriceBaht: fixture.referencePriceBaht,
      winningPriceBaht: null,
      announcementDate: daysAgo(10),
      contractSignedDate: null,
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
