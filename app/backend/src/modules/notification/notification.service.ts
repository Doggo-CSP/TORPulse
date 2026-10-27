import type { Types } from 'mongoose'

import { User } from '../auth/user.model.js'
import { QualificationMatchModel } from '../qualification/qualification-match.model.js'
import { isMatchStale, type MatchTor } from '../qualification/qualification-match.service.js'
import { TorModel } from '../tor/tor.model.js'
import { BidderProfileModel } from '../user/bidder-profile.model.js'
import { canReceiveNotification, isNotifiableMatch, isTorRelevant } from './eligibility.js'
import { enqueueNotifications } from './tor-notification.repository.js'

// Emails follow the AI qualification score: a (user, TOR) pair is queued once its up-to-date
// match reaches 100%. The unique index keeps each pair to one email, ever.

type NotifyTor = MatchTor & {
  _id: Types.ObjectId
  reviewStatus?: string | null
}

// What the match input hash and the relevance check read
const TOR_FIELDS = {
  projectTitle: 1,
  agencyName: 1,
  budgetBaht: 1,
  scope: 1,
  requirements: 1,
  bidderQualifications: 1,
  evaluationCriteria: 1,
  technologies: 1,
  submissionDeadlineAt: 1,
  reviewStatus: 1,
}

// Queues every TOR whose current match for this user is a full score. Called after a match is
// saved (one TOR) and when the user turns email on again (all of them).
export async function enqueueForUser(
  userId: Types.ObjectId | string,
  torIds?: (Types.ObjectId | string)[],
): Promise<{ queued: number; existing: number }> {
  const [user, profile] = await Promise.all([
    User.findById(userId).lean(),
    BidderProfileModel.findOne({ userId }).lean(),
  ])
  if (!user || !profile || !canReceiveNotification(user, profile)) {
    return { queued: 0, existing: 0 }
  }

  const matches = await QualificationMatchModel.find({
    userId: user._id,
    ...(torIds && { torId: { $in: torIds } }),
  })
    .select({ torId: 1, percentage: 1, inputVersion: 1, evaluatedAt: 1 })
    .lean()
  const full = matches.filter(isNotifiableMatch)
  if (full.length === 0) return { queued: 0, existing: 0 }

  const tors = (await TorModel.find({ _id: { $in: full.map((m) => m.torId) } })
    .select(TOR_FIELDS)
    .lean()) as NotifyTor[]
  const torsById = new Map(tors.map((tor) => [tor._id.toString(), tor]))

  const now = new Date()
  const pairs = full
    .filter((match) => {
      const tor = torsById.get(match.torId.toString())
      // A stale score was computed from an older profile or TOR, so it may no longer hold
      return tor && isTorRelevant(tor, now) && !isMatchStale(match, user, profile, tor, now)
    })
    .map((match) => ({ userId: user._id, torId: match.torId }))

  return enqueueNotifications(pairs)
}

// Triggers must never break the request or job that fired them.
export function enqueueInBackground(label: string, task: () => Promise<unknown>): void {
  task().catch((error: unknown) => {
    console.error(`Notification enqueue failed (${label})`, error)
  })
}
