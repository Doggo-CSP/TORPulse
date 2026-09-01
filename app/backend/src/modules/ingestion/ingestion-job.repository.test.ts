import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import { IngestionJobModel } from './ingestion-job.model.js'
import { completeJob, updateJobStage } from './ingestion-job.repository.js'

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

test('completion fails when the worker has lost its lease', async (context) => {
  context.mock.method(IngestionJobModel, 'updateOne', async () => ({ modifiedCount: 0 }))

  await assert.rejects(
    () => completeJob(new Types.ObjectId(), 'worker-1', new Types.ObjectId()),
    /lost lease/,
  )
})
