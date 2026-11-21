import cors from 'cors'
import express from 'express'
import session, { type Store } from 'express-session'
import MongoStore from 'connect-mongo'
import type passport from 'passport'

import { env } from '../../config/env.js'
import { errorHandler, notFoundHandler } from '../../middleware/error.middleware.js'
import { createApiLimiter, createLoginLimiter } from '../../middleware/rate-limit.middleware.js'
import { createSessionTimeout } from '../../middleware/session-timeout.middleware.js'
import {
  DEFAULT_SESSION_ABSOLUTE_TIMEOUT_MS,
  DEFAULT_SESSION_IDLE_TIMEOUT_MS,
  type ApiAuthConfig,
} from '../../modules/auth/auth.config.js'
import { createAuthRouter } from '../../modules/auth/auth.routes.js'
import { createPassport } from '../../modules/auth/passport.js'
import r from './r.route.js'

const SESSION_COOKIE = 'torpulse.sid'

interface RateLimitOverrides {
  windowMs?: number
  loginMax?: number
  apiMax?: number
}

interface CreateApiAppOptions {
  sessionStore?: Store
  authPassport?: passport.Authenticator
  // Tests pass tiny limits; the API otherwise reads them from env
  rateLimit?: RateLimitOverrides
}

export const createApiApp = (authConfig: ApiAuthConfig, options: CreateApiAppOptions = {}) => {
  const app = express()
  const authPassport = options.authPassport ?? createPassport(authConfig)
  const frontendOrigin = new URL(authConfig.frontendUrl).origin
  const idleMs = authConfig.sessionIdleTimeoutMs ?? DEFAULT_SESSION_IDLE_TIMEOUT_MS
  const absoluteMs = authConfig.sessionAbsoluteTimeoutMs ?? DEFAULT_SESSION_ABSOLUTE_TIMEOUT_MS
  const rateLimitWindowMs = options.rateLimit?.windowMs ?? env.RATE_LIMIT_WINDOW_MS
  const sessionStore =
    options.sessionStore ??
    MongoStore.create({
      mongoUrl: env.MONGODB_URI,
      dbName: env.MONGODB_DATABASE,
      collectionName: 'sessions',
      // Fallback expiry. A session with a cookie expiry uses that instead (the idle timeout).
      ttl: absoluteMs / 1000,
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
  app.use(express.json({ limit: '8mb' }))
  app.use(express.urlencoded({ extended: true, limit: '8mb' }))
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: authConfig.isProduction,
    path: '/',
  }
  app.use(
    session({
      name: SESSION_COOKIE,
      secret: authConfig.sessionSecret,
      resave: false,
      saveUninitialized: false,
      // Every response pushes the cookie expiry forward, so the cookie (and the stored session)
      // expires after idleMs without requests
      rolling: true,
      store: sessionStore,
      cookie: { ...cookieOptions, maxAge: idleMs },
    }),
  )
  app.use(authPassport.initialize())
  app.use(authPassport.session())
  app.use(createSessionTimeout({ idleMs, absoluteMs, cookieName: SESSION_COOKIE, cookieOptions }))

  const loginLimiter = createLoginLimiter({
    windowMs: rateLimitWindowMs,
    max: options.rateLimit?.loginMax ?? env.RATE_LIMIT_LOGIN_MAX,
    frontendUrl: authConfig.frontendUrl,
  })
  const apiLimiter = createApiLimiter({
    windowMs: rateLimitWindowMs,
    max: options.rateLimit?.apiMax ?? env.RATE_LIMIT_API_MAX,
  })

  app.get('/', (_req, res) => {
    res.json({ service: 'torpulse-api' })
  })
  app.use('/auth', createAuthRouter(authPassport, authConfig, { loginLimiter }))
  app.use('/api/v1', apiLimiter, r)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
