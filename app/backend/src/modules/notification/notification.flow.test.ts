import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import { processNextBatch } from '../../apps/notification-worker/notification.worker.js'
import { env } from '../../config/env.js'
import { database } from '../../config/mongoose.js'
import { User } from '../auth/user.model.js'
import { TorModel } from '../tor/tor.model.js'
import type { MailMessage, Mailer } from './mailer.js'
import { enqueueForTor, enqueueForUser } from './notification.service.js'
import { TorNotificationModel } from './tor-notification.model.js'

const SEED_PREFIX = 'seed-notification-flow-test-'
// A category no real user has, so the enqueue queries only ever match the test users.
const TEST_CATEGORY = 'seed_notification_flow_test'

const qualification = {
  registeredCapitalBaht: 10_000_000,
  yearsInBusiness: 5,
  maxPastContractValueBaht: 3_000_000,
  certifications: ['iso27001'],
  isThaiJuristicPerson: true,
  isSme: false,
}

const eligibility = {
  minRegisteredCapitalBaht: 5_000_000,
  minYearsInBusiness: 3,
  minPastContractValueBaht: null,
  requiredCertifications: ['iso27001'],
  requiresThaiJuristicPerson: true,
  smeOnly: null,
  unmappedQualifications: [],
}

function createUser(suffix: string, overrides: Record<string, unknown> = {}) {
  return User.create({
    googleId: `${SEED_PREFIX}${suffix}`,
    name: `Test ${suffix}`,
    email: `${SEED_PREFIX}${suffix}@example.com`,
    image: null,
    accountType: 'company',
    companyName: `${suffix} Co., Ltd.`,
    registrationNumber: '0105560000000',
    interests: [TEST_CATEGORY],
    qualification,
    ...overrides,
  })
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
    categories: [TEST_CATEGORY],
    eligibility,
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

test('notification flow: qualify, batch, send once, retry on failure', async (t) => {
  await database.connect()
  const originalFrom = env.NOTIFICATION_FROM
  env.NOTIFICATION_FROM ??= 'notify@example.com'

  const qualified = await createUser('qualified')
  const underCapital = await createUser('under-capital', {
    qualification: { ...qualification, registeredCapitalBaht: 1_000_000 },
  })
  const optedOut = await createUser('opted-out', { notificationPrefs: { emailEnabled: false } })
  const torA = await createTor('a')
  const torB = await createTor('b')
  const unmappedTor = await createTor('unmapped', {
    eligibility: { ...eligibility, unmappedQualifications: ['มีศูนย์บริการในจังหวัด'] },
  })
  const userIds = [qualified._id, underCapital._id, optedOut._id]
  const torIds = [torA._id, torB._id, unmappedTor._id]

  t.after(async () => {
    env.NOTIFICATION_FROM = originalFrom
    await TorNotificationModel.deleteMany({ userId: { $in: userIds } })
    await User.deleteMany({ _id: { $in: userIds } })
    await TorModel.deleteMany({ _id: { $in: torIds } })
    await database.disconnect()
  })

  const mailer = recordingMailer()

  await t.test('queues a new TOR only for users who fully qualify', async () => {
    assert.deepEqual(await enqueueForTor(torA._id), { queued: 1, existing: 0 })
    assert.deepEqual(await enqueueForTor(torB._id), { queued: 1, existing: 0 })
    assert.deepEqual(await enqueueForTor(unmappedTor._id), { queued: 0, existing: 0 })

    const rows = await TorNotificationModel.find({ userId: { $in: userIds } }).lean()
    assert.equal(rows.length, 2)
    assert.ok(rows.every((row) => row.userId.equals(qualified._id)))
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
    assert.deepEqual(await enqueueForTor(torA._id), { queued: 0, existing: 1 })
    assert.deepEqual(await enqueueForUser(qualified._id), { queued: 0, existing: 2 })
    assert.equal(await processNextBatch('test-worker', mailer, qualified._id), false)
    assert.equal(mailer.sent.length, 1)
  })

  await t.test('queues open TORs after a profile update makes the user qualify', async () => {
    await User.updateOne({ _id: underCapital._id }, { $set: { 'qualification.registeredCapitalBaht': 20_000_000 } })

    assert.deepEqual(await enqueueForUser(underCapital._id), { queued: 2, existing: 0 })
    assert.deepEqual(await enqueueForUser(optedOut._id), { queued: 0, existing: 0 })
  })

  await t.test('skips rows whose TOR closed before sending', async () => {
    await TorModel.updateOne({ _id: torB._id }, { $set: { reviewStatus: 'archived' } })

    assert.equal(await processNextBatch('test-worker', mailer, underCapital._id), true)
    assert.equal(mailer.sent.length, 2)
    assert.match(mailer.sent[1]?.subject ?? '', /\(1 รายการ\)/)

    const skipped = await TorNotificationModel.findOne({ userId: underCapital._id, torId: torB._id }).lean()
    assert.equal(skipped?.status, 'skipped')
  })
})
