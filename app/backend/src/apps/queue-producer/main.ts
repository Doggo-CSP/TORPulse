import { database } from '../../config/mongoose.js'
import { startQueueProducer } from './queue-producer.js'
import { log } from '../../lib/logger.js'
import { installProcessErrorHandlers } from '../../middleware/error.middleware.js'

installProcessErrorHandlers('queue-producer')

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
    await startQueueProducer(shutdownController.signal)
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  log.error('Queue producer failed:', error)
  process.exitCode = 1
})
