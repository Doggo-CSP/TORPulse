import { Types } from 'mongoose'

import { TorModel } from '../tor/tor.model.js'
import { IngestionJobModel } from './ingestion-job.model.js'

export interface CompletedTorReference {
  _id: Types.ObjectId
  torId?: Types.ObjectId | null
}

export function selectMissingTorJobIds(
  jobs: CompletedTorReference[],
  existingTorIds: Types.ObjectId[],
): Types.ObjectId[] {
  const existingIds = new Set(existingTorIds.map((id) => id.toString()))

  return jobs
    .filter((job) => !job.torId || !existingIds.has(job.torId.toString()))
    .map((job) => job._id)
}

export async function repairCompletedJobsWithMissingTors(): Promise<{
  candidates: number
  requeued: number
}> {
  const completedJobs = await IngestionJobModel.find({ status: 'completed' })
    .select({ _id: 1, torId: 1 })
    .lean<CompletedTorReference[]>()
    .exec()
  const referencedTorIds = completedJobs
    .map((job) => job.torId)
    .filter((torId): torId is Types.ObjectId => Boolean(torId))
  const existingTorIds = (await TorModel.distinct('_id', {
    _id: { $in: referencedTorIds },
  })) as Types.ObjectId[]
  const missingJobIds = selectMissingTorJobIds(completedJobs, existingTorIds)

  if (missingJobIds.length === 0) {
    return { candidates: 0, requeued: 0 }
  }

  const result = await IngestionJobModel.updateMany(
    {
      _id: { $in: missingJobIds },
      status: 'completed',
    },
    {
      $set: {
        status: 'queued',
        currentStage: 'queued',
        attempCount: 0,
        nextRetryAt: new Date(),
        lockedBy: null,
        lockedUntil: null,
      },
      $unset: {
        torId: 1,
        lastError: 1,
      },
    },
  )

  return {
    candidates: missingJobIds.length,
    requeued: result.modifiedCount,
  }
}
