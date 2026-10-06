import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import { DRAFT_ANNOUNCEMENT_STATUS, publicTorFilter, TorModel } from './tor.model.js'
import type { UpsertTorInput } from './tor.types.js'

test('publicTorFilter hides archived/deleted TORs and drafts unpublished for 60 days', () => {
  assert.deepEqual(publicTorFilter(new Date('2026-10-06T15:30:00.000Z')), {
    reviewStatus: { $nin: ['archived', 'deleted'] },
    $nor: [
      {
        projectStatus: DRAFT_ANNOUNCEMENT_STATUS,
        announceDate: { $lt: new Date('2026-08-07T00:00:00.000Z') },
        reviewStatus: { $ne: 'verified' },
      },
    ],
  })
})

test('validates a structured TOR and exposes its unique source identity index', async () => {
  const input = createTorInput()
  await new TorModel(input).validate()

  const uniqueIndex = TorModel.schema.indexes().find(([, options]) => options.unique === true)?.[0]

  assert.deepEqual(uniqueIndex, {
    dataSourceId: 1,
    externalId: 1,
    sourceVersion: 1,
  })
})

test('rejects confidence values outside zero to one', async () => {
  const input = createTorInput()
  await assert.rejects(() => new TorModel({ ...input, confidence: 1.1 }).validate(), /confidence/)
})

test('stores nullable e-GP details and rejects negative prices', async () => {
  const input = createTorInput()
  const tor = new TorModel({
    ...input,
    departmentName: 'กรมชลประทาน',
    departmentSubName: 'สำนักบริหารจัดการน้ำและอุทกวิทยา',
    projectStatus: 'จัดทำสัญญา/บริหารสัญญา',
    midPriceBaht: 9_014_000,
    awardedPriceBaht: null,
  })

  await tor.validate()
  assert.equal(tor.departmentName, 'กรมชลประทาน')
  await assert.rejects(
    () => new TorModel({ ...input, awardedPriceBaht: -1 }).validate(),
    /awardedPriceBaht/,
  )
})

function createTorInput(): UpsertTorInput {
  return {
    dataSourceId: new Types.ObjectId(),
    ingestionJobId: new Types.ObjectId(),
    externalId: '67119538991',
    sourceVersion: 'initial',
    sourceAdapter: 'central_egp',
    detailUrl: 'https://example.com/project/67119538991',
    projectTitle: 'Software procurement',
    agencyName: null,
    summary: null,
    objectives: [],
    requirements: ['Build the system'],
    bidderQualifications: ['Must be a registered company'],
    technologies: [],
    category: 'enterprise_system',
    budgetBaht: null,
    submissionDeadline: null,
    contactInformation: [],
    classificationReason: 'The TOR requires software development.',
    confidence: 0.9,
    analysisModel: 'test-model',
    analysisVersion: 'v1',
    analyzedAt: new Date('2026-09-01T00:00:00Z'),
    documents: [
      {
        fileName: 'tor.pdf',
        mimeType: 'application/pdf',
        sourceUrl: 'https://example.com/tor.pdf',
      },
    ],
  }
}
