import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import { Types } from 'mongoose'
import request from 'supertest'

import {
  calculateInterestScore,
  deriveCategory,
  getRecommendationsHandler,
  getTorByIdHandler,
  toTorListItem,
} from './tor.controller.js'
import { TorModel } from './tor.model.js'

// --- deriveCategory (pure) -------------------------------------------------

const categoryCases: Array<{ name: string; technologies: string[]; expected: string }> = [
  { name: 'mobile keyword alone', technologies: ['Flutter'], expected: 'mobile' },
  { name: 'mobile keyword lowercase', technologies: ['android'], expected: 'mobile' },
  {
    name: 'mobile takes priority even with data/web keywords present',
    technologies: ['React Native', 'Python', 'React'],
    expected: 'mobile',
  },
  { name: 'data/BI keywords only', technologies: ['Python', 'Power BI'], expected: 'data' },
  {
    name: 'data/BI keyword excluded when a web keyword is also present',
    technologies: ['python', 'react'],
    expected: 'web',
  },
  { name: 'web keyword alone', technologies: ['Vue'], expected: 'web' },
  { name: 'web keyword case-insensitive', technologies: ['REACT'], expected: 'web' },
  {
    name: 'enterprise keywords explicit',
    technologies: ['.NET', 'SAP'],
    expected: 'enterprise',
  },
  {
    name: 'consulting/architecture keyword',
    technologies: ['IT Consulting'],
    expected: 'consulting',
  },
  {
    name: 'web keyword takes priority over consulting/architecture keyword',
    technologies: ['React', 'Consulting'],
    expected: 'web',
  },
  {
    name: 'empty technologies falls back to enterprise',
    technologies: [],
    expected: 'enterprise',
  },
  {
    name: 'unrecognized technology falls back to enterprise',
    technologies: ['COBOL'],
    expected: 'enterprise',
  },
]

for (const { name, technologies, expected } of categoryCases) {
  test(`deriveCategory: ${name}`, () => {
    assert.equal(deriveCategory(technologies), expected)
  })
}

// --- calculateInterestScore (pure) -----------------------------------------

test('calculateInterestScore is deterministic for the same tor and profile', () => {
  const tor = { _id: new Types.ObjectId() }
  const profile = { userId: 'user-1' }

  assert.equal(calculateInterestScore(tor, profile), calculateInterestScore(tor, profile))
})

test('calculateInterestScore always returns a value within [50, 95]', () => {
  for (let i = 0; i < 50; i++) {
    const score = calculateInterestScore({ _id: new Types.ObjectId() }, { userId: 'user-1' })
    assert.ok(score >= 50 && score <= 95, `score ${score} out of range`)
  }
})

test('calculateInterestScore typically differs across different tor ids', () => {
  const scores = new Set(
    Array.from({ length: 20 }, () =>
      calculateInterestScore({ _id: new Types.ObjectId() }, { userId: 'user-1' }),
    ),
  )

  assert.ok(scores.size > 1, 'expected scores to vary across different tor ids')
})

test('GET /tors/:id returns authoritative e-GP details', async (context) => {
  const id = new Types.ObjectId()
  context.mock.method(TorModel, 'findById', () => ({
    lean: async () => ({
      _id: id,
      externalId: '68089351005',
      sourceAdapter: 'central_egp',
      sourceVersion: 'initial',
      detailUrl: 'https://example.com',
      projectTitle: 'Project',
      agencyName: 'AI agency',
      departmentName: 'กรมชลประทาน',
      departmentSubName: 'สำนักบริหารจัดการน้ำและอุทกวิทยา',
      projectStatus: 'จัดทำสัญญา/บริหารสัญญา',
      summary: null,
      objectives: [],
      requirements: [],
      bidderQualifications: [],
      technologies: [],
      budgetBaht: 10_000_000,
      midPriceBaht: 9_014_000,
      awardedPriceBaht: 9_000_000,
      submissionDeadline: null,
      contactInformation: [],
      classificationReason: 'Software project',
      confidence: 0.9,
      analyzedAt: new Date('2026-09-01T00:00:00Z'),
      documents: [],
      createdAt: new Date('2026-09-01T00:00:00Z'),
      updatedAt: new Date('2026-09-02T00:00:00Z'),
    }),
  }))
  const app = express()
  app.get('/tors/:id', getTorByIdHandler)

  const response = await request(app).get(`/tors/${id}`)

  assert.equal(response.status, 200)
  assert.equal(response.body.departmentName, 'กรมชลประทาน')
  assert.equal(response.body.departmentSubName, 'สำนักบริหารจัดการน้ำและอุทกวิทยา')
  assert.equal(response.body.projectStatus, 'จัดทำสัญญา/บริหารสัญญา')
  assert.equal(response.body.midPriceBaht, 9_014_000)
  assert.equal(response.body.awardedPriceBaht, 9_000_000)
})

// --- getRecommendationsHandler (mocked TorModel.find) -----------------------

test('GET /recommendations requires auth, then returns deterministic scored items', async (context) => {
  const fakeTors = [
    {
      _id: new Types.ObjectId(),
      projectTitle: 'Project A',
      agencyName: 'Agency A',
      budgetBaht: 1000,
      submissionDeadline: null,
      technologies: ['React'],
    },
    {
      _id: new Types.ObjectId(),
      projectTitle: 'Project B',
      agencyName: 'Agency B',
      budgetBaht: 2000,
      submissionDeadline: null,
      technologies: ['Python'],
    },
    {
      _id: new Types.ObjectId(),
      projectTitle: 'Project C',
      agencyName: null,
      budgetBaht: null,
      submissionDeadline: null,
      technologies: [],
    },
  ]

  context.mock.method(TorModel, 'find', () => ({
    sort: () => ({
      limit: () => ({
        lean: async () => fakeTors,
      }),
    }),
  }))

  const guestApp = express()
  guestApp.get('/recommendations', getRecommendationsHandler)
  const guestResponse = await request(guestApp).get('/recommendations')
  assert.equal(guestResponse.status, 401)
  assert.deepEqual(guestResponse.body, { error: 'Unauthorized' })

  const authedApp = express()
  authedApp.use((req, _res, next) => {
    req.user = {
      _id: new Types.ObjectId('64b000000000000000000001'),
      googleId: 'google-id',
      name: 'Test User',
      email: 'test@example.com',
      image: null,
    }
    next()
  })
  authedApp.get('/recommendations', getRecommendationsHandler)

  const firstResponse = await request(authedApp).get('/recommendations')
  const secondResponse = await request(authedApp).get('/recommendations')

  assert.equal(firstResponse.status, 200)
  assert.equal(firstResponse.body.items.length, 3)
  for (const item of firstResponse.body.items) {
    assert.ok(item.score >= 50 && item.score <= 95, `score ${item.score} out of range`)
  }
  assert.deepEqual(firstResponse.body, secondResponse.body)
})

test('list items expose an ISO deadline and the raw deadline text', () => {
  const base = {
    _id: 'id',
    externalId: '69019037579',
    sourceAdapter: 'central_egp',
    projectTitle: 'Project',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  }

  const stored = toTorListItem({
    ...base,
    submissionDeadline: '15 มกราคม 2569',
    submissionDeadlineAt: new Date('2026-01-15T00:00:00Z'),
  })
  assert.equal(stored.submissionDeadline, '2026-01-15')
  assert.equal(stored.submissionDeadlineText, '15 มกราคม 2569')

  // Older TOR without submissionDeadlineAt is parsed on the fly.
  assert.equal(
    toTorListItem({ ...base, submissionDeadline: '2025-11-17T16:00:00' }).submissionDeadline,
    '2025-11-17',
  )

  const monthOnly = toTorListItem({ ...base, submissionDeadline: 'มกราคม 2569' })
  assert.equal(monthOnly.submissionDeadline, null)
  assert.equal(monthOnly.submissionDeadlineText, 'มกราคม 2569')

  assert.equal(toTorListItem({ ...base, submissionDeadline: 'null' }).submissionDeadlineText, null)
})
