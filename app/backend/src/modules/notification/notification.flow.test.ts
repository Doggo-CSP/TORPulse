import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import { processNextBatch } from '../../apps/notification-worker/notification.worker.js'
import { env } from '../../config/env.js'
import { database } from '../../config/mongoose.js'
import { User } from '../auth/user.model.js'
import { QualificationMatchModel } from '../qualification/qualification-match.model.js'
import { matchInputVersion } from '../qualification/qualification-match.service.js'
import { TorModel } from '../tor/tor.model.js'
import { BidderProfileModel } from '../user/bidder-profile.model.js'
import type { MailMessage, Mailer } from './mailer.js'
import { enqueueForUser } from './notification.service.js'
import { TorNotificationModel } from './tor-notification.model.js'

const SEED_PREFIX = 'seed-notification-flow-test-'

// A complete bidder profile (the same list the AI score needs)
async function createUser(suffix: string, overrides: Record<string, unknown> = {}) {
  const user = await User.create({
    googleId: `${SEED_PREFIX}${suffix}`,
    name: `Test ${suffix}`,
    email: `${SEED_PREFIX}${suffix}@example.com`,
    image: null,
    accountType: 'company',
    companyName: `${suffix} Co., Ltd.`,
    businessType: 'Software house',
    ...overrides,
  })
  await BidderProfileModel.create({
    userId: user._id,
    organization: { registeredCapitalBaht: 10_000_000 },
    projects: [{ name: 'ระบบเดิม', contractValueBaht: 3_000_000 }],
  })
  return user
}

// Stands in for the qualification worker: an AI result computed from the current data
async function saveMatch(userId: Types.ObjectId, torId: Types.ObjectId, percentage: number) {
  const [user, profile, tor] = await Promise.all([
    User.findById(userId).lean(),
    BidderProfileModel.findOne({ userId }).lean(),
    TorModel.findById(torId).lean(),
  ])
  await QualificationMatchModel.findOneAndUpdate(
    { userId, torId },
    {
      $set: {
        inputVersion: matchInputVersion(user!, profile!, tor!),
        percentage,
        allMandatoryMet: percentage === 100,
        counts: { met: 1, partial: 0, not_met: 0, unknown: 0 },
        requirements: [],
        summary: '',
        aiModel: 'test-model',
        evaluatedAt: new Date(),
      },
    },
    { upsert: true },
  )
}

function createTor(suffix: string, overrides: Record<string, unknown> = {}) {
  return TorModel.create({
    dataSourceId: new Types.ObjectId(),
    ingestionJobId: new Types.ObjectId(),
    externalId: `${SEED_PREFIX}${suffix}`,
    sourceVersion: 'v1',
    sourceAdapter: 'central_egp',
    detailUrl: 'https://example.com/tor',
    projectTitle: `Project <${suffix}>`,
    agencyName: 'Test Agency',
    budgetBaht: 1_500_000,
    submissionDeadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
    bidderQualifications: ['ทุนจดทะเบียนไม่น้อยกว่า 5 ล้านบาท'],
    classificationReason: 'test',
    confidence: 0.9,
    analysisModel: 'test-model',
    analysisVersion: 'v4',
    analyzedAt: new Date(),
    ...overrides,
  })
}

function recordingMailer(): Mailer & { sent: MailMessage[]; failNext: boolean } {
  const mailer = {
    sent: [] as MailMessage[],
    failNext: false,
    async send(message: MailMessage) {
      if (mailer.failNext) {
        mailer.failNext = false
        throw new Error('SMTP down')
      }
      mailer.sent.push(message)
    },
  }
  return mailer
}

test('notification flow: full score, batch, send once, retry on failure', async (t) => {
  await database.connect()
  const originalFrom = env.NOTIFICATION_FROM
  env.NOTIFICATION_FROM ??= 'notify@example.com'

  const qualified = await createUser('qualified')
  const partial = await createUser('partial')
  const optedOut = await createUser('opted-out', { notificationPrefs: { emailEnabled: false } })
  const incomplete = await createUser('incomplete', { businessType: '' })
  const torA = await createTor('a')
  const torB = await createTor('b')
  const torC = await createTor('c')
  const userIds = [qualified._id, partial._id, optedOut._id, incomplete._id]
  const torIds = [torA._id, torB._id, torC._id]

  t.after(async () => {
    env.NOTIFICATION_FROM = originalFrom
    await TorNotificationModel.deleteMany({ userId: { $in: userIds } })
    await QualificationMatchModel.deleteMany({ userId: { $in: userIds } })
    await BidderProfileModel.deleteMany({ userId: { $in: userIds } })
    await User.deleteMany({ _id: { $in: userIds } })
    await TorModel.deleteMany({ _id: { $in: torIds } })
    await database.disconnect()
  })

  const mailer = recordingMailer()

  await t.test('queues a TOR only once its score is a full 100%', async () => {
    for (const user of [qualified, optedOut, incomplete]) {
      await saveMatch(user._id, torA._id, 100)
      await saveMatch(user._id, torB._id, 100)
    }
    await saveMatch(qualified._id, torC._id, 80)
    await saveMatch(partial._id, torA._id, 80)
    await saveMatch(partial._id, torB._id, 80)

    assert.deepEqual(await enqueueForUser(qualified._id), { queued: 2, existing: 0 })
    assert.deepEqual(await enqueueForUser(partial._id), { queued: 0, existing: 0 })
    assert.deepEqual(await enqueueForUser(optedOut._id), { queued: 0, existing: 0 })
    assert.deepEqual(await enqueueForUser(incomplete._id), { queued: 0, existing: 0 })

    const rows = await TorNotificationModel.find({ userId: { $in: userIds } }).lean()
    assert.equal(rows.length, 2)
    assert.ok(rows.every((row) => row.userId.equals(qualified._id)))
  })

  await t.test('ignores a full score computed from an older profile', async () => {
    await saveMatch(partial._id, torA._id, 100)
    await BidderProfileModel.updateOne(
      { userId: partial._id },
      { $set: { 'organization.registeredCapitalBaht': 1_000_000 } },
    )
    assert.deepEqual(await enqueueForUser(partial._id, [torA._id]), { queued: 0, existing: 0 })
    await BidderProfileModel.updateOne(
      { userId: partial._id },
      { $set: { 'organization.registeredCapitalBaht': 10_000_000 } },
    )
  })

  await t.test('retries a failed delivery later instead of dropping it', async () => {
    mailer.failNext = true
    assert.equal(await processNextBatch('test-worker', mailer, qualified._id), true)

    const rows = await TorNotificationModel.find({ userId: qualified._id }).lean()
    assert.ok(rows.every((row) => row.status === 'failed' && row.attemptCount === 1))
    assert.ok(rows.every((row) => row.nextRetryAt && row.nextRetryAt > new Date()))
    assert.equal(rows[0]?.lastError?.code, 'DELIVERY_FAILED')

    // Not due yet, so nothing is claimed.
    assert.equal(await processNextBatch('test-worker', mailer, qualified._id), false)
    await TorNotificationModel.updateMany(
      { userId: qualified._id },
      { $set: { nextRetryAt: new Date(Date.now() - 1000) } },
    )
  })

  await t.test('sends one email listing every qualifying TOR', async () => {
    assert.equal(await processNextBatch('test-worker', mailer, qualified._id), true)

    assert.equal(mailer.sent.length, 1)
    const [email] = mailer.sent
    assert.equal(email?.to, qualified.email)
    assert.match(email?.subject ?? '', /\(2 รายการ\)/)
    assert.ok(email?.html.includes(`/tor/${torA._id}`))
    assert.ok(email?.html.includes('Project &lt;b&gt;'))
    assert.ok(email?.text.includes('Test Agency'))

    const rows = await TorNotificationModel.find({ userId: qualified._id }).lean()
    assert.ok(rows.every((row) => row.status === 'sent' && row.sentAt))
  })

  await t.test('never sends the same TOR to the same user twice', async () => {
    assert.deepEqual(await enqueueForUser(qualified._id), { queued: 0, existing: 2 })
    assert.equal(await processNextBatch('test-worker', mailer, qualified._id), false)
    assert.equal(mailer.sent.length, 1)
  })

  await t.test('queues each TOR as its new score reaches 100%', async () => {
    await saveMatch(partial._id, torA._id, 100)
    await saveMatch(partial._id, torB._id, 100)

    assert.deepEqual(await enqueueForUser(partial._id, [torA._id]), { queued: 1, existing: 0 })
    assert.deepEqual(await enqueueForUser(partial._id, [torB._id]), { queued: 1, existing: 0 })
  })

  await t.test('skips rows whose TOR closed before sending', async () => {
    await TorModel.updateOne({ _id: torB._id }, { $set: { reviewStatus: 'archived' } })

    assert.equal(await processNextBatch('test-worker', mailer, partial._id), true)
    assert.equal(mailer.sent.length, 2)
    assert.match(mailer.sent[1]?.subject ?? '', /\(1 รายการ\)/)

    const skipped = await TorNotificationModel.findOne({ userId: partial._id, torId: torB._id }).lean()
    assert.equal(skipped?.status, 'skipped')
  })
})
