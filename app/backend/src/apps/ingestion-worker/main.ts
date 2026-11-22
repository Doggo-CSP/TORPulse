import { database } from '../../config/mongoose.js'
import { startIngestionWorker } from './ingestion.worker.js'
import { log } from '../../lib/logger.js'
import { installProcessErrorHandlers } from '../../middleware/error.middleware.js'

installProcessErrorHandlers('ingestion-worker')

const shutdownController = new AbortController()

process.once('SIGINT', () => {
  log.info(`SIGINT received`)
  shutdownController.abort()
})

process.once('SIGTERM', () => {
  log.info('SIGTERM received')
  shutdownController.abort()
})

async function main(): Promise<void> {
  await database.connect()

  try {
    await startIngestionWorker(shutdownController.signal)
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  log.error('Ingestion worker failed:', error)
  process.exitCode = 1
})
