import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import { Types } from 'mongoose'
import request from 'supertest'

import { calculateInterestScore, deriveCategory, getRecommendationsHandler } from './tor.controller.js'
import { TorModel } from './tor.model.js'

// --- deriveCategory (pure) -------------------------------------------------

const categoryCases: Array<{ name: string; technologies: string[]; expected: string }> = [
  { name: 'mobile keyword alone', technologies: ['Flutter'], expected: 'mobile_app' },
  { name: 'mobile keyword lowercase', technologies: ['android'], expected: 'mobile_app' },
  {
    name: 'mobile takes priority even with data/web keywords present',
    technologies: ['React Native', 'Python', 'React'],
    expected: 'mobile_app',
  },
  { name: 'data/BI keywords only', technologies: ['Python', 'Power BI'], expected: 'data_bi' },
  {
    name: 'data/BI keyword excluded when a web keyword is also present',
    technologies: ['python', 'react'],
    expected: 'web_application',
  },
  { name: 'web keyword alone', technologies: ['Vue'], expected: 'web_application' },
  { name: 'web keyword case-insensitive', technologies: ['REACT'], expected: 'web_application' },
  {
    name: 'enterprise keywords explicit',
    technologies: ['.NET', 'SAP'],
    expected: 'enterprise_system',
  },
  {
    name: 'empty technologies falls back to enterprise_system',
    technologies: [],
    expected: 'enterprise_system',
  },
  {
    name: 'unrecognized technology falls back to enterprise_system',
    technologies: ['COBOL'],
    expected: 'enterprise_system',
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
