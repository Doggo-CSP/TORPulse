import { readFileSync } from 'node:fs'
import https from 'node:https'

import { createApiApp } from './app.js'
import { env } from '../../config/env.js'
import { database } from '../../config/mongoose.js'
import { getApiAuthConfig } from '../../modules/auth/auth.config.js'
import { seedCategoriesIfEmpty } from '../../scripts/seed-categories.js'
import { log } from '../../lib/logger.js'
import { installProcessErrorHandlers } from '../../middleware/error.middleware.js'

installProcessErrorHandlers('torpulse-api')

const startServer = async (): Promise<void> => {
  await database.connect()
  await seedCategoriesIfEmpty()
  const app = createApiApp(getApiAuthConfig())

  // Inside the production network the API also speaks TLS, so the Caddy -> API hop is
  // encrypted too (ASVS V12.3.1). The certificate comes from the internal CA
  // (deploy/init-secrets.sh); local development without these settings stays on plain HTTP.
  const certFile = process.env.TLS_CERT_FILE?.trim()
  const keyFile = process.env.TLS_KEY_FILE?.trim()
  const server =
    certFile && keyFile
      ? https
          .createServer(
            { cert: readFileSync(certFile), key: readFileSync(keyFile), minVersion: 'TLSv1.2' },
            app,
          )
          .listen(env.PORT, '0.0.0.0', () => {
            log.info(`App started at https://0.0.0.0:${env.PORT} (internal TLS)`)
          })
      : app.listen(env.PORT, '0.0.0.0', () => {
          log.info(`App started at http://localhost:${env.PORT}`)
        })

  const shutdown = async (signal: string): Promise<void> => {
    log.info(`${signal} received`)

    server.close(async (error) => {
      if (error) {
        log.error('HTTP server shutdown failed:', error)
        process.exit(1)
      }

      try {
        await database.disconnect()
        process.exit(0)
      } catch (disconnectError) {
        log.error('MongoDB shutdown failed:', disconnectError)

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
  log.error('Application startup failed:', error)
  process.exit(1)
})
