import type { Request, Response } from 'express'
import { isObjectIdOrHexString } from 'mongoose'

import { HIDDEN_TOR_REVIEW_STATUSES, TorModel } from '../tor/tor.model.js'
import { findBidderProfile } from '../user/bidder-profile.repository.js'
import { profileCompleteness } from '../user/bidder-profile.qualification.js'
import { findUserById } from '../user/user.repository.js'
import type { QualificationMatchDocument } from './qualification-match.model.js'
import { findQualificationMatch, saveQualificationMatch } from './qualification-match.repository.js'
import {
  currentAiModel,
  evaluateQualification,
  hasRequirementText,
  matchInputVersion,
} from './qualification-match.service.js'

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

  const isStale = Boolean(
    match && (!profile || match.inputVersion !== matchInputVersion(user, profile, tor)),
  )

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
