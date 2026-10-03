import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

import { env } from '../../config/env.js'
import { BmaDiscoveryAdapter } from '../../modules/ingestion/adapters/bma-discovery.adapter.js'
import {
  getThaiFiscalYear,
  GovSpendingDiscoveryAdapter,
} from '../../modules/ingestion/adapters/govspending-discovery.adapter.js'
import { DataSourceModel } from '../../modules/ingestion/data-source.model.js'
import {
  claimProducerLease,
  ensureBmaDataSource,
  ensureGovSpendingDataSource,
  releaseProducerLease,
  renewProducerLease,
} from '../../modules/ingestion/data-source.repository.js'
import { IngestionJobModel } from '../../modules/ingestion/ingestion-job.model.js'
import { enqueueDiscoveredProjects } from '../../modules/ingestion/ingestion-job.repository.js'
import { updateTorSourceMetadata } from '../../modules/tor/tor.repository.js'

const PAGE_SIZE = 1_000
const BMA_PAGE_SIZE = 100

type DataSourceId = typeof DataSourceModel.prototype._id

interface SyncTotals {
  pages: number
  discovered: number
  queued: number
  existing: number
  torsUpdated: number
  failedKeywords: string[]
}

interface DiscoverySource {
  label: string
  ensureDataSource: () => ReturnType<typeof ensureGovSpendingDataSource>
  sync: (dataSourceId: DataSourceId, producerId: string, signal: AbortSignal) => Promise<SyncTotals>
}

class ProducerLeaseLostError extends Error {}

export async function startQueueProducer(signal: AbortSignal): Promise<void> {
  const sources = configuredSources()
  if (sources.length === 0) {
    throw new Error(
      'No discovery source is configured: set GOVSPENDING_API_KEY or BMA_SYNC_ENABLED=true',
    )
  }

  const producerId = `queue-producer-${randomUUID()}`

  await Promise.all([DataSourceModel.init(), IngestionJobModel.init()])
  console.log(
    `Queue producer started: ${producerId} (${sources.map(({ label }) => label).join(', ')})`,
  )

  while (!signal.aborted) {
    for (const source of sources) {
      try {
        await runScheduledSync(source, producerId, signal)
      } catch (error) {
        if (!signal.aborted) {
          console.error(`${source.label} sync failed`, error)
        }
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

function configuredSources(): DiscoverySource[] {
  const sources: DiscoverySource[] = []

  if (env.GOVSPENDING_API_KEY) {
    const adapter = new GovSpendingDiscoveryAdapter({ apiKey: env.GOVSPENDING_API_KEY })
    sources.push({
      label: 'GovSpending',
      ensureDataSource: ensureGovSpendingDataSource,
      sync: (dataSourceId, producerId, signal) =>
        syncGovSpendingProjects(
          dataSourceId,
          producerId,
          adapter,
          env.GOVSPENDING_FISCAL_YEAR ?? getThaiFiscalYear(),
          env.GOVSPENDING_KEYWORDS,
          signal,
        ),
    })
  }

  if (env.BMA_SYNC_ENABLED) {
    const adapter = new BmaDiscoveryAdapter()
    sources.push({
      label: 'BMA',
      ensureDataSource: ensureBmaDataSource,
      sync: (dataSourceId, producerId, signal) =>
        syncBmaProjects(
          dataSourceId,
          producerId,
          adapter,
          env.BMA_BUDGET_YEAR ?? getThaiFiscalYear(),
          env.BMA_KEYWORDS,
          signal,
        ),
    })
  }

  return sources
}

async function runScheduledSync(
  source: DiscoverySource,
  producerId: string,
  signal: AbortSignal,
): Promise<void> {
  const dataSource = await source.ensureDataSource()
  if (!dataSource) {
    throw new Error(`Could not initialize the ${source.label} data source`)
  }

  if (!(await claimProducerLease(dataSource._id, producerId))) {
    console.log(`${source.label} sync skipped because another producer owns the lease`)
    return
  }

  const startedAt = Date.now()
  let syncError: unknown

  try {
    const totals = await source.sync(dataSource._id, producerId, signal)

    if (totals.failedKeywords.length > 0) {
      throw new Error(`${source.label} keywords failed: ${totals.failedKeywords.join(', ')}`)
    }

    console.log(`${source.label} sync completed`, {
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

function emptyTotals(): SyncTotals {
  return {
    pages: 0,
    discovered: 0,
    queued: 0,
    existing: 0,
    torsUpdated: 0,
    failedKeywords: [],
  }
}

async function syncGovSpendingProjects(
  dataSourceId: DataSourceId,
  producerId: string,
  adapter: GovSpendingDiscoveryAdapter,
  fiscalYear: number,
  keywords: string[],
  signal: AbortSignal,
): Promise<SyncTotals> {
  const totals = emptyTotals()

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
        totals.torsUpdated += await updateTorSourceMetadata(dataSourceId, page.projects)

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

async function syncBmaProjects(
  dataSourceId: DataSourceId,
  producerId: string,
  adapter: BmaDiscoveryAdapter,
  budgetYear: number,
  keywords: string[],
  signal: AbortSignal,
): Promise<SyncTotals> {
  const totals = emptyTotals()

  for (const keyword of keywords) {
    try {
      for (let pageNo = 1; !signal.aborted; pageNo += 1) {
        const page = await adapter.listProjects({
          budgetYear,
          keyword,
          pageNo,
          pageSize: BMA_PAGE_SIZE,
          signal,
        })
        const queueResult = await enqueueDiscoveredProjects(dataSourceId, page.projects, 'bma_egp')
        totals.torsUpdated += await updateTorSourceMetadata(dataSourceId, page.projects)

        totals.pages += 1
        totals.discovered += page.projects.length
        totals.queued += queueResult.queued
        totals.existing += queueResult.existing

        if (!(await renewProducerLease(dataSourceId, producerId))) {
          throw new ProducerLeaseLostError('Queue producer lost the BMA lease')
        }

        if (!page.hasNextPage || page.projects.length + page.skipped === 0) {
          break
        }
      }
    } catch (error) {
      if (error instanceof ProducerLeaseLostError || signal.aborted) {
        throw error
      }

      totals.failedKeywords.push(keyword)
      console.error('BMA keyword sync failed', { keyword, budgetYear, error })
    }
  }

  return totals
}
