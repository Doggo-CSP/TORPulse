import cors from 'cors'
import express from 'express'
import session, { type Store } from 'express-session'
import MongoStore from 'connect-mongo'
import type passport from 'passport'

import { env } from '../../config/env.js'
import { errorHandler, notFoundHandler } from '../../middleware/error.middleware.js'
import { requestLogger } from '../../middleware/request-log.middleware.js'
import {
  blockTrace,
  createOriginCheck,
  createSecurityHeaders,
  noStore,
} from '../../middleware/security.middleware.js'
import { createApiLimiter, createLoginLimiter } from '../../middleware/rate-limit.middleware.js'
import { createSessionTimeout } from '../../middleware/session-timeout.middleware.js'
import { createSessionGate } from '../../middleware/session-context.middleware.js'
import type { IdTokenVerifier } from '../../modules/auth/oidc.js'
import { createSmtpMailer, type Mailer } from '../../modules/notification/mailer.js'
import {
  DEFAULT_SESSION_ABSOLUTE_TIMEOUT_MS,
  DEFAULT_SESSION_IDLE_TIMEOUT_MS,
  sessionCookieName,
  type ApiAuthConfig,
} from '../../modules/auth/auth.config.js'
import { createAuthRouter } from '../../modules/auth/auth.routes.js'
import { createPassport } from '../../modules/auth/passport.js'
import r from './r.route.js'

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
  // Tests pass a fake mailer (MFA codes) and ID-token verifier
  mailer?: Mailer
  verifyIdToken?: IdTokenVerifier
}

export const createApiApp = (authConfig: ApiAuthConfig, options: CreateApiAppOptions = {}) => {
  const app = express()
  const authPassport =
    options.authPassport ?? createPassport(authConfig, { verifyIdToken: options.verifyIdToken })
  const mailer = options.mailer ?? (env.SMTP_HOST ? createSmtpMailer() : undefined)
  if (authConfig.isProduction && !mailer) {
    // Sign-in codes (MFA) and new-device alerts are emailed; production cannot run without SMTP
    throw new Error('SMTP_HOST is required in production: MFA codes are sent by email')
  }
  const frontendOrigin = new URL(authConfig.frontendUrl).origin
  const cookieName = sessionCookieName(authConfig.isProduction)
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
  app.use(requestLogger)
  app.use(blockTrace)

  if (authConfig.isProduction) {
    app.set('trust proxy', 1)
  }

  app.use(createSecurityHeaders({ isProduction: authConfig.isProduction }))
  app.use(noStore)
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        callback(null, !requestOrigin || requestOrigin === frontendOrigin)
      },
      credentials: true,
    }),
  )
  app.use(createOriginCheck(frontendOrigin))
  // The largest real payload (a bidder profile) is a few KB; a small limit blunts body-size DoS
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: authConfig.isProduction,
    path: '/',
  }
  app.use(
    session({
      name: cookieName,
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
  app.use(createSessionTimeout({ idleMs, absoluteMs, cookieName, cookieOptions }))
  app.use(createSessionGate({ cookieName, cookieOptions }))

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
  app.use(
    '/auth',
    createAuthRouter(authPassport, authConfig, {
      loginLimiter,
      mfa: {
        mailer,
        secret: authConfig.sessionSecret,
        isProduction: authConfig.isProduction,
      },
    }),
  )
  app.use('/api/v1', apiLimiter, r)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
