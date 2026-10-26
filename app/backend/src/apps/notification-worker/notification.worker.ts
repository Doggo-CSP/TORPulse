import { setTimeout as delay } from 'node:timers/promises'
import { randomUUID } from 'node:crypto'

import type { Types } from 'mongoose'

import { env } from '../../config/env.js'
import { getSettings } from '../../modules/admin/settings.repository.js'
import { User } from '../../modules/auth/user.model.js'
import { buildQualifyingTorEmail } from '../../modules/notification/email-template.js'
import { canReceiveNotification, isTorRelevant } from '../../modules/notification/eligibility.js'
import { createSmtpMailer, type Mailer } from '../../modules/notification/mailer.js'
import { TorNotificationModel } from '../../modules/notification/tor-notification.model.js'
import {
  claimNextUserBatch,
  markNotificationsFailed,
  markNotificationsSent,
  markNotificationsSkipped,
} from '../../modules/notification/tor-notification.repository.js'
import { TorModel } from '../../modules/tor/tor.model.js'

// Sends one email for the next user with due notifications. Returns false when nothing was due.
export async function processNextBatch(
  workerId: string,
  mailer: Mailer,
  onlyUserId?: Types.ObjectId,
): Promise<boolean> {
  const rows = await claimNextUserBatch(workerId, onlyUserId)
  const first = rows[0]
  if (!first) {
    return false
  }

  const user = await User.findById(first.userId).lean()
  if (!user || !canReceiveNotification(user)) {
    await markNotificationsSkipped(
      rows.map((row) => row._id),
      workerId,
      'User missing, opted out or profile incomplete',
    )
    return true
  }

  const tors = await TorModel.find({ _id: { $in: rows.map((row) => row.torId) } }).lean()
  const torsById = new Map(tors.map((tor) => [tor._id.toString(), tor]))
  const now = new Date()

  const sendable = rows.filter((row) => {
    const tor = torsById.get(row.torId.toString())
    return tor !== undefined && isTorRelevant(tor, now)
  })
  const stale = rows.filter((row) => !sendable.includes(row))

  await markNotificationsSkipped(
    stale.map((row) => row._id),
    workerId,
    'TOR removed, hidden or closed before sending',
  )

  if (sendable.length === 0) {
    return true
  }

  try {
    const settings = await getSettings()
    const from = settings.senderEmail ?? env.NOTIFICATION_FROM
    if (!from) {
      throw new Error('No sender email: set it in admin settings or NOTIFICATION_FROM')
    }

    const email = buildQualifyingTorEmail(
      user.companyName || user.displayName || user.name,
      sendable.map((row) => {
        const tor = torsById.get(row.torId.toString())!
        return {
          id: tor._id.toString(),
          projectTitle: tor.projectTitle,
          agencyName: tor.agencyName ?? null,
          budgetBaht: tor.budgetBaht ?? null,
          submissionDeadlineAt: tor.submissionDeadlineAt ?? null,
        }
      }),
      env.FRONTEND_URL,
    )

    await mailer.send({
      from,
      to: user.contactEmail || user.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    })

    await markNotificationsSent(
      sendable.map((row) => row._id),
      workerId,
      randomUUID(),
    )
    console.log(`Sent ${sendable.length} qualifying TOR(s) to user ${user._id}`)
  } catch (error) {
    console.error(`Notification email to user ${user._id} failed`, error)
    await markNotificationsFailed(sendable, workerId, error)
  }

  return true
}

export async function startNotificationWorker(
  signal: AbortSignal,
  mailer: Mailer = createSmtpMailer(),
): Promise<void> {
  const workerId = `notification-${randomUUID()}`

  await TorNotificationModel.init()
  console.log(`Notification worker started: ${workerId}`)

  while (!signal.aborted) {
    let didWork = false

    try {
      didWork = await processNextBatch(workerId, mailer)
    } catch (error) {
      console.error('Notification batch failed', error)
    }

    // Drain every due user back to back; wait only once the queue is empty.
    if (didWork) {
      continue
    }

    try {
      await delay(env.NOTIFICATION_POLL_INTERVAL_MS, undefined, { signal })
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        throw error
      }
    }
  }

  console.log('Notification worker stopped')
}
