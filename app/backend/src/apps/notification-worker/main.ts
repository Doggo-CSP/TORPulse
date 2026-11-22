import { database } from '../../config/mongoose.js'
import { startNotificationWorker } from './notification.worker.js'
import { log } from '../../lib/logger.js'
import { installProcessErrorHandlers } from '../../middleware/error.middleware.js'

installProcessErrorHandlers('notification-worker')

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
    await startNotificationWorker(shutdownController.signal)
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  log.error('Notification worker failed:', error)
  process.exitCode = 1
})
