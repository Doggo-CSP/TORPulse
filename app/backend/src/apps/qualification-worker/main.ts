import { database } from '../../config/mongoose.js'
import { startQualificationWorker } from './qualification.worker.js'
import { log } from '../../lib/logger.js'
import { installProcessErrorHandlers } from '../../middleware/error.middleware.js'

installProcessErrorHandlers('qualification-worker')

const shutdownController = new AbortController()

process.once('SIGINT', () => {
  log.info('SIGINT received')
  shutdownController.abort()
})

process.once('SIGTERM', () => {
  log.info('SIGTERM received')
  shutdownController.abort()
})

async function main(): Promise<void> {
  await database.connect()

  try {
    await startQualificationWorker(shutdownController.signal)
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  log.error('Qualification worker failed:', error)
  process.exitCode = 1
})
