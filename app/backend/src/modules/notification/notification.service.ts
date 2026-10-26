import { Types } from 'mongoose'

import { User } from '../auth/user.model.js'
import { PUBLIC_TOR_FILTER, TorModel } from '../tor/tor.model.js'
import { canReceiveNotification, isFullyQualified, isTorRelevant } from './eligibility.js'
import { enqueueNotifications } from './tor-notification.repository.js'

const USER_FIELDS = {
  status: 1,
  accountType: 1,
  companyName: 1,
  registrationNumber: 1,
  interests: 1,
  qualification: 1,
  notificationPrefs: 1,
}

const TOR_FIELDS = {
  reviewStatus: 1,
  submissionDeadlineAt: 1,
  category: 1,
  categories: 1,
  eligibility: 1,
}

// A newly ingested TOR: queue it for every user who fully qualifies.
export async function enqueueForTor(
  torId: Types.ObjectId | string,
): Promise<{ queued: number; existing: number }> {
  const tor = await TorModel.findById(torId).select(TOR_FIELDS).lean()
  if (!tor || !tor.eligibility || !isTorRelevant(tor)) {
    return { queued: 0, existing: 0 }
  }

  const torCategories = [...new Set([...(tor.categories ?? []), ...(tor.category ? [tor.category] : [])])]
  if (torCategories.length === 0) {
    return { queued: 0, existing: 0 }
  }

  const candidates = await User.find({
    status: { $ne: 'suspended' },
    accountType: 'company',
    'notificationPrefs.emailEnabled': { $ne: false },
    interests: { $in: torCategories },
  })
    .select(USER_FIELDS)
    .lean()

  const pairs = candidates
    .filter((user) => canReceiveNotification(user) && isFullyQualified(user, tor).qualified)
    .map((user) => ({ userId: user._id, torId: tor._id }))

  return enqueueNotifications(pairs)
}

// The user changed their qualification, interests or opted in: queue every open TOR they now
// fully qualify for. Pairs that were already sent stay deduplicated by the unique index.
export async function enqueueForUser(
  userId: Types.ObjectId | string,
): Promise<{ queued: number; existing: number }> {
  const user = await User.findById(userId).select(USER_FIELDS).lean()
  if (!user || !canReceiveNotification(user)) {
    return { queued: 0, existing: 0 }
  }

  const now = new Date()
  const tors = await TorModel.find({
    ...PUBLIC_TOR_FILTER,
    eligibility: { $ne: null },
    $or: [{ submissionDeadlineAt: null }, { submissionDeadlineAt: { $gt: now } }],
    categories: { $in: user.interests ?? [] },
  })
    .select(TOR_FIELDS)
    .lean()

  const pairs = tors
    .filter((tor) => isTorRelevant(tor, now) && isFullyQualified(user, tor).qualified)
    .map((tor) => ({ userId: user._id, torId: tor._id }))

  return enqueueNotifications(pairs)
}

// Triggers must never break the request or ingestion job that fired them.
export function enqueueInBackground(label: string, task: () => Promise<unknown>): void {
  task().catch((error: unknown) => {
    console.error(`Notification enqueue failed (${label})`, error)
  })
}
