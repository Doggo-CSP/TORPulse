import { database } from '../../config/mongoose.js'
import { startNotificationWorker } from './notification.worker.js'

const shutdownController = new AbortController()

process.once('SIGINT', () => {
  console.log('SIGINT received')
  shutdownController.abort()
})

process.once('SIGTERM', () => {
  console.log('SIGTERM received')
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
  console.error('Notification worker failed:', error)
  process.exitCode = 1
})
