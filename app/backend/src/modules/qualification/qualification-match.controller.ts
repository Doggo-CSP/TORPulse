import type { Request, Response } from 'express'
import { Types, isObjectIdOrHexString } from 'mongoose'

import { HIDDEN_TOR_REVIEW_STATUSES, PUBLIC_TOR_FILTER, TorModel } from '../tor/tor.model.js'
import { findBidderProfile } from '../user/bidder-profile.repository.js'
import { profileCompleteness } from '../user/bidder-profile.qualification.js'
import { findUserById } from '../user/user.repository.js'
import type { QualificationMatchDocument } from './qualification-match.model.js'
import { findJobsForUser } from './qualification-job.repository.js'
import {
  findQualificationMatch,
  findQualificationMatches,
  saveQualificationMatch,
} from './qualification-match.repository.js'
import {
  currentAiModel,
  evaluateQualification,
  hasRequirementText,
  isMatchStale,
  matchInputVersion,
} from './qualification-match.service.js'
import { isBidderReady } from './qualification-precompute.service.js'

const toMatchResponse = (match: QualificationMatchDocument) => ({
  percentage: match.percentage,
  allMandatoryMet: match.allMandatoryMet,
  counts: {
    met: match.counts.met,
    partial: match.counts.partial,
    notMet: match.counts.not_met,
    unknown: match.counts.unknown,
  },
  requirements: match.requirements.map((item) => ({
    requirement: item.requirement,
    category: item.category,
    mandatory: item.mandatory,
    status: item.status,
    reason: item.reason,
    suggestion: item.suggestion,
  })),
  summary: match.summary,
  aiModel: match.aiModel,
  evaluatedAt: match.evaluatedAt.toISOString(),
})

// Loads everything a match needs, answering the request itself when something is missing.
const loadMatchContext = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }

  const torId = req.params.id
  if (!isObjectIdOrHexString(torId)) {
    res.status(400).json({ error: 'Invalid TOR id' })
    return null
  }

  const [user, tor, profile, match] = await Promise.all([
    findUserById(req.user._id),
    TorModel.findById(torId).lean(),
    findBidderProfile(req.user._id),
    findQualificationMatch(req.user._id, String(torId)),
  ])

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return null
  }
  if (!tor || (tor.reviewStatus && HIDDEN_TOR_REVIEW_STATUSES.includes(tor.reviewStatus))) {
    res.status(404).json({ error: 'TOR not found' })
    return null
  }

  const isStale = Boolean(match && (!profile || isMatchStale(match, user, profile, tor)))

  return { user, tor, profile, match, isStale, completeness: profileCompleteness(user, profile) }
}

// The last result for this TOR, without calling the AI. match is null until POST runs once.
export const getQualificationMatchHandler = async (req: Request, res: Response): Promise<void> => {
  const context = await loadMatchContext(req, res)
  if (!context) return

  const { match, isStale, completeness } = context
  res.json({ match: match ? toMatchResponse(match) : null, isStale, completeness })
}

// Runs the AI comparison (UC-08). Returns the cached result when nothing changed since it was
// computed, unless ?force=true.
export const evaluateQualificationMatchHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const context = await loadMatchContext(req, res)
  if (!context) return

  const { user, tor, profile, match, isStale, completeness } = context

  if (user.accountType !== 'personal' && user.accountType !== 'company') {
    res.status(409).json({ error: 'Only personal or company accounts can be matched' })
    return
  }
  if (!profile) {
    res.status(409).json({ error: 'Fill in the bidder profile before matching', completeness })
    return
  }
  if (!hasRequirementText(tor)) {
    res.status(422).json({ error: 'This TOR has no extracted requirements to match against' })
    return
  }

  if (match && !isStale && req.query.force !== 'true') {
    res.json({ match: toMatchResponse(match), isStale: false, completeness })
    return
  }

  let result
  try {
    result = await evaluateQualification(user, profile, tor)
  } catch (error) {
    console.error(`Qualification match failed (user ${user._id}, TOR ${tor._id})`, error)
    res.status(502).json({ error: 'The AI could not evaluate this TOR. Try again later.' })
    return
  }

  const saved = await saveQualificationMatch(
    user._id,
    tor._id,
    matchInputVersion(user, profile, tor),
    currentAiModel(),
    result,
  )

  res.json({ match: toMatchResponse(saved), isStale: false, completeness })
}

const MAX_CARD_TORS = 50

// What a TOR card shows. stale keeps the previous score on screen while it is recomputed.
export type CardMatchStatus =
  | 'ready'
  | 'stale'
  | 'pending'
  | 'failed'
  | 'not_evaluated'
  | 'profile_incomplete'
  | 'no_requirements'

export function cardMatchStatus(input: {
  hasRequirements: boolean
  bidderReady: boolean
  match: { stale: boolean } | null
  jobStatus: string | null
}): CardMatchStatus {
  if (!input.hasRequirements) return 'no_requirements'
  if (!input.bidderReady) return 'profile_incomplete'
  if (input.match) return input.match.stale ? 'stale' : 'ready'
  if (input.jobStatus === 'queued' || input.jobStatus === 'processing') return 'pending'
  if (input.jobStatus === 'failed') return 'failed'
  // Closed TORs are not precomputed; the detail page can still run POST /tors/:id/qualification
  return 'not_evaluated'
}

// GET /user/qualification-matches?torIds=a,b,c: the precomputed scores for the TOR cards on
// one page, in one request. Never calls the AI.
export const listQualificationMatchesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const raw = typeof req.query.torIds === 'string' ? req.query.torIds : ''
  const ids = [
    ...new Set(
      raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ]
  if (ids.length === 0 || ids.length > MAX_CARD_TORS || !ids.every(isObjectIdOrHexString)) {
    res.status(400).json({ error: `torIds must be 1 to ${MAX_CARD_TORS} comma-separated TOR ids` })
    return
  }
  const torIds = ids.map((id) => new Types.ObjectId(id))

  const [user, profile, tors, matches, jobs] = await Promise.all([
    findUserById(req.user._id),
    findBidderProfile(req.user._id),
    TorModel.find({ _id: { $in: torIds }, ...PUBLIC_TOR_FILTER }).lean(),
    findQualificationMatches(req.user._id, torIds),
    findJobsForUser(req.user._id, ids),
  ])
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const bidderReady = isBidderReady(user, profile)
  const matchesByTor = new Map(matches.map((match) => [match.torId.toString(), match]))
  const jobsByTor = new Map(jobs.map((job) => [job.torId.toString(), job]))

  const items = tors.map((tor) => {
    const torId = tor._id.toString()
    const match = matchesByTor.get(torId) ?? null
    const stale = Boolean(match && (!profile || isMatchStale(match, user, profile, tor)))
    const status = cardMatchStatus({
      hasRequirements: hasRequirementText(tor),
      bidderReady,
      match: match && { stale },
      jobStatus: jobsByTor.get(torId)?.status ?? null,
    })
    const showScore = match && (status === 'ready' || status === 'stale')
    return {
      torId,
      status,
      percentage: showScore ? match.percentage : null,
      allMandatoryMet: showScore ? match.allMandatoryMet : null,
      evaluatedAt: showScore ? match.evaluatedAt.toISOString() : null,
    }
  })

  res.json({ completeness: profileCompleteness(user, profile), items })
}
