import type { Types } from 'mongoose'

import { CollectionRunModel } from './collection-run.model.js'
import { DataSourceModel } from './data-source.model.js'
import { PRODUCER_LEASE_MS } from './data-source.repository.js'

export async function startCollectionRun(input: {
  trigger: 'scheduled' | 'manual'
  triggeredBy?: Types.ObjectId | null
}) {
  return CollectionRunModel.create({
    trigger: input.trigger,
    triggeredBy: input.triggeredBy ?? null,
    status: 'running',
    startedAt: new Date(),
  })
}

export async function finishCollectionRun(
  runId: Types.ObjectId,
  result: {
    status: 'success' | 'failed'
    fetchedCount: number
    createdCount: number
    existingCount: number
    errorMessage?: string | null
  },
) {
  return CollectionRunModel.findByIdAndUpdate(
    runId,
    {
      $set: {
        status: result.status,
        finishedAt: new Date(),
        fetchedCount: result.fetchedCount,
        createdCount: result.createdCount,
        existingCount: result.existingCount,
        errorMessage: result.errorMessage ?? null,
      },
    },
    { returnDocument: 'after' },
  ).lean()
}

export async function findLatestCollectionRun(trigger?: 'scheduled' | 'manual') {
  return CollectionRunModel.findOne(trigger ? { trigger } : {})
    .sort({ startedAt: -1 })
    .lean()
}

export async function hasRunningCollectionRun(): Promise<boolean> {
  return (await CollectionRunModel.exists({ status: 'running' })) !== null
}

// Closes runs left 'running' by a process that died, as failed with errorMessage 'timeout'.
// Called with no cutoff right after claiming the producer lease (nobody else can be running
// then) and, when reading the status, for runs older than the lease duration (15 minutes).
// On status reads a run is only closed while the lease is free: a healthy long sync renews
// its lease every page, so an old run that still holds it is really still working.
export async function expireStaleCollectionRuns(options: { olderThan?: Date } = {}) {
  const filter: Record<string, unknown> = { status: 'running' }
  if (options.olderThan) {
    const leaseHeld = await DataSourceModel.exists({ lockedUntil: { $gt: new Date() } })
    if (leaseHeld) return 0
    filter.startedAt = { $lt: options.olderThan }
  }

  const result = await CollectionRunModel.updateMany(filter, {
    $set: { status: 'failed', finishedAt: new Date(), errorMessage: 'timeout' },
  })
  return result.modifiedCount
}

export const staleRunCutoff = (now = new Date()) => new Date(now.getTime() - PRODUCER_LEASE_MS)
