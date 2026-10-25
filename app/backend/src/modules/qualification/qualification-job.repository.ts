import type { Types } from 'mongoose'

import { QualificationJobModel, type QualificationJobDocument } from './qualification-job.model.js'

export const MAX_JOB_ATTEMPTS = 3
const LEASE_DURATION_MS = 5 * 60_000
// Wait before retry 1 and retry 2
const RETRY_DELAYS_MS = [60_000, 10 * 60_000]

export interface MatchPair {
  userId: Types.ObjectId
  torId: Types.ObjectId
}

// Queues each pair to run after delayMs. Queueing a pair again pushes it back, so a burst of
// profile edits leaves one job that runs once the user stops editing. A job being processed is
// queued again too; the worker then drops its now outdated result (see finishJob).
export async function enqueueMatchJobs(pairs: MatchPair[], delayMs: number): Promise<number> {
  const unique = [...new Map(pairs.map((pair) => [`${pair.userId}:${pair.torId}`, pair])).values()]
  if (unique.length === 0) return 0

  const runAfter = new Date(Date.now() + delayMs)
  await QualificationJobModel.bulkWrite(
    unique.map((pair) => ({
      updateOne: {
        filter: { userId: pair.userId, torId: pair.torId },
        update: {
          $set: {
            status: 'queued',
            runAfter,
            attemptCount: 0,
            lockedBy: null,
            lockedUntil: null,
            lastError: null,
            finishedAt: null,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  )
  return unique.length
}

// Pairs that already have a queued or running job, so the sweep does not delay them.
export async function findActiveJobKeys(userIds: Types.ObjectId[]): Promise<Set<string>> {
  const jobs = await QualificationJobModel.find({
    userId: { $in: userIds },
    status: { $in: ['queued', 'processing'] },
  })
    .select({ userId: 1, torId: 1 })
    .lean()
  return new Set(jobs.map((job) => `${job.userId}:${job.torId}`))
}

// Leases the next due job: queued and past runAfter, or abandoned by a worker that died.
// scope limits the claim to one user, or one pair (used by tests sharing a database).
export interface JobScope {
  userId: Types.ObjectId
  torId?: Types.ObjectId
}

export async function claimNextJob(
  workerId: string,
  scope?: JobScope,
): Promise<QualificationJobDocument | null> {
  const now = new Date()
  return QualificationJobModel.findOneAndUpdate(
    {
      attemptCount: { $lt: MAX_JOB_ATTEMPTS },
      $or: [
        { status: 'queued', runAfter: { $lte: now } },
        { status: 'processing', lockedUntil: { $lte: now } },
      ],
      ...(scope && { userId: scope.userId }),
      ...(scope?.torId && { torId: scope.torId }),
    },
    {
      $set: {
        status: 'processing',
        lockedBy: workerId,
        lockedUntil: new Date(now.getTime() + LEASE_DURATION_MS),
      },
      $inc: { attemptCount: 1 },
    },
    { sort: { runAfter: 1 }, returnDocument: 'after' },
  )
}

// Ends a job this worker still holds. Returns false when the job was queued again meanwhile,
// so the caller knows its result is outdated.
export async function finishJob(
  job: QualificationJobDocument,
  workerId: string,
  status: 'done' | 'skipped',
  note: string | null = null,
): Promise<boolean> {
  const result = await QualificationJobModel.updateOne(
    { _id: job._id, status: 'processing', lockedBy: workerId },
    {
      $set: {
        status,
        lastError: note,
        finishedAt: new Date(),
        lockedBy: null,
        lockedUntil: null,
      },
    },
  )
  return result.modifiedCount === 1
}

// Retries with backoff until MAX_JOB_ATTEMPTS, then gives up.
export async function failJob(
  job: QualificationJobDocument,
  workerId: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  const retryDelay = RETRY_DELAYS_MS[job.attemptCount - 1]
  const giveUp = job.attemptCount >= MAX_JOB_ATTEMPTS || retryDelay === undefined

  await QualificationJobModel.updateOne(
    { _id: job._id, status: 'processing', lockedBy: workerId },
    {
      $set: {
        ...(giveUp
          ? { status: 'failed', finishedAt: new Date() }
          : { status: 'queued', runAfter: new Date(Date.now() + retryDelay) }),
        lastError: message,
        lockedBy: null,
        lockedUntil: null,
      },
    },
  )
}

// Puts a job back without counting the attempt, e.g. when the daily AI budget is used up.
export async function postponeJob(
  job: QualificationJobDocument,
  workerId: string,
  delayMs: number,
  reason: string,
): Promise<void> {
  await QualificationJobModel.updateOne(
    { _id: job._id, status: 'processing', lockedBy: workerId },
    {
      $set: {
        status: 'queued',
        runAfter: new Date(Date.now() + delayMs),
        lastError: reason,
        lockedBy: null,
        lockedUntil: null,
      },
      $inc: { attemptCount: -1 },
    },
  )
}

export async function findJobsForUser(userId: Types.ObjectId | string, torIds: string[]) {
  return QualificationJobModel.find({ userId, torId: { $in: torIds } }).lean()
}
