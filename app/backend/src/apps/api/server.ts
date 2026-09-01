import { createApiApp } from './app.js'
import { env } from '../../config/env.js'
import { database } from '../../config/mongoose.js'
import { getApiAuthConfig } from '../../modules/auth/auth.config.js'

const startServer = async (): Promise<void> => {
  await database.connect()
  const app = createApiApp(getApiAuthConfig())

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`App started at http://localhost:${env.PORT}`)
  })

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`${signal} received`)

    server.close(async (error) => {
      if (error) {
        console.error('HTTP server shutdown failed:', error)
        process.exit(1)
      }

      try {
        await database.disconnect()
        process.exit(0)
      } catch (disconnectError) {
        console.error('MongoDB shutdown failed:', disconnectError)

        process.exit(1)
      }
    })
  }

  process.on('SIGINT', () => {
    void shutdown('SIGINT')
  })

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
  })
}

startServer().catch((error: unknown) => {
  console.error('Application startup failed:', error)
  process.exit(1)
})
