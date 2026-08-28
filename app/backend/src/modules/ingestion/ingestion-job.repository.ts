import { Types } from 'mongoose'

import { IngestionJobModel } from './ingestion-job.model.js'

const MAX_ATTEMPS = 5
const LEASE_DURATION_MS = 5 * 60_000

export async function claimNextJob(workerId: string) {
  const now = new Date()
  const lockedUntil = new Date(now.getTime() + LEASE_DURATION_MS)

  return IngestionJobModel.findOneAndUpdate(
    {
      attempCount: {
        $lt: MAX_ATTEMPS, // finding less than max attemp items
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
        createAt: 1,
      },
      returnDocument: 'after',
      runValidators: true,
    },
  ).exec()
}
