import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import { TorModel } from './tor.model.js'
import { upsertTor } from './tor.repository.js'
import type { UpsertTorInput } from './tor.types.js'

test('upserts by source identity and returns the persisted TOR', async (context) => {
  const torId = new Types.ObjectId()
  const input = createTorInput()
  let capturedFilter: unknown
  let capturedOptions: unknown

  context.mock.method(
    TorModel,
    'findOneAndUpdate',
    (filter: unknown, _update: unknown, options: unknown) => {
      capturedFilter = filter
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
