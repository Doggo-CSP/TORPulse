import cors from 'cors'
import express from 'express'
import session, { type Store } from 'express-session'
import MongoStore from 'connect-mongo'
import type passport from 'passport'

import { env } from '../../config/env.js'
import { errorHandler, notFoundHandler } from '../../middleware/error.middleware.js'
import type { ApiAuthConfig } from '../../modules/auth/auth.config.js'
import { createAuthRouter } from '../../modules/auth/auth.routes.js'
import { createPassport } from '../../modules/auth/passport.js'
import r from './r.route.js'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

interface CreateApiAppOptions {
  sessionStore?: Store
  authPassport?: passport.Authenticator
}

export const createApiApp = (authConfig: ApiAuthConfig, options: CreateApiAppOptions = {}) => {
  const app = express()
  const authPassport = options.authPassport ?? createPassport(authConfig)
  const frontendOrigin = new URL(authConfig.frontendUrl).origin
  const sessionStore =
    options.sessionStore ??
    MongoStore.create({
      mongoUrl: env.MONGODB_URI,
      dbName: env.MONGODB_DATABASE,
      collectionName: 'sessions',
      ttl: SESSION_TTL_MS / 1000,
    })

  app.disable('x-powered-by')

  if (authConfig.isProduction) {
    app.set('trust proxy', 1)
  }

  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        callback(null, !requestOrigin || requestOrigin === frontendOrigin)
      },
      credentials: true,
    }),
  )
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(
    session({
      name: 'torpulse.sid',
      secret: authConfig.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: authConfig.isProduction,
        maxAge: SESSION_TTL_MS,
      },
    }),
  )
  app.use(authPassport.initialize())
  app.use(authPassport.session())

  app.get('/', (_req, res) => {
    res.json({ service: 'torpulse-api' })
  })
  app.use('/auth', createAuthRouter(authPassport, authConfig))
  app.use('/api/v1', r)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
