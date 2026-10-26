import { setTimeout as delay } from 'node:timers/promises'
import { parseArgs } from 'node:util'

import { database } from '../config/mongoose.js'
import {
  EgpTokenRejectedError,
  listAnnouncements,
  tokenMinutesLeft,
} from '../modules/ingestion/adapters/egp-announcement-discovery.adapter.js'
import { getThaiFiscalYear } from '../modules/ingestion/thai-date.js'
import { ensureCentralEgpDataSource } from '../modules/ingestion/data-source.repository.js'
import { IngestionJobModel } from '../modules/ingestion/ingestion-job.model.js'
import { enqueueDiscoveredProjects } from '../modules/ingestion/ingestion-job.repository.js'

// Usage:
//   EGP_ANNOUNCEMENT_TOKEN=<token> npm run discover:egp -- [--announce-type 1,2,3]
//     [--budget-year 2570] [--max-pages 50] [--dry-run]
//
// Projects still open for bidding (ร่างประกาศ / ประกาศเชิญชวน) are discovered from the eGP
// announcement search and queued for the normal ingestion worker.
//
// The search is gated by Cloudflare Turnstile, so the token must come from a real browser
// session: open https://process5.gprocurement.go.th/egp-agpc01-web/announcement, run a search,
// then copy the X-Announcement-Token request header from DevTools > Network. It expires ~20
// minutes after it is issued.

// Same pacing as CentralEgpAdapter (EGP_MIN_REQUEST_INTERVAL_MS).
const EGP_REQUEST_GAP_MS = 1_200

interface TypeTotals {
  pages: number
  discovered: number
  queued: number
  existing: number
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'announce-type': { type: 'string', default: '1,2,3' },
      'budget-year': { type: 'string' },
      'max-pages': { type: 'string', default: '50' },
      'dry-run': { type: 'boolean', default: false },
    },
  })

  const token = process.env.EGP_ANNOUNCEMENT_TOKEN?.trim()
  if (!token) {
    throw new Error('EGP_ANNOUNCEMENT_TOKEN is not set (see usage at the top of this script)')
  }
  const minutesLeft = tokenMinutesLeft(token)
  if (minutesLeft !== null && minutesLeft < 0) {
    throw new EgpTokenRejectedError(`Token expired ${-minutesLeft} min ago`)
  }

  const budgetYear = values['budget-year'] ? Number(values['budget-year']) : getThaiFiscalYear()
  const maxPages = Number(values['max-pages'])
  const announceTypes = values['announce-type'].split(',').map((type) => type.trim())
  const dryRun = values['dry-run']

  await database.connect()

  try {
    await IngestionJobModel.init()
    const dataSource = await ensureCentralEgpDataSource()
    if (!dataSource) {
      throw new Error('Could not initialize the Central e-GP data source')
    }

    const totals: Record<string, TypeTotals> = {}
    let tokenRejected = false

    for (const announceType of announceTypes) {
      const typeTotals: TypeTotals = { pages: 0, discovered: 0, queued: 0, existing: 0 }
      totals[announceType] = typeTotals

      for (let page = 1; page <= maxPages; page += 1) {
        let projects
        try {
          projects = await listAnnouncements({ token, budgetYear, announceType, page })
        } catch (error) {
          if (error instanceof EgpTokenRejectedError) {
            console.error(error.message)
            tokenRejected = true
            break
          }
          throw error
        }
        if (projects.length === 0) break

        typeTotals.pages += 1
        typeTotals.discovered += projects.length
        if (!dryRun) {
          const result = await enqueueDiscoveredProjects(dataSource._id, projects)
          typeTotals.queued += result.queued
          typeTotals.existing += result.existing
        }

        await delay(EGP_REQUEST_GAP_MS)
      }

      if (tokenRejected) break
    }

    console.log(dryRun ? 'Dry run: eGP announcements found' : 'eGP announcement discovery', {
      budgetYear,
      totals,
    })
    if (tokenRejected) process.exitCode = 1
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('eGP announcement discovery failed:', error)
  process.exitCode = 1
})
