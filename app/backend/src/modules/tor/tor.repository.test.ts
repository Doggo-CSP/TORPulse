import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import { TorModel } from './tor.model.js'
import { upsertTor } from './tor.repository.js'
import type { UpsertTorInput } from './tor.types.js'

const mockExisting = (context: test.TestContext, existing: Record<string, unknown> | null) =>
  context.mock.method(TorModel, 'findOne', () => ({ lean: async () => existing }))

const mockUpsert = (context: test.TestContext, torId: Types.ObjectId) => {
  const calls: {
    filter: unknown
    update: Record<string, Record<string, unknown>>
    options: unknown
  }[] = []
  context.mock.method(
    TorModel,
    'findOneAndUpdate',
    (filter: unknown, update: unknown, options: unknown) => {
      calls.push({ filter, update: update as Record<string, Record<string, unknown>>, options })
      return { exec: async () => ({ _id: torId }) } as ReturnType<typeof TorModel.findOneAndUpdate>
    },
  )
  return calls
}

test('upserts by source identity and returns the persisted TOR', async (context) => {
  const torId = new Types.ObjectId()
  const input = createTorInput()
  mockExisting(context, null)
  const calls = mockUpsert(context, torId)

  const first = await upsertTor(input)
  const second = await upsertTor({ ...input, summary: 'Updated summary' })

  assert.equal(first?._id, torId)
  assert.equal(second?._id, torId)
  assert.deepEqual(calls[1]?.filter, {
    dataSourceId: input.dataSourceId,
    externalId: input.externalId,
    sourceVersion: input.sourceVersion,
  })
  const { lastSeenAt, ...rest } = calls[1]!.update.$set!
  assert.deepEqual(rest, { ...input, summary: 'Updated summary' })
  assert.ok(lastSeenAt instanceof Date)
  assert.deepEqual(calls[1]?.options, {
    upsert: true,
    returnDocument: 'after',
    runValidators: true,
    setDefaultsOnInsert: true,
  })
})

for (const [reason, existing] of [
  ['edited by an admin', { lastEditedAt: new Date() }],
  ['verified', { reviewStatus: 'verified' }],
  ['category overridden', { categoryOverridden: true }],
] as const) {
  test(`does not overwrite AI-extracted fields of a TOR ${reason}`, async (context) => {
    const input = {
      ...createTorInput(),
      summary: 'New AI summary',
      technologies: ['React'],
      budgetBaht: 1,
      category: 'web_application' as const,
      awardedPriceBaht: 900,
      documents: [
        {
          fileName: 'tor.pdf',
          mimeType: 'application/pdf',
          sourceUrl: 'https://example.com/t.pdf',
        },
      ],
    }
    mockExisting(context, existing)
    const calls = mockUpsert(context, new Types.ObjectId())

    await upsertTor(input)

    const set = calls[0]!.update.$set!
    for (const aiField of [
      'summary',
      'technologies',
      'budgetBaht',
      'category',
      'projectTitle',
      'confidence',
      'requirements',
    ]) {
      assert.equal(aiField in set, false, `${aiField} must not be overwritten`)
    }
    assert.deepEqual(set.documents, input.documents)
    assert.equal(set.awardedPriceBaht, 900)
    assert.ok(set.lastSeenAt instanceof Date)
    assert.deepEqual(calls[0]?.options, { returnDocument: 'after', runValidators: true })
  })
}

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
    category: 'enterprise_system',
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
