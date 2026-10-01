import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import { TorModel } from './tor.model.js'
import {
  torFieldsFromSourceMetadata,
  updateTorSourceMetadata,
  upsertTor,
} from './tor.repository.js'
import type { UpsertTorInput } from './tor.types.js'

test('upserts by source identity and returns the persisted TOR', async (context) => {
  const torId = new Types.ObjectId()
  const input = createTorInput()
  let capturedFilter: unknown
  let capturedUpdate: unknown
  let capturedOptions: unknown

  context.mock.method(
    TorModel,
    'findOneAndUpdate',
    (filter: unknown, update: unknown, options: unknown) => {
      capturedFilter = filter
      capturedUpdate = update
      capturedOptions = options
      return { exec: async () => ({ _id: torId }) } as ReturnType<typeof TorModel.findOneAndUpdate>
    },
  )

  const first = await upsertTor(input)
  const second = await upsertTor({ ...input, summary: 'Updated summary' })

  assert.equal(first?._id, torId)
  assert.equal(second?._id, torId)
  assert.deepEqual(capturedFilter, {
    dataSourceId: input.dataSourceId,
    externalId: input.externalId,
    sourceVersion: input.sourceVersion,
  })
  assert.deepEqual(capturedUpdate, { $set: { ...input, summary: 'Updated summary' } })
  assert.deepEqual(capturedOptions, {
    upsert: true,
    returnDocument: 'after',
    runValidators: true,
    setDefaultsOnInsert: true,
  })
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
    agencyName: 'Example agency',
    summary: null,
    objectives: [],
    requirements: [],
    bidderQualifications: [],
    technologies: [],
    budgetBaht: 1000,
    submissionDeadline: null,
    contactInformation: [],
    classificationReason: 'Software is a material requirement.',
    confidence: 0.95,
    analysisModel: 'test-model',
    analysisVersion: 'v1',
    analyzedAt: new Date(),
    documents: [],
  }
}

test('maps GovSpending metadata to TOR fields and drops nulls', () => {
  const announceDate = new Date('2025-06-19T00:00:00Z')

  assert.deepEqual(
    torFieldsFromSourceMetadata({
      title: 'ignored',
      departmentName: 'Dept',
      departmentSubName: null,
      projectStatus: 'ระหว่างดำเนินการ',
      fiscalYear: 2568,
      announceDate,
      budgetBaht: 100,
      midPriceBaht: 90,
      awardedPriceBaht: null,
    }),
    {
      departmentName: 'Dept',
      projectStatus: 'ระหว่างดำเนินการ',
      fiscalYear: 2568,
      announceDate,
      budgetBaht: 100,
      midPriceBaht: 90,
    },
  )
  assert.deepEqual(torFieldsFromSourceMetadata(null), {})
})

test('refreshes existing TORs without creating new ones', async (context) => {
  const dataSourceId = new Types.ObjectId()
  let operations: Array<{ updateOne: Record<string, unknown> }> = []
  context.mock.method(TorModel, 'bulkWrite', async (ops: typeof operations) => {
    operations = ops
    return { modifiedCount: 1 }
  })

  const modified = await updateTorSourceMetadata(dataSourceId, [
    {
      externalId: '68069160377',
      metadata: {
        title: 'Project',
        departmentName: 'Dept',
        departmentSubName: null,
        projectStatus: null,
        fiscalYear: 2568,
        announceDate: null,
        budgetBaht: null,
        midPriceBaht: 90,
        awardedPriceBaht: 80,
      },
    },
  ])

  assert.equal(modified, 1)
  assert.deepEqual(operations[0]?.updateOne, {
    filter: { dataSourceId, externalId: '68069160377', sourceVersion: 'initial' },
    update: {
      $set: { departmentName: 'Dept', fiscalYear: 2568, midPriceBaht: 90, awardedPriceBaht: 80 },
    },
  })
  assert.equal('upsert' in (operations[0]?.updateOne ?? {}), false)
})
