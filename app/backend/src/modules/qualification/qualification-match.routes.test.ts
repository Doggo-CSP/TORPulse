import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'
import { Types } from 'mongoose'

import { database } from '../../config/mongoose.js'
import { User } from '../auth/user.model.js'
import torRouter from '../tor/tor.routes.js'
import { TorModel } from '../tor/tor.model.js'
import { BidderProfileModel } from '../user/bidder-profile.model.js'
import { QualificationMatchModel } from './qualification-match.model.js'
import { matchAi } from './qualification-match.service.js'

const SEED_PREFIX = 'seed-qualification-match-test-'

const AI_ANSWER = JSON.stringify({
  requirements: [
    {
      requirement: 'ทุนจดทะเบียนไม่น้อยกว่า 2 ล้านบาท',
      category: 'financial',
      mandatory: true,
      status: 'met',
      reason: 'ทุนจดทะเบียน 5 ล้านบาท',
      suggestion: '',
    },
    {
      requirement: 'ผู้จัดการโครงการต้องมี PMP',
      category: 'personnel',
      mandatory: true,
      status: 'not_met',
      reason: 'ไม่มีคนในทีมที่มี PMP',
      suggestion: 'เพิ่มผู้จัดการโครงการที่มี PMP',
    },
  ],
  summary: 'ผ่านเรื่องทุน แต่ยังขาดผู้จัดการโครงการที่มี PMP',
})

test('qualification match routes: evaluate, cache, stale and errors', async (t) => {
  await database.connect()

  const testUser = await User.create({
    googleId: `${SEED_PREFIX}google-id`,
    name: 'Match Test User',
    email: `${SEED_PREFIX}user@example.com`,
    image: null,
    accountType: 'company',
    companyName: 'Doggo Co., Ltd.',
    businessType: 'Software house',
  })

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
  const tor = await TorModel.create({
    ...torFields,
    externalId: `${SEED_PREFIX}tor-1`,
    projectTitle: 'จ้างพัฒนาระบบสารสนเทศ',
    bidderQualifications: ['ทุนจดทะเบียนไม่น้อยกว่า 2 ล้านบาท'],
    requirements: ['ผู้จัดการโครงการต้องมี PMP'],
  })
  const emptyTor = await TorModel.create({
    ...torFields,
    externalId: `${SEED_PREFIX}tor-empty`,
    projectTitle: 'TOR ที่ยังไม่มีข้อมูลคุณสมบัติ',
  })

  let aiCalls = 0
  let aiAnswer: () => Promise<string> = async () => AI_ANSWER
  t.mock.method(matchAi, 'judge', async () => {
    aiCalls += 1
    return aiAnswer()
  })

  t.after(async () => {
    await QualificationMatchModel.deleteMany({ userId: testUser._id })
    await BidderProfileModel.deleteMany({ userId: testUser._id })
    await TorModel.deleteMany({ _id: { $in: [tor._id, emptyTor._id] } })
    await User.deleteOne({ _id: testUser._id })
    await database.disconnect()
  })

  let loggedIn = true
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    if (loggedIn) {
      req.user = {
        _id: testUser._id,
        googleId: testUser.googleId,
        name: testUser.name,
        email: testUser.email,
        image: testUser.image,
      }
    }
    next()
  })
  app.use('/tors', torRouter)

  const url = `/tors/${tor._id.toString()}/qualification`

  await t.test('requires login', async () => {
    loggedIn = false
    const response = await request(app).get(url)
    loggedIn = true
    assert.equal(response.status, 401)
  })

  await t.test('refuses to match before the bidder profile exists', async () => {
    const response = await request(app).post(url)

    assert.equal(response.status, 409)
    assert.ok(response.body.completeness.missing.includes('projects'))
    assert.equal(aiCalls, 0)
  })

  await t.test('GET returns no match before the first evaluation', async () => {
    await BidderProfileModel.create({
      userId: testUser._id,
      organization: { registeredCapitalBaht: 5_000_000 },
    })

    const response = await request(app).get(url)

    assert.equal(response.status, 200)
    assert.equal(response.body.match, null)
    assert.equal(response.body.isStale, false)
  })

  await t.test('POST evaluates with the AI and returns the score', async () => {
    const response = await request(app).post(url)

    assert.equal(response.status, 200)
    assert.equal(aiCalls, 1)
    const { match } = response.body
    assert.equal(match.percentage, 50)
    assert.equal(match.allMandatoryMet, false)
    assert.deepEqual(match.counts, { met: 1, partial: 0, notMet: 1, unknown: 0 })
    assert.equal(match.requirements[1].suggestion, 'เพิ่มผู้จัดการโครงการที่มี PMP')
  })

  await t.test('POST again reuses the cached result without calling the AI', async () => {
    const response = await request(app).post(url)

    assert.equal(response.status, 200)
    assert.equal(aiCalls, 1)
    assert.equal(response.body.match.percentage, 50)
  })

  await t.test('editing the profile marks the result stale, POST recomputes it', async () => {
    await BidderProfileModel.updateOne(
      { userId: testUser._id },
      { $set: { 'organization.isSme': true } },
    )

    const stale = await request(app).get(url)
    assert.equal(stale.body.isStale, true)
    assert.equal(stale.body.match.percentage, 50)

    const fresh = await request(app).post(url)
    assert.equal(fresh.status, 200)
    assert.equal(fresh.body.isStale, false)
    assert.equal(aiCalls, 2)
  })

  await t.test('?force=true recomputes even when nothing changed', async () => {
    await request(app).post(`${url}?force=true`)
    assert.equal(aiCalls, 3)
  })

  await t.test('an AI failure answers 502 and keeps the previous result', async () => {
    aiAnswer = async () => {
      throw new Error('upstream down')
    }

    const response = await request(app).post(`${url}?force=true`)
    assert.equal(response.status, 502)

    const kept = await request(app).get(url)
    assert.equal(kept.body.match.percentage, 50)
    aiAnswer = async () => AI_ANSWER
  })

  await t.test('a TOR without requirement text answers 422 without calling the AI', async () => {
    const calls = aiCalls
    const response = await request(app).post(`/tors/${emptyTor._id.toString()}/qualification`)

    assert.equal(response.status, 422)
    assert.equal(aiCalls, calls)
  })

  await t.test('unknown and malformed TOR ids', async () => {
    const missing = await request(app).get(`/tors/${new Types.ObjectId().toString()}/qualification`)
    assert.equal(missing.status, 404)

    const invalid = await request(app).get('/tors/not-an-id/qualification')
    assert.equal(invalid.status, 400)
  })
})
