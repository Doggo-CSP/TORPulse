import { Types, type QueryFilter } from 'mongoose'

import {
  TorNotificationModel,
  type TorNotificationDocument,
  type TorNotificationRecord,
} from './tor-notification.model.js'

export const MAX_ATTEMPTS = 3
const LEASE_DURATION_MS = 5 * 60_000

export interface NotificationPair {
  userId: Types.ObjectId
  torId: Types.ObjectId
}

// Inserts a pending row per new pair; pairs already queued or sent are left untouched.
export async function enqueueNotifications(
  pairs: NotificationPair[],
): Promise<{ queued: number; existing: number }> {
  const unique = [
    ...new Map(pairs.map((pair) => [`${pair.userId}:${pair.torId}`, pair])).values(),
  ]

  if (unique.length === 0) {
    return { queued: 0, existing: 0 }
  }

  const result = await TorNotificationModel.bulkWrite(
    unique.map((pair) => ({
      updateOne: {
        filter: { userId: pair.userId, torId: pair.torId },
        update: {
          $setOnInsert: {
            status: 'pending',
            attemptCount: 0,
            nextRetryAt: new Date(),
            lockedBy: null,
            lockedUntil: null,
            lastError: null,
            emailBatchId: null,
            sentAt: null,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  )

  return { queued: result.upsertedCount, existing: unique.length - result.upsertedCount }
}

function dueFilter(now: Date): QueryFilter<TorNotificationRecord> {
  return {
    attemptCount: { $lt: MAX_ATTEMPTS },
    $or: [
      { status: 'pending' },
      { status: 'failed', nextRetryAt: { $lte: now } },
      // A worker died mid-send; its lease has run out.
      { status: 'sending', lockedUntil: { $lte: now } },
    ],
  }
}

// Leases every due row of one user so they go out together in a single email.
// onlyUserId limits the claim to one user (used by tests sharing a database).
export async function claimNextUserBatch(
  workerId: string,
  onlyUserId?: Types.ObjectId,
): Promise<TorNotificationDocument[]> {
  const now = new Date()
  const next = await TorNotificationModel.findOne({
    ...dueFilter(now),
    ...(onlyUserId ? { userId: onlyUserId } : {}),
  })
    .sort({ nextRetryAt: 1, createdAt: 1 })
    .select({ userId: 1 })
    .lean()

  if (!next) {
    return []
  }

  await TorNotificationModel.updateMany(
    { userId: next.userId, ...dueFilter(now) },
    {
      $set: {
        status: 'sending',
        lockedBy: workerId,
        lockedUntil: new Date(now.getTime() + LEASE_DURATION_MS),
      },
      $inc: { attemptCount: 1 },
    },
  )

  return TorNotificationModel.find({
    userId: next.userId,
    status: 'sending',
    lockedBy: workerId,
  })
    .sort({ createdAt: 1 })
    .exec()
}

export async function markNotificationsSent(
  ids: Types.ObjectId[],
  workerId: string,
  emailBatchId: string,
): Promise<void> {
  if (ids.length === 0) return

  await TorNotificationModel.updateMany(
    { _id: { $in: ids }, lockedBy: workerId },
    {
      $set: {
        status: 'sent',
        sentAt: new Date(),
        emailBatchId,
        lockedBy: null,
        lockedUntil: null,
        nextRetryAt: null,
        lastError: null,
      },
    },
  )
}

// Rows that no longer apply (TOR hidden or closed, user opted out). They stay logged so the
// pair is never re-queued.
export async function markNotificationsSkipped(
  ids: Types.ObjectId[],
  workerId: string,
  reason: string,
): Promise<void> {
  if (ids.length === 0) return

  await TorNotificationModel.updateMany(
    { _id: { $in: ids }, lockedBy: workerId },
    {
      $set: {
        status: 'skipped',
        lockedBy: null,
        lockedUntil: null,
        nextRetryAt: null,
        lastError: { code: 'SKIPPED', message: reason, occurredAt: new Date() },
      },
    },
  )
}

export async function markNotificationsFailed(
  rows: Pick<TorNotificationDocument, '_id' | 'attemptCount'>[],
  workerId: string,
  error: unknown,
): Promise<void> {
  if (rows.length === 0) return

  const message = error instanceof Error ? error.message : 'Unknown error'
  const occurredAt = new Date()

  await TorNotificationModel.bulkWrite(
    rows.map((row) => {
      const hasAttemptsRemaining = row.attemptCount < MAX_ATTEMPTS
      // 1 minute, 5 minutes, 25 minutes, then capped.
      const retryDelayMs = Math.min(
        60_000 * 5 ** Math.max(row.attemptCount - 1, 0),
        2 * 60 * 60_000,
      )

      return {
        updateOne: {
          filter: { _id: row._id, lockedBy: workerId },
          update: {
            $set: {
              status: 'failed' as const,
              lockedBy: null,
              lockedUntil: null,
              nextRetryAt: hasAttemptsRemaining ? new Date(Date.now() + retryDelayMs) : null,
              lastError: { code: 'DELIVERY_FAILED', message, occurredAt },
            },
          },
        },
      }
    }),
    { ordered: false },
  )
}
