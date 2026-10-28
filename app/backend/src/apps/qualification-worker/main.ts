import { database } from '../../config/mongoose.js'
import { startQualificationWorker } from './qualification.worker.js'

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
    await startQualificationWorker(shutdownController.signal)
  } finally {
    await database.disconnect()
  }
}

main().catch((error: unknown) => {
  console.error('Qualification worker failed:', error)
  process.exitCode = 1
})
