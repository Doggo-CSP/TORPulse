import { database } from '../config/mongoose.js'
import { IngestionJobModel } from '../modules/ingestion/ingestion-job.model.js'
import { repairCompletedJobsWithMissingTors } from '../modules/ingestion/missing-tor-repair.js'
import { TorModel } from '../modules/tor/tor.model.js'

async function main(): Promise<void> {
  await database.connect()

  try {
    await Promise.all([IngestionJobModel.init(), TorModel.init()])
    const result = await repairCompletedJobsWithMissingTors()
    console.log('Missing-TOR repair completed', result)
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Missing-TOR repair failed:', error)
  process.exitCode = 1
})
