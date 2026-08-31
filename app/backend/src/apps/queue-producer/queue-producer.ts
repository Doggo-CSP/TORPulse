import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

import { env } from '../../config/env.js'
import {
  getThaiFiscalYear,
  GovSpendingDiscoveryAdapter,
} from '../../modules/ingestion/adapters/govspending-discovery.adapter.js'
import { DataSourceModel } from '../../modules/ingestion/data-source.model.js'
import {
  claimProducerLease,
  ensureGovSpendingDataSource,
  releaseProducerLease,
  renewProducerLease,
} from '../../modules/ingestion/data-source.repository.js'
import { IngestionJobModel } from '../../modules/ingestion/ingestion-job.model.js'
import { enqueueDiscoveredProjects } from '../../modules/ingestion/ingestion-job.repository.js'

const PAGE_SIZE = 1_000

interface SyncTotals {
  pages: number
  discovered: number
  queued: number
  existing: number
  failedKeywords: string[]
}

class ProducerLeaseLostError extends Error {}

export async function startQueueProducer(signal: AbortSignal): Promise<void> {
  if (!env.GOVSPENDING_API_KEY) {
    throw new Error('GOVSPENDING_API_KEY is required to start the queue producer')
  }

  const producerId = `queue-producer-${randomUUID()}`
  const adapter = new GovSpendingDiscoveryAdapter({ apiKey: env.GOVSPENDING_API_KEY })

  await Promise.all([DataSourceModel.init(), IngestionJobModel.init()])
  console.log(`Queue producer started: ${producerId}`)

  while (!signal.aborted) {
    try {
      await runScheduledSync(producerId, adapter, signal)
    } catch (error) {
      if (!signal.aborted) {
        console.error('Queue producer sync failed', error)
      }
    }

    try {
      await delay(env.GOVSPENDING_SYNC_INTERVAL_MS, undefined, { signal })
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        throw error
      }
    }
  }

  console.log('Queue producer stopped')
}

async function runScheduledSync(
  producerId: string,
  adapter: GovSpendingDiscoveryAdapter,
  signal: AbortSignal,
): Promise<void> {
  const dataSource = await ensureGovSpendingDataSource()
  if (!dataSource) {
    throw new Error('Could not initialize the GovSpending data source')
  }

  if (!(await claimProducerLease(dataSource._id, producerId))) {
    console.log('GovSpending sync skipped because another producer owns the lease')
    return
  }

  const startedAt = Date.now()
  let syncError: unknown

  try {
    const fiscalYear = env.GOVSPENDING_FISCAL_YEAR ?? getThaiFiscalYear()
    const totals = await syncGovSpendingProjects(
      dataSource._id,
      producerId,
      adapter,
      fiscalYear,
      env.GOVSPENDING_KEYWORDS,
      signal,
    )

    if (totals.failedKeywords.length > 0) {
      throw new Error(`GovSpending keywords failed: ${totals.failedKeywords.join(', ')}`)
    }

    console.log('GovSpending sync completed', {
      fiscalYear,
      ...totals,
      durationMs: Date.now() - startedAt,
    })
  } catch (error) {
    syncError = error
    throw error
  } finally {
    await releaseProducerLease(dataSource._id, producerId, syncError)
  }
}

async function syncGovSpendingProjects(
  dataSourceId: typeof DataSourceModel.prototype._id,
  producerId: string,
  adapter: GovSpendingDiscoveryAdapter,
  fiscalYear: number,
  keywords: string[],
  signal: AbortSignal,
): Promise<SyncTotals> {
  const totals: SyncTotals = {
    pages: 0,
    discovered: 0,
    queued: 0,
    existing: 0,
    failedKeywords: [],
  }

  for (const keyword of keywords) {
    try {
      let offset = 0

      while (!signal.aborted) {
        const page = await adapter.listProjects({
          fiscalYear,
          keyword,
          offset,
          limit: PAGE_SIZE,
          signal,
        })
        const queueResult = await enqueueDiscoveredProjects(dataSourceId, page.projects)

        totals.pages += 1
        totals.discovered += page.projects.length
        totals.queued += queueResult.queued
        totals.existing += queueResult.existing

        if (!(await renewProducerLease(dataSourceId, producerId))) {
          throw new ProducerLeaseLostError('Queue producer lost the GovSpending lease')
        }

        offset += page.projects.length
        if (page.projects.length === 0 || offset >= page.total) {
          break
        }
      }
    } catch (error) {
      if (error instanceof ProducerLeaseLostError || signal.aborted) {
        throw error
      }

      totals.failedKeywords.push(keyword)
      console.error('GovSpending keyword sync failed', { keyword, error })
    }
  }

  return totals
}
