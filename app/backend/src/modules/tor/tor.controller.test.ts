import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import { Types } from 'mongoose'
import request from 'supertest'

import {
  compareByDeadline,
  deriveCategory,
  getRecommendationsHandler,
  getTorByIdHandler,
  resolveTorCategory,
  toTorListItem,
} from './tor.controller.js'
import { User } from '../auth/user.model.js'
import { CategoryModel } from '../category/category.model.js'
import { QualificationMatchModel } from '../qualification/qualification-match.model.js'
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
    name: 'consulting/architecture keyword',
    technologies: ['IT Consulting'],
    expected: 'consulting_architecture',
  },
  {
    name: 'web keyword takes priority over consulting/architecture keyword',
    technologies: ['React', 'Consulting'],
    expected: 'web_application',
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
  { name: 'AI keyword', technologies: ['Machine Learning'], expected: 'ai_ml' },
  { name: 'OCR maps to AI/ML', technologies: ['OCR'], expected: 'ai_ml' },
  { name: 'short AI token must be the whole name', technologies: ['AI'], expected: 'ai_ml' },
  {
    name: 'short AI token inside another word does not match',
    technologies: ['Email Gateway'],
    expected: 'enterprise_system',
  },
  {
    name: 'AI/ML takes priority over web',
    technologies: ['React', 'LLM'],
    expected: 'ai_ml',
  },
  {
    name: 'cybersecurity keyword',
    technologies: ['Penetration Testing'],
    expected: 'cybersecurity',
  },
  { name: 'SOC as a whole name', technologies: ['SOC'], expected: 'cybersecurity' },
  {
    name: 'SOC inside another word does not match',
    technologies: ['Social Listening'],
    expected: 'enterprise_system',
  },
  { name: 'cloud keyword', technologies: ['AWS', 'Kubernetes'], expected: 'cloud_infrastructure' },
  {
    name: 'SQL Server stays data/BI even though it contains "server"',
    technologies: ['SQL Server'],
    expected: 'data_bi',
  },
  {
    name: 'web takes priority over cloud',
    technologies: ['React', 'Docker'],
    expected: 'web_application',
  },
]

test('resolveTorCategory prefers a stored category over the keyword rules', () => {
  assert.equal(
    resolveTorCategory({ category: 'cybersecurity', technologies: ['React'] }),
    'cybersecurity',
  )
  assert.equal(resolveTorCategory({ category: null, technologies: ['React'] }), 'web_application')
  assert.equal(resolveTorCategory({ technologies: [] }), 'enterprise_system')
})

for (const { name, technologies, expected } of categoryCases) {
  test(`deriveCategory: ${name}`, () => {
    assert.equal(deriveCategory(technologies), expected)
  })
}

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
  // A TOR stored before scope/deliverables/timeline/evaluationCriteria existed gets safe defaults
  assert.equal(response.body.scope, null)
  assert.deepEqual(response.body.deliverables, [])
  assert.deepEqual(response.body.timeline, [])
  assert.deepEqual(response.body.evaluationCriteria, [])
})

// --- getRecommendationsHandler (mocked TorModel.find) -----------------------

test('GET /recommendations requires auth, then ranks open TORs by match and interest', async (context) => {
  const tor = (title: string, extra: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(),
    externalId: title,
    sourceAdapter: 'bma_egp',
    projectTitle: title,
    agencyName: null,
    budgetBaht: null,
    submissionDeadline: null,
    technologies: [],
    category: 'data_bi',
    categories: ['data_bi'],
    createdAt: new Date('2026-11-01T00:00:00Z'),
    ...extra,
  })
  // A: 90% in an interest category; B: 100% outside; C: no score yet, in an interest category
  const tors = [
    tor('B'),
    tor('C', { category: 'web_application', categories: ['web_application'] }),
    tor('A', { category: 'web_application', categories: ['web_application'] }),
  ]
  const [b, , a] = tors

  context.mock.method(TorModel, 'find', () => ({
    sort: () => ({ limit: () => ({ lean: async () => tors }) }),
  }))
  context.mock.method(CategoryModel, 'find', () => ({
    lean: async () => [
      { key: 'web_application', name: 'งานพัฒนาเว็บไซต์' },
      { key: 'data_bi', name: 'งานข้อมูลและวิเคราะห์' },
    ],
  }))
  context.mock.method(User, 'findById', () => ({
    select: () => ({ lean: async () => ({ interests: ['web_application'] }) }),
  }))
  context.mock.method(QualificationMatchModel, 'find', () => ({
    select: () => ({
      lean: async () => [
        { torId: a!._id, percentage: 90, allMandatoryMet: true },
        { torId: b!._id, percentage: 100, allMandatoryMet: true },
      ],
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

  const response = await request(authedApp).get('/recommendations')

  assert.equal(response.status, 200)
  // Three open TORs are fewer than five, so closed ones are looked up too; the mock returns the
  // same three, which come after the open ones
  assert.deepEqual(
    response.body.items.slice(0, 3).map((item: { projectTitle: string }) => item.projectTitle),
    ['A', 'B', 'C'],
  )
  const [first, second, third] = response.body.items
  assert.equal(first.score, 93) // 0.7 × 90 + 0.3 × 100
  assert.equal(second.score, 70) // 0.7 × 100
  assert.equal(third.score, null)
  assert.deepEqual(first.recommendation, {
    score: 93,
    qualificationPercentage: 90,
    allMandatoryMet: true,
    matchesInterest: true,
    isOpen: true,
  })
  assert.equal(third.recommendation.matchesInterest, true)
  assert.equal(response.body.items.length, 5)
  assert.equal(response.body.items[3].recommendation.isOpen, false)
  assert.equal(first.categoryName, 'งานพัฒนาเว็บไซต์')
})

test('list items expose an ISO deadline and the raw deadline text', () => {
  const base = {
    _id: 'id',
    externalId: '69019037579',
    sourceAdapter: 'central_egp',
    projectTitle: 'Project',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  }

  const stored = toTorListItem(
    {
      ...base,
      submissionDeadline: '15 มกราคม 2569',
      submissionDeadlineAt: new Date('2026-01-15T00:00:00Z'),
    },
    new Map(),
  )
  assert.equal(stored.submissionDeadline, '2026-01-15')
  assert.equal(stored.submissionDeadlineText, '15 มกราคม 2569')

  // Older TOR without submissionDeadlineAt is parsed on the fly.
  assert.equal(
    toTorListItem({ ...base, submissionDeadline: '2025-11-17T16:00:00' }, new Map())
      .submissionDeadline,
    '2025-11-17',
  )

  const monthOnly = toTorListItem({ ...base, submissionDeadline: 'มกราคม 2569' }, new Map())
  assert.equal(monthOnly.submissionDeadline, null)
  assert.equal(monthOnly.submissionDeadlineText, 'มกราคม 2569')

  assert.equal(
    toTorListItem({ ...base, submissionDeadline: 'null' }, new Map()).submissionDeadlineText,
    null,
  )
})

// --- compareByDeadline (pure) ----------------------------------------------

test('compareByDeadline: open soonest first, then closed most recent first, then no deadline', () => {
  const tors = [
    { id: 'none', submissionDeadline: null },
    { id: 'closed-old', submissionDeadline: '2026-01-01' },
    { id: 'open-late', submissionDeadline: '2026-12-01' },
    { id: 'closed-recent', submissionDeadline: '2026-10-01' },
    { id: 'today', submissionDeadline: '2026-10-04' },
    { id: 'open-soon', submissionDeadline: '2026-10-10' },
  ]

  const sorted = [...tors].sort((a, b) => compareByDeadline(a, b, '2026-10-04'))

  assert.deepEqual(
    sorted.map((t) => t.id),
    ['today', 'open-soon', 'open-late', 'closed-recent', 'closed-old', 'none'],
  )
})

test('compareByDeadline: in-progress projects count as closed even with a future deadline', () => {
  const tors = [
    { id: 'in-progress', submissionDeadline: '2026-10-05', projectStatus: ' ระหว่างดำเนินการ ' },
    { id: 'open-late', submissionDeadline: '2026-12-01', projectStatus: null },
  ]

  const sorted = [...tors].sort((a, b) => compareByDeadline(a, b, '2026-10-04'))

  assert.deepEqual(
    sorted.map((t) => t.id),
    ['open-late', 'in-progress'],
  )
})
