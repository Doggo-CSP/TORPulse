import { Types } from 'mongoose'

import { database } from '../config/mongoose.js'
import { IngestionJobModel } from '../modules/ingestion/ingestion-job.model.js'

const TEST_DATA_SOURCE_ID = new Types.ObjectId('000000000000000000000001')
const TEST_PROJECT_ID = '67119538991'
const TEST_SOURCE_VERSION = 'queue-upsert-test-v1'

const testJobFilter = {
  dataSourceId: TEST_DATA_SOURCE_ID,
  externalId: TEST_PROJECT_ID,
  sourceVersion: TEST_SOURCE_VERSION,
}

async function upsertTestJob() {
  return IngestionJobModel.findOneAndUpdate(
    testJobFilter,
    {
      $setOnInsert: {
        sourceAdapter: 'central_egp',
        status: 'queued',
        currentStage: 'queued',
        attempCount: 0,
        nextRetryAt: new Date(),
        lockedBy: null,
        lockedUntil: null,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).exec()
}

async function main(): Promise<void> {
  await database.connect()

  try {
    // Make sure the unique queue index exists before testing idempotency.
    await IngestionJobModel.init()

    const firstUpsert = await upsertTestJob()
    const secondUpsert = await upsertTestJob()

    if (!firstUpsert || !secondUpsert) {
      throw new Error('Queue upsert did not return an ingestion job')
    }

    const matchingJobCount = await IngestionJobModel.countDocuments(testJobFilter)

    if (firstUpsert.id !== secondUpsert.id) {
      throw new Error('Repeated upserts returned different queue jobs')
    }

    if (matchingJobCount !== 1) {
      throw new Error(`Expected exactly one queue job, found ${matchingJobCount}`)
    }

    console.log('Queue upsert test passed')
    console.log({
      jobId: firstUpsert.id,
      externalId: firstUpsert.externalId,
      status: firstUpsert.status,
      matchingJobCount,
    })
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Queue upsert test failed:', error)
  process.exitCode = 1
})
