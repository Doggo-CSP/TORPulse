import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

import type { Types } from 'mongoose'

import { env } from '../../config/env.js'
import { createAuditLog } from '../../modules/admin/audit-log.repository.js'
import { getSettings } from '../../modules/admin/settings.repository.js'
import {
  finishCollectionRun,
  startCollectionRun,
} from '../../modules/ingestion/collection-run.repository.js'
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

export async function runScheduledSync(
  producerId: string,
  adapter: GovSpendingDiscoveryAdapter,
  signal: AbortSignal,
): Promise<void> {
  // Only scheduled runs honour the admin switch; a manual "sync now" always runs.
  const { ingestionEnabled } = await getSettings()
  if (!ingestionEnabled) {
    console.log('GovSpending sync skipped because automatic ingestion is turned off')
    return
  }

  const claim = await beginGovSpendingSync(producerId, { trigger: 'scheduled' })
  if (!claim) {
    console.log('GovSpending sync skipped because another producer owns the lease')
    return
  }

  await completeGovSpendingSync(claim, producerId, adapter, signal, { trigger: 'scheduled' })
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

// Claims the shared GovSpending lease and records a running CollectionRun. Returns null when
// another run (scheduled or manual, in any process) already holds the lease.
export async function beginGovSpendingSync(
  producerId: string,
  trigger: SyncTrigger,
): Promise<SyncClaim | null> {
  const dataSource = await ensureGovSpendingDataSource()
  if (!dataSource) {
    throw new Error('Could not initialize the GovSpending data source')
  }

  if (!(await claimProducerLease(dataSource._id, producerId))) {
    return null
  }

  const run = await startCollectionRun({
    trigger: trigger.trigger,
    triggeredBy: trigger.triggeredBy ?? null,
  })
  return { dataSourceId: dataSource._id, runId: run._id }
}

export async function completeGovSpendingSync(
  claim: SyncClaim,
  producerId: string,
  adapter: GovSpendingDiscoveryAdapter,
  signal: AbortSignal,
  trigger: SyncTrigger,
): Promise<void> {
  const startedAt = Date.now()
  let syncError: unknown
  let totals: SyncTotals = { pages: 0, discovered: 0, queued: 0, existing: 0, failedKeywords: [] }

  try {
    const fiscalYear = env.GOVSPENDING_FISCAL_YEAR ?? getThaiFiscalYear()
    totals = await syncGovSpendingProjects(
      claim.dataSourceId,
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
    await releaseProducerLease(claim.dataSourceId, producerId, syncError)
    await recordRunResult(claim, trigger, totals, syncError)
  }
}

// Closes the CollectionRun and writes ingestion.completed / ingestion.failed so the run shows
// up in the admin activity feed. Failures here are logged, never thrown over the sync result.
async function recordRunResult(
  claim: SyncClaim,
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
    // TODO(QUESTION-11): the producer only queues new projects and never updates existing
    // ones, so there is nothing to count here yet; see QUESTIONS.md
    updatedCount: 0,
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
      metadata: { trigger: trigger.trigger, ...counts, errorMessage },
    })
  } catch (error) {
    console.error('Could not record the GovSpending sync result', error)
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
