import type { Types } from 'mongoose'

import { CollectionRunModel } from './collection-run.model.js'

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
    updatedCount: number
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
        updatedCount: result.updatedCount,
        errorMessage: result.errorMessage ?? null,
      },
    },
    { returnDocument: 'after' },
  ).lean()
}

export async function findLatestCollectionRun() {
  return CollectionRunModel.findOne().sort({ startedAt: -1 }).lean()
}

// TODO(QUESTION-12): a run left 'running' by a crashed process stays 'running' forever; see QUESTIONS.md
export async function hasRunningCollectionRun(): Promise<boolean> {
  return (await CollectionRunModel.exists({ status: 'running' })) !== null
}
