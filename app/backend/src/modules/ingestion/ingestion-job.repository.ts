import { Types } from 'mongoose'

import { IngestionJobModel } from './ingestion-job.model.js'
import type { DiscoveredProcurementProject } from './adapters/govspending-discovery.adapter.js'

const MAX_ATTEMPTS = 2
const LEASE_DURATION_MS = 5 * 60_000

export async function enqueueDiscoveredProjects(
  dataSourceId: Types.ObjectId,
  projects: DiscoveredProcurementProject[],
): Promise<{ queued: number; existing: number }> {
  const uniqueProjects = [
    ...new Map(projects.map((project) => [project.externalId, project])).values(),
  ]

  if (uniqueProjects.length === 0) {
    return { queued: 0, existing: 0 }
  }

  const result = await IngestionJobModel.bulkWrite(
    uniqueProjects.map((project) => ({
      updateOne: {
        filter: {
          dataSourceId,
          externalId: project.externalId,
          sourceVersion: 'initial',
        },
        update: {
          $setOnInsert: {
            sourceAdapter: 'central_egp',
            status: 'queued',
            currentStage: 'queued',
            attempCount: 0,
            nextRetryAt: new Date(),
            lockedBy: null,
            lockedUntil: null,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  )

  return {
    queued: result.upsertedCount,
    existing: uniqueProjects.length - result.upsertedCount,
  }
}

export async function claimNextJob(workerId: string) {
  const now = new Date()
  const lockedUntil = new Date(now.getTime() + LEASE_DURATION_MS)

  return IngestionJobModel.findOneAndUpdate(
    {
      attempCount: {
        $lt: MAX_ATTEMPTS, // Only claim jobs that still have attempts remaining.
      },

      $and: [
        {
          $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }], // find now locked job
        },
        {
          $or: [
            { status: 'queued' },
            { status: 'failed', nextRetryAt: { $lte: now } },
            { status: 'processing', lockedUntil: { $lte: now } },
          ],
        }, // find the job that queue | failed | or the process that left behind
      ],
    },
    {
      // update status to processing and increase attemp+=1
      $set: {
        status: 'processing',
        lockedBy: workerId,
        lockedUntil,
      },
      $inc: {
        attempCount: 1,
      },
    },
    {
      sort: {
        nextRetryAt: 1,
        createdAt: 1,
      },
      returnDocument: 'after',
      runValidators: true,
    },
  ).exec()
}

export async function updateJobStage(
  jobId: Types.ObjectId,
  workerId: string,
  stage: string,
): Promise<void> {
  const result = await IngestionJobModel.updateOne(
    {
      _id: jobId,
      status: 'processing',
      lockedBy: workerId,
    },
    {
      $set: {
        currentStage: stage,
        lockedUntil: new Date(Date.now() + LEASE_DURATION_MS),
      },
    },
  )

  if (result.modifiedCount !== 1) {
    throw new Error(`Worker lost lease for job ${jobId}`)
  }
}

export async function completeJob(
  jobId: Types.ObjectId,
  workerId: string,
  torId: Types.ObjectId,
): Promise<void> {
  const result = await IngestionJobModel.updateOne(
    {
      _id: jobId,
      status: 'processing',
      lockedBy: workerId,
    },
    {
      $set: {
        status: 'completed',
        currentStage: 'completed',
        torId,
        lockedBy: null,
        lockedUntil: null,
        nextRetryAt: null,
      },
      $unset: {
        lastError: 1,
      },
    },
  )

  if (result.modifiedCount !== 1) {
    throw new Error(`Worker lost lease before completing job ${jobId}`)
  }
}

export async function stopJob(
  jobId: Types.ObjectId,
  workerId: string,
  status: 'rejected' | 'review_required',
  reason: string,
): Promise<void> {
  await IngestionJobModel.updateOne(
    {
      _id: jobId,
      lockedBy: workerId,
    },
    {
      $set: {
        status,
        lockedBy: null,
        lockedUntil: null,
        nextRetryAt: null,
        lastError: {
          code: status.toUpperCase(),
          message: reason,
          occurredAt: new Date(),
        },
      },
    },
  )
}

export async function failJob(
  jobId: Types.ObjectId,
  workerId: string,
  attempCount: number,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : 'Unknow error'

  const hasAttemptsRemaining = attempCount < MAX_ATTEMPTS

  // 1 minute, 5 minutes, 25 minutes, then capped.
  const retryDelayMs = Math.min(60_000 * 5 ** Math.max(attempCount - 1, 0), 2 * 60 * 60_000)

  await IngestionJobModel.updateOne(
    {
      _id: jobId,
      lockedBy: workerId,
    },
    {
      $set: {
        status: 'failed',
        lockedBy: null,
        lockedUntil: null,

        nextRetryAt: hasAttemptsRemaining ? new Date(Date.now() + retryDelayMs) : null,

        lastError: {
          code: 'PROCESSING_FAILED',
          message,
          occurredAt: new Date(),
        },
      },
    },
  )
}
