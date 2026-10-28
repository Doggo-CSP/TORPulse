import { setTimeout as delay } from 'node:timers/promises'
import { randomUUID } from 'node:crypto'

import { env } from '../../config/env.js'
import { User } from '../../modules/auth/user.model.js'
import {
  enqueueForUser,
  enqueueInBackground,
} from '../../modules/notification/notification.service.js'
import { QualificationJobModel } from '../../modules/qualification/qualification-job.model.js'
import {
  claimNextJob,
  failJob,
  finishJob,
  postponeJob,
  type JobScope,
} from '../../modules/qualification/qualification-job.repository.js'
import {
  findQualificationMatch,
  saveQualificationMatch,
} from '../../modules/qualification/qualification-match.repository.js'
import {
  currentAiModel,
  evaluateQualification,
  isMatchStale,
  matchInputVersion,
} from '../../modules/qualification/qualification-match.service.js'
import {
  countRecentAiCalls,
  findCandidateTors,
  isBidderReady,
  sweepMatches,
} from '../../modules/qualification/qualification-precompute.service.js'
import { BidderProfileModel } from '../../modules/user/bidder-profile.model.js'

const BUDGET_RETRY_MS = 60 * 60_000

// Works one queued (user, TOR) pair. Returns false when nothing was due.
export async function processNextJob(workerId: string, scope?: JobScope): Promise<boolean> {
  const job = await claimNextJob(workerId, scope)
  if (!job) return false

  const [user, profile, candidates, match] = await Promise.all([
    User.findById(job.userId).lean(),
    BidderProfileModel.findOne({ userId: job.userId }).lean(),
    findCandidateTors(),
    findQualificationMatch(job.userId, job.torId),
  ])

  if (!user || !profile || !isBidderReady(user, profile)) {
    await finishJob(job, workerId, 'skipped', 'Bidder profile missing or incomplete')
    return true
  }

  // Closed, hidden or without requirement text since it was queued
  const tor = candidates.find((candidate) => candidate._id.equals(job.torId))
  if (!tor) {
    await finishJob(job, workerId, 'skipped', 'TOR is no longer open or has no requirements')
    return true
  }

  if (match && !isMatchStale(match, user, profile, tor)) {
    await finishJob(job, workerId, 'done', 'Already up to date')
    return true
  }

  if ((await countRecentAiCalls()) >= env.QUALIFICATION_DAILY_CALL_LIMIT) {
    await postponeJob(job, workerId, BUDGET_RETRY_MS, 'Daily AI call limit reached')
    return true
  }

  try {
    const result = await evaluateQualification(user, profile, tor)
    // Saved even if the job was queued again meanwhile: its inputVersion marks it stale
    await saveQualificationMatch(
      user._id,
      tor._id,
      matchInputVersion(user, profile, tor),
      currentAiModel(),
      result,
    )
    await finishJob(job, workerId, 'done')
    console.log(`Matched user ${user._id} with TOR ${tor._id}: ${result.percentage}%`)
    enqueueInBackground(`match ${user._id}/${tor._id}`, () => enqueueForUser(user._id, [tor._id]))
  } catch (error) {
    console.error(`Qualification match failed (user ${user._id}, TOR ${tor._id})`, error)
    await failJob(job, workerId, error)
  }

  return true
}

export async function startQualificationWorker(signal: AbortSignal): Promise<void> {
  const workerId = `qualification-${randomUUID()}`

  await QualificationJobModel.init()
  console.log(`Qualification worker started: ${workerId}`)

  let lastSweepAt = 0
  while (!signal.aborted) {
    if (Date.now() - lastSweepAt >= env.QUALIFICATION_SWEEP_INTERVAL_MS) {
      lastSweepAt = Date.now()
      try {
        const queued = await sweepMatches()
        if (queued > 0) console.log(`Sweep queued ${queued} qualification match(es)`)
      } catch (error) {
        console.error('Qualification sweep failed', error)
      }
    }

    let didWork = false
    try {
      didWork = await processNextJob(workerId)
    } catch (error) {
      console.error('Qualification job failed', error)
    }

    // One job after another while the queue has work; wait only once it is empty.
    if (didWork) continue

    try {
      await delay(env.QUALIFICATION_POLL_INTERVAL_MS, undefined, { signal })
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        throw error
      }
    }
  }

  console.log('Qualification worker stopped')
}
