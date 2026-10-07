import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

import type { Types } from 'mongoose'

import { env } from '../../config/env.js'
import { createAuditLog } from '../../modules/admin/audit-log.repository.js'
import { getSettings } from '../../modules/admin/settings.repository.js'
import { BmaDiscoveryAdapter } from '../../modules/ingestion/adapters/bma-discovery.adapter.js'
import {
  getThaiFiscalYear,
  GovSpendingDiscoveryAdapter,
  GovSpendingRequestError,
} from '../../modules/ingestion/adapters/govspending-discovery.adapter.js'
import {
  expireStaleCollectionRuns,
  finishCollectionRun,
  startCollectionRun,
} from '../../modules/ingestion/collection-run.repository.js'
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

export interface DiscoverySource {
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

function govSpendingSource(adapter: GovSpendingDiscoveryAdapter): DiscoverySource {
  return {
    label: 'GovSpending',
    ensureDataSource: ensureGovSpendingDataSource,
    sync: (dataSourceId, producerId, signal) =>
      syncGovSpendingProjects(
        dataSourceId,
        producerId,
        adapter,
        govSpendingFiscalYears(),
        env.GOVSPENDING_KEYWORDS,
        signal,
      ),
  }
}

function configuredSources(): DiscoverySource[] {
  const sources: DiscoverySource[] = []

  if (env.GOVSPENDING_API_KEY) {
    sources.push(
      govSpendingSource(new GovSpendingDiscoveryAdapter({ apiKey: env.GOVSPENDING_API_KEY })),
    )
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
          env.BMA_BUDGET_YEARS ?? [getThaiFiscalYear()],
          env.BMA_KEYWORDS,
          signal,
        ),
    })
  }

  return sources
}

export async function runScheduledSync(
  source: DiscoverySource,
  producerId: string,
  signal: AbortSignal,
): Promise<void> {
  // Only scheduled runs honour the admin switch; a manual "sync now" always runs.
  const { ingestionEnabled } = await getSettings()
  if (!ingestionEnabled) {
    console.log(`${source.label} sync skipped because automatic ingestion is turned off`)
    return
  }

  const claim = await beginSync(source, producerId, { trigger: 'scheduled' })
  if (!claim) {
    console.log(`${source.label} sync skipped because another producer owns the lease`)
    return
  }

  await completeSync(claim, source, producerId, signal, { trigger: 'scheduled' })
}

export interface SyncTrigger {
  trigger: 'scheduled' | 'manual'
  triggeredBy?: Types.ObjectId | null
  triggeredByName?: string | null
}

export interface SyncClaim {
  dataSourceId: Types.ObjectId
  runId: Types.ObjectId
}

// Claims the source's shared lease and records a running CollectionRun. Returns null when
// another run (scheduled or manual, in any process) already holds the lease.
async function beginSync(
  source: Pick<DiscoverySource, 'label' | 'ensureDataSource'>,
  producerId: string,
  trigger: SyncTrigger,
): Promise<SyncClaim | null> {
  const dataSource = await source.ensureDataSource()
  if (!dataSource) {
    throw new Error(`Could not initialize the ${source.label} data source`)
  }

  if (!(await claimProducerLease(dataSource._id, producerId))) {
    return null
  }

  // We hold the lease now, so any run still marked running belongs to a process that died
  await expireStaleCollectionRuns()

  const run = await startCollectionRun({
    trigger: trigger.trigger,
    triggeredBy: trigger.triggeredBy ?? null,
  })
  return { dataSourceId: dataSource._id, runId: run._id }
}

async function completeSync(
  claim: SyncClaim,
  source: DiscoverySource,
  producerId: string,
  signal: AbortSignal,
  trigger: SyncTrigger,
): Promise<void> {
  const startedAt = Date.now()
  let syncError: unknown
  let totals = emptyTotals()

  try {
    totals = await source.sync(claim.dataSourceId, producerId, signal)

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
    await releaseProducerLease(claim.dataSourceId, producerId, syncError)
    await recordRunResult(claim, source, trigger, totals, syncError)
  }
}

// Manual "sync now" from the admin panel (GovSpending only). Shares the scheduled lease.
export function beginGovSpendingSync(
  producerId: string,
  trigger: SyncTrigger,
): Promise<SyncClaim | null> {
  return beginSync(
    { label: 'GovSpending', ensureDataSource: ensureGovSpendingDataSource },
    producerId,
    trigger,
  )
}

export function completeGovSpendingSync(
  claim: SyncClaim,
  producerId: string,
  adapter: GovSpendingDiscoveryAdapter,
  signal: AbortSignal,
  trigger: SyncTrigger,
): Promise<void> {
  return completeSync(claim, govSpendingSource(adapter), producerId, signal, trigger)
}

// Closes the CollectionRun and writes ingestion.completed / ingestion.failed so the run shows
// up in the admin activity feed. Failures here are logged, never thrown over the sync result.
async function recordRunResult(
  claim: SyncClaim,
  source: DiscoverySource,
  trigger: SyncTrigger,
  totals: SyncTotals,
  syncError: unknown,
): Promise<void> {
  const errorMessage = syncError
    ? syncError instanceof Error
      ? syncError.message
      : 'Unknown producer error'
    : null
  const counts = {
    fetchedCount: totals.discovered,
    createdCount: totals.queued,
    existingCount: totals.existing,
  }

  try {
    await finishCollectionRun(claim.runId, {
      status: syncError ? 'failed' : 'success',
      ...counts,
      errorMessage,
    })
    await createAuditLog({
      actorType: trigger.trigger === 'manual' ? 'user' : 'system',
      actorId: trigger.triggeredBy ?? null,
      actorName: trigger.triggeredByName ?? null,
      action: syncError ? 'ingestion.failed' : 'ingestion.completed',
      targetType: 'ingestion',
      targetId: claim.runId,
      targetLabel: 'e-GP',
      metadata: { trigger: trigger.trigger, source: source.label, ...counts, errorMessage },
    })
  } catch (error) {
    console.error(`Could not record the ${source.label} sync result`, error)
  }
}

// GovSpending returns 500 for a fiscal year with no data yet (e.g. right after the
// 1 October rollover), so fall back to the previous year unless one is pinned.
function govSpendingFiscalYears(): number[] {
  if (env.GOVSPENDING_FISCAL_YEAR) {
    return [env.GOVSPENDING_FISCAL_YEAR]
  }

  const current = getThaiFiscalYear()
  return [current, current - 1]
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
  fiscalYears: number[],
  keywords: string[],
  signal: AbortSignal,
): Promise<SyncTotals> {
  const totals = emptyTotals()

  for (const keyword of keywords) {
    for (const [index, fiscalYear] of fiscalYears.entries()) {
      const hasFallback = index < fiscalYears.length - 1
      let offset = 0

      try {
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

        break
      } catch (error) {
        if (error instanceof ProducerLeaseLostError || signal.aborted) {
          throw error
        }

        const yearUnavailable =
          error instanceof GovSpendingRequestError && error.status >= 500 && offset === 0
        if (yearUnavailable && hasFallback) {
          console.warn('GovSpending fiscal year unavailable, falling back', {
            keyword,
            fiscalYear,
            fallbackYear: fiscalYears[index + 1],
          })
          continue
        }

        totals.failedKeywords.push(keyword)
        console.error('GovSpending keyword sync failed', { keyword, fiscalYear, error })
        break
      }
    }
  }

  return totals
}

async function syncBmaProjects(
  dataSourceId: DataSourceId,
  producerId: string,
  adapter: BmaDiscoveryAdapter,
  budgetYears: number[],
  keywords: string[],
  signal: AbortSignal,
): Promise<SyncTotals> {
  const totals = emptyTotals()

  for (const keyword of keywords) {
    for (const budgetYear of budgetYears) {
      try {
        for (let pageNo = 1; !signal.aborted; pageNo += 1) {
          const page = await adapter.listProjects({
            budgetYear,
            keyword,
            pageNo,
            pageSize: BMA_PAGE_SIZE,
            signal,
          })
          const queueResult = await enqueueDiscoveredProjects(
            dataSourceId,
            page.projects,
            'bma_egp',
          )
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

        if (!totals.failedKeywords.includes(keyword)) {
          totals.failedKeywords.push(keyword)
        }
        console.error('BMA keyword sync failed', { keyword, budgetYear, error })
      }
    }
  }

  return totals
}
