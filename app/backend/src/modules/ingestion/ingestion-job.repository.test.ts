import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import { IngestionJobModel } from './ingestion-job.model.js'
import {
  completeJob,
  enqueueDiscoveredProjects,
  requeueJobs,
  updateJobStage,
} from './ingestion-job.repository.js'

test('stage updates renew the worker lease', async (context) => {
  const jobId = new Types.ObjectId()
  let capturedUpdate: Record<string, Record<string, unknown>> | undefined

  context.mock.method(IngestionJobModel, 'updateOne', async (_filter: unknown, update: unknown) => {
    capturedUpdate = update as Record<string, Record<string, unknown>>
    return { modifiedCount: 1 }
  })

  await updateJobStage(jobId, 'worker-1', 'storing')

  assert.equal(capturedUpdate?.$set?.currentStage, 'storing')
  assert.ok(capturedUpdate?.$set?.lockedUntil instanceof Date)
})

test('completion requires a processing job owned by the worker', async (context) => {
  const jobId = new Types.ObjectId()
  const torId = new Types.ObjectId()
  let capturedFilter: Record<string, unknown> | undefined

  context.mock.method(IngestionJobModel, 'updateOne', async (filter: unknown) => {
    capturedFilter = filter as Record<string, unknown>
    return { modifiedCount: 1 }
  })

  await completeJob(jobId, 'worker-1', torId)

  assert.equal(capturedFilter?.status, 'processing')
  assert.equal(capturedFilter?.lockedBy, 'worker-1')
})

test('requeue resets finished jobs and skips jobs with a live lease', async (context) => {
  let capturedFilter: Record<string, unknown> | undefined
  let capturedUpdate: Record<string, Record<string, unknown>> | undefined

  context.mock.method(IngestionJobModel, 'updateMany', async (filter: unknown, update: unknown) => {
    capturedFilter = filter as Record<string, unknown>
    capturedUpdate = update as Record<string, Record<string, unknown>>
    return { matchedCount: 3, modifiedCount: 3 }
  })

  const result = await requeueJobs(['failed', 'rejected'])

  assert.deepEqual(result, { matched: 3, requeued: 3 })
  assert.deepEqual(capturedFilter?.status, { $in: ['failed', 'rejected'] })
  assert.ok(Array.isArray(capturedFilter?.$or))
  assert.equal(capturedUpdate?.$set?.status, 'queued')
  assert.equal(capturedUpdate?.$set?.attempCount, 0)
  assert.equal(capturedUpdate?.$set?.lockedBy, null)
  assert.deepEqual(capturedUpdate?.$unset, { lastError: 1 })
})

test('completion fails when the worker has lost its lease', async (context) => {
  context.mock.method(IngestionJobModel, 'updateOne', async () => ({ modifiedCount: 0 }))

  await assert.rejects(
    () => completeJob(new Types.ObjectId(), 'worker-1', new Types.ObjectId()),
    /lost lease/,
  )
})

test('enqueue refreshes GovSpending metadata on new and existing jobs', async (context) => {
  let operations: Array<{ updateOne: { update: Record<string, Record<string, unknown>> } }> = []
  context.mock.method(IngestionJobModel, 'bulkWrite', async (ops: typeof operations) => {
    operations = ops
    return { upsertedCount: 1 }
  })
  const metadata = {
    title: 'Project',
    departmentName: 'Dept',
    departmentSubName: null,
    projectStatus: null,
    sourceProjectId: null,
    contractStatus: null,
    contractStatusCode: null,
    fiscalYear: 2568,
    announceDate: null,
    budgetBaht: 100,
    midPriceBaht: 90,
    awardedPriceBaht: 80,
  }

  await enqueueDiscoveredProjects(new Types.ObjectId(), [
    { externalId: '68069160377', title: 'Project', fiscalYear: 2568, metadata },
  ])

  const update = operations[0]?.updateOne.update
  assert.deepEqual(update?.$set, { sourceMetadata: metadata })
  assert.equal(update?.$setOnInsert?.status, 'queued')
})
