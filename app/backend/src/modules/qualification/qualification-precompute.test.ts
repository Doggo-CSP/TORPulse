import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'
import { Types } from 'mongoose'

import { processNextJob } from '../../apps/qualification-worker/qualification.worker.js'
import { env } from '../../config/env.js'
import { database } from '../../config/mongoose.js'
import { User } from '../auth/user.model.js'
import { TorModel } from '../tor/tor.model.js'
import { BidderProfileModel } from '../user/bidder-profile.model.js'
import userRouter from '../user/user.routes.js'
import { QualificationJobModel } from './qualification-job.model.js'
import { cardMatchStatus } from './qualification-match.controller.js'
import { QualificationMatchModel } from './qualification-match.model.js'
import { matchAi } from './qualification-match.service.js'
import {
  enqueueMatchesForUser,
  findCandidateTors,
  sweepMatches,
} from './qualification-precompute.service.js'

const SEED_PREFIX = 'seed-qualification-precompute-test-'
const WORKER = 'test-worker'

const AI_ANSWER = JSON.stringify({
  requirements: [
    {
      requirement: 'ทุน 2 ล้าน',
      category: 'financial',
      mandatory: true,
      status: 'met',
      reason: '',
      suggestion: '',
    },
    {
      requirement: 'มี PMP',
      category: 'personnel',
      mandatory: true,
      status: 'partial',
      reason: '',
      suggestion: '',
    },
  ],
  summary: 'ผ่านบางส่วน',
})

test('cardMatchStatus covers every card state', () => {
  const base = { hasRequirements: true, bidderReady: true, match: null, jobStatus: null }
  assert.equal(cardMatchStatus({ ...base, hasRequirements: false }), 'no_requirements')
  assert.equal(cardMatchStatus({ ...base, bidderReady: false }), 'profile_incomplete')
  assert.equal(cardMatchStatus({ ...base, match: { stale: false } }), 'ready')
  assert.equal(cardMatchStatus({ ...base, match: { stale: true }, jobStatus: 'queued' }), 'stale')
  assert.equal(cardMatchStatus({ ...base, jobStatus: 'processing' }), 'pending')
  assert.equal(cardMatchStatus({ ...base, jobStatus: 'failed' }), 'failed')
  assert.equal(cardMatchStatus(base), 'not_evaluated')
})

test('precompute: queue, work, skip, retry, budget and card scores', async (t) => {
  await database.connect()

  const torFields = {
    dataSourceId: new Types.ObjectId(),
    ingestionJobId: new Types.ObjectId(),
    sourceVersion: 'v1',
    sourceAdapter: 'central_egp' as const,
    detailUrl: 'https://example.com/tor',
    classificationReason: 'test',
    confidence: 0.9,
    analysisModel: 'test-model',
    analysisVersion: 'v1',
    analyzedAt: new Date(),
  }
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const [openTor, closedTor, emptyTor] = await TorModel.create([
    {
      ...torFields,
      externalId: `${SEED_PREFIX}open`,
      projectTitle: 'เปิดรับอยู่',
      submissionDeadlineAt: future,
      bidderQualifications: ['ทุนจดทะเบียนไม่น้อยกว่า 2 ล้านบาท'],
    },
    {
      ...torFields,
      externalId: `${SEED_PREFIX}closed`,
      projectTitle: 'ปิดรับแล้ว',
      submissionDeadlineAt: new Date('2020-01-01'),
      bidderQualifications: ['ทุนจดทะเบียนไม่น้อยกว่า 2 ล้านบาท'],
    },
    {
      ...torFields,
      externalId: `${SEED_PREFIX}empty`,
      projectTitle: 'ไม่มีข้อมูลคุณสมบัติ',
      submissionDeadlineAt: future,
    },
  ])
  const torIds = [openTor!._id, closedTor!._id, emptyTor!._id]

  const [readyUser, draftUser] = await User.create([
    {
      googleId: `${SEED_PREFIX}ready`,
      name: 'Ready',
      email: `${SEED_PREFIX}ready@example.com`,
      image: null,
      accountType: 'company',
      companyName: 'Doggo Co., Ltd.',
      businessType: 'Software house',
    },
    {
      googleId: `${SEED_PREFIX}draft`,
      name: 'Draft',
      email: `${SEED_PREFIX}draft@example.com`,
      image: null,
      accountType: 'company',
    },
  ])
  const userIds = [readyUser!._id, draftUser!._id]
  await BidderProfileModel.create([
    {
      userId: readyUser!._id,
      organization: { registeredCapitalBaht: 5_000_000 },
      projects: [{ name: 'ระบบเดิม', contractValueBaht: 3_000_000 }],
    },
    { userId: draftUser!._id },
  ])

  // Other test files may hold open TORs in the same database, so work only this pair
  const mine = { userId: readyUser!._id, torId: openTor!._id }

  let aiCalls = 0
  let aiAnswer: () => Promise<string> = async () => AI_ANSWER
  t.mock.method(matchAi, 'judge', async () => {
    aiCalls += 1
    return aiAnswer()
  })

  t.after(async () => {
    await QualificationJobModel.deleteMany({ userId: { $in: userIds } })
    await QualificationMatchModel.deleteMany({ userId: { $in: userIds } })
    await BidderProfileModel.deleteMany({ userId: { $in: userIds } })
    await User.deleteMany({ _id: { $in: userIds } })
    await TorModel.deleteMany({ _id: { $in: torIds } })
    await database.disconnect()
  })

  const jobOf = (userId: Types.ObjectId, torId: Types.ObjectId) =>
    QualificationJobModel.findOne({ userId, torId }).lean()
  // Lets a queued job run now without waiting for its delay
  const makeDue = (userId: Types.ObjectId) =>
    QualificationJobModel.updateMany(
      { userId, status: 'queued' },
      { $set: { runAfter: new Date(0) } },
    )

  await t.test('candidates are open TORs with requirement text', async () => {
    const ids = (await findCandidateTors()).map((tor) => tor._id.toString())
    assert.ok(ids.includes(openTor!._id.toString()))
    assert.ok(!ids.includes(closedTor!._id.toString()))
    assert.ok(!ids.includes(emptyTor!._id.toString()))
  })

  await t.test(
    'a profile edit queues open TORs after a delay, and only for ready bidders',
    async () => {
      assert.equal(await enqueueMatchesForUser(draftUser!._id, 0), 0)

      await enqueueMatchesForUser(readyUser!._id, 60_000)
      const first = await jobOf(readyUser!._id, openTor!._id)
      assert.equal(first?.status, 'queued')
      assert.ok(first!.runAfter.getTime() > Date.now())
      assert.equal(await jobOf(readyUser!._id, closedTor!._id), null)

      // Not due yet, so the worker finds nothing
      assert.equal(await processNextJob(WORKER, mine), false)

      // Another edit pushes the same job back instead of adding one
      await enqueueMatchesForUser(readyUser!._id, 120_000)
      const pushed = await jobOf(readyUser!._id, openTor!._id)
      assert.ok(pushed!.runAfter.getTime() > first!.runAfter.getTime())
      assert.equal(await QualificationJobModel.countDocuments(mine), 1)
    },
  )

  await t.test('the worker scores a due job with one AI call', async () => {
    await makeDue(readyUser!._id)

    assert.equal(await processNextJob(WORKER, mine), true)
    assert.equal(aiCalls, 1)
    assert.equal((await jobOf(readyUser!._id, openTor!._id))?.status, 'done')
    const match = await QualificationMatchModel.findOne({ userId: readyUser!._id }).lean()
    assert.equal(match?.percentage, 75)
  })

  await t.test('re-queueing without a real change costs no AI call', async () => {
    await enqueueMatchesForUser(readyUser!._id, 0)
    await processNextJob(WORKER, mine)

    assert.equal(aiCalls, 1)
    const job = await jobOf(readyUser!._id, openTor!._id)
    assert.equal(job?.status, 'done')
    assert.equal(job?.lastError, 'Already up to date')
  })

  await t.test('the sweep re-queues a stale result and the worker redoes it', async () => {
    await BidderProfileModel.updateOne(
      { userId: readyUser!._id },
      { $set: { 'organization.registeredCapitalBaht': 9_000_000 } },
    )

    await sweepMatches()
    assert.equal((await jobOf(readyUser!._id, openTor!._id))?.status, 'queued')

    await processNextJob(WORKER, mine)
    assert.equal(aiCalls, 2)
  })

  await t.test('an AI failure is retried later, not dropped', async () => {
    aiAnswer = async () => {
      throw new Error('quota exceeded')
    }
    await BidderProfileModel.updateOne(
      { userId: readyUser!._id },
      { $set: { 'organization.registeredCapitalBaht': 9_500_000 } },
    )
    await enqueueMatchesForUser(readyUser!._id, 0)
    await processNextJob(WORKER, mine)

    const job = await jobOf(readyUser!._id, openTor!._id)
    assert.equal(job?.status, 'queued')
    assert.equal(job?.attemptCount, 1)
    assert.equal(job?.lastError, 'quota exceeded')
    assert.ok(job!.runAfter.getTime() > Date.now())
    aiAnswer = async () => AI_ANSWER
  })

  await t.test('the daily limit postpones the job without using an attempt', async (st) => {
    const limit = env.QUALIFICATION_DAILY_CALL_LIMIT
    env.QUALIFICATION_DAILY_CALL_LIMIT = 0
    st.after(() => {
      env.QUALIFICATION_DAILY_CALL_LIMIT = limit
    })
    await makeDue(readyUser!._id)
    const calls = aiCalls

    await processNextJob(WORKER, mine)

    const job = await jobOf(readyUser!._id, openTor!._id)
    assert.equal(aiCalls, calls)
    assert.equal(job?.status, 'queued')
    assert.equal(job?.attemptCount, 1)
    assert.equal(job?.lastError, 'Daily AI call limit reached')
  })

  await t.test('a job whose bidder is no longer ready is skipped', async () => {
    await QualificationJobModel.create({
      userId: draftUser!._id,
      torId: openTor!._id,
      status: 'queued',
      runAfter: new Date(0),
    })

    await processNextJob(WORKER, { userId: draftUser!._id, torId: openTor!._id })
    assert.equal((await jobOf(draftUser!._id, openTor!._id))?.status, 'skipped')
  })

  await t.test('GET /user/qualification-matches returns a status for every card', async () => {
    const app = express()
    app.use((req, _res, next) => {
      req.user = {
        _id: readyUser!._id,
        googleId: readyUser!.googleId,
        name: readyUser!.name,
        email: readyUser!.email,
        image: null,
      }
      next()
    })
    app.use('/user', userRouter)

    const response = await request(app).get(
      `/user/qualification-matches?torIds=${torIds.map(String).join(',')}`,
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.completeness.isComplete, true)
    const byId = new Map(
      response.body.items.map((item: { torId: string }) => [item.torId, item]),
    ) as Map<string, { status: string; percentage: number | null }>
    // The capital changed after the last successful score, so it shows as stale with the old score
    assert.equal(byId.get(openTor!._id.toString())?.status, 'stale')
    assert.equal(byId.get(openTor!._id.toString())?.percentage, 75)
    assert.equal(byId.get(closedTor!._id.toString())?.status, 'not_evaluated')
    assert.equal(byId.get(emptyTor!._id.toString())?.status, 'no_requirements')

    const invalid = await request(app).get('/user/qualification-matches?torIds=nope')
    assert.equal(invalid.status, 400)
  })
})
