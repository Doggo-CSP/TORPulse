import type { Types } from 'mongoose'

import { env } from '../../config/env.js'
import { User } from '../auth/user.model.js'
import { PUBLIC_TOR_FILTER, TorModel } from '../tor/tor.model.js'
import { BidderProfileModel } from '../user/bidder-profile.model.js'
import { profileCompleteness } from '../user/bidder-profile.qualification.js'
import {
  enqueueMatchJobs,
  findActiveJobKeys,
  type MatchPair,
} from './qualification-job.repository.js'
import { QualificationMatchModel } from './qualification-match.model.js'
import {
  hasRequirementText,
  isMatchStale,
  type MatchProfile,
  type MatchTor,
  type MatchUser,
} from './qualification-match.service.js'

// Precomputes matches so TOR cards can show a score as soon as the user opens the list.
// Only TORs still open for bids are worth the AI calls.

const MATCH_TOR_FIELDS = {
  projectTitle: 1,
  agencyName: 1,
  budgetBaht: 1,
  scope: 1,
  requirements: 1,
  bidderQualifications: 1,
  evaluationCriteria: 1,
  technologies: 1,
  submissionDeadlineAt: 1,
}

type CandidateTor = MatchTor & { _id: Types.ObjectId }

// Open for bids and with requirement text to judge. QUALIFICATION_TEST_LATEST_TORS replaces
// "open" with "the N latest TORs" so a database with only closed TORs can still be tested.
export async function findCandidateTors(now = new Date()): Promise<CandidateTor[]> {
  const testLimit = env.QUALIFICATION_TEST_LATEST_TORS
  const query = testLimit
    ? TorModel.find(PUBLIC_TOR_FILTER)
        .sort({ submissionDeadlineAt: -1, createdAt: -1 })
        .limit(testLimit)
    : TorModel.find({
        ...PUBLIC_TOR_FILTER,
        $or: [{ submissionDeadlineAt: null }, { submissionDeadlineAt: { $gt: now } }],
      })

  const tors = (await query.select(MATCH_TOR_FIELDS).lean()) as CandidateTor[]
  return tors.filter(hasRequirementText)
}

// Matching needs a bidder account and every required profile field (UC-07).
export function isBidderReady(user: MatchUser | null, profile: MatchProfile | null): boolean {
  if (!user || !profile) return false
  if (user.accountType !== 'personal' && user.accountType !== 'company') return false
  return profileCompleteness(user, profile).isComplete
}

// After a profile edit: queue every candidate TOR for this user. The delay lets a user finish
// editing first; unchanged data then costs no AI call (the worker checks the input hash).
export async function enqueueMatchesForUser(
  userId: Types.ObjectId | string,
  delayMs: number = env.QUALIFICATION_PROFILE_DELAY_MS,
): Promise<number> {
  const [user, profile] = await Promise.all([
    User.findById(userId).lean(),
    BidderProfileModel.findOne({ userId }).lean(),
  ])
  if (!user || !isBidderReady(user, profile)) return 0

  const tors = await findCandidateTors()
  return enqueueMatchJobs(
    tors.map((tor) => ({ userId: user._id, torId: tor._id })),
    delayMs,
  )
}

// Finds every (ready user, candidate TOR) pair whose result is missing or stale and that has no
// job waiting, and queues it to run now. Catches new TORs and anything a trigger missed.
export async function sweepMatches(now = new Date()): Promise<number> {
  const tors = await findCandidateTors(now)
  if (tors.length === 0) return 0

  const profiles = await BidderProfileModel.find().lean()
  const users = await User.find({ _id: { $in: profiles.map((p) => p.userId) } }).lean()
  const usersById = new Map(users.map((user) => [user._id.toString(), user]))

  const ready = profiles
    .map((profile) => ({ profile, user: usersById.get(profile.userId.toString()) ?? null }))
    .filter(({ user, profile }) => isBidderReady(user, profile))
  if (ready.length === 0) return 0

  const userIds = ready.map(({ profile }) => profile.userId)
  const [matches, activeKeys] = await Promise.all([
    QualificationMatchModel.find({
      userId: { $in: userIds },
      torId: { $in: tors.map((tor) => tor._id) },
    })
      .select({ userId: 1, torId: 1, inputVersion: 1, evaluatedAt: 1 })
      .lean(),
    findActiveJobKeys(userIds),
  ])
  const matchesByKey = new Map(matches.map((match) => [`${match.userId}:${match.torId}`, match]))

  const pairs: MatchPair[] = []
  for (const { user, profile } of ready) {
    for (const tor of tors) {
      const key = `${profile.userId}:${tor._id}`
      if (activeKeys.has(key)) continue
      const match = matchesByKey.get(key)
      if (!match || isMatchStale(match, user!, profile, tor, now)) {
        pairs.push({ userId: profile.userId, torId: tor._id })
      }
    }
  }

  return enqueueMatchJobs(pairs, 0)
}

// AI calls made in the last 24 hours, by the worker and by on-demand POSTs alike.
export async function countRecentAiCalls(now = new Date()): Promise<number> {
  return QualificationMatchModel.countDocuments({
    evaluatedAt: { $gt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
  })
}
