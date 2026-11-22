import { Router, type Request, type RequestHandler, type Response } from 'express'
import type passport from 'passport'

import { securityEvent } from '../../lib/logger.js'
import { RECENT_AUTH_MS } from '../../middleware/session-context.middleware.js'
import { sessionCookieName, type ApiAuthConfig } from './auth.config.js'
import {
  alertMfaLockout,
  MFA_MAX_ATTEMPTS,
  recordDeviceAndAlert,
  startMfaChallenge,
  userAgentHash,
  verifyMfaCode,
  type MfaDependencies,
} from './mfa.js'
import { generateNonce } from './oidc.js'
import type { GoogleAuthInfo } from './passport.js'
import { scopesFor } from './scopes.js'
import { revokeUserSessions } from './session-revocation.js'
import { User } from './user.model.js'

interface AuthRouterOptions {
  // Limits login attempts; the Google sign-in routes and the MFA routes use it
  loginLimiter?: RequestHandler
  // Missing in tests that only exercise /me and /logout
  mfa?: MfaDependencies
}

const passThrough: RequestHandler = (_req, _res, next) => next()

const OIDC_SCOPES = ['openid', 'email', 'profile']

// Only same-site relative paths are accepted as a place to return to after re-authentication
// (prevents an open redirect through returnTo).
export const safeReturnTo = (value: unknown): string => {
  if (typeof value !== 'string' || value.length > 200) return '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/'
  return /^[\w\-/.?=&%]*$/.test(value) ? value : '/'
}

const appendQuery = (path: string, key: string, value: string) =>
  `${path}${path.includes('?') ? '&' : '?'}${key}=${value}`

export const createAuthRouter = (
  authPassport: passport.Authenticator,
  config: ApiAuthConfig,
  { loginLimiter = passThrough, mfa }: AuthRouterOptions = {},
): Router => {
  const router = Router()
  const cookieName = sessionCookieName(config.isProduction)
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.isProduction,
    path: '/',
  }
  const mfaDeps: MfaDependencies = mfa ?? {
    secret: config.sessionSecret,
    isProduction: config.isProduction,
  }

  const context = (req: Request) => ({
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  })

  const endSession = (req: Request, res: Response, after: () => void) => {
    req.session.destroy(() => {
      res.clearCookie(cookieName, cookieOptions)
      after()
    })
  }

  // ---- Sign in (ASVS V7.6.2: always an explicit Google account choice, never silent) ----
  router.get('/google', loginLimiter, (req, res, next) => {
    req.session.oauthMode = 'login'
    req.session.oidcNonce = generateNonce()
    authPassport.authenticate('google', {
      scope: OIDC_SCOPES,
      prompt: 'select_account',
      nonce: req.session.oidcNonce,
    } as passport.AuthenticateOptions)(req, res, next)
  })

  // ---- "Confirm it's you" before a sensitive change (ASVS V7.5.1, V6.8.4) ----
  // Google is asked to make the user sign in again (prompt=login, max_age=0); the callback only
  // accepts an ID token whose auth_time is after this request.
  router.get('/google/reauth', loginLimiter, (req, res, next) => {
    const returnTo = safeReturnTo(req.query.returnTo)
    if (!req.user) {
      res.redirect(`${config.frontendUrl}/auth`)
      return
    }
    req.session.oauthMode = 'reauth'
    req.session.reauth = { startedAt: Date.now(), returnTo }
    req.session.oidcNonce = generateNonce()
    authPassport.authenticate('google', {
      scope: OIDC_SCOPES,
      prompt: 'login',
      maxAge: 0,
      loginHint: req.user.email,
      nonce: req.session.oidcNonce,
    } as passport.AuthenticateOptions)(req, res, next)
  })

  router.get('/google/callback', loginLimiter, (req, res, next) => {
    authPassport.authenticate(
      'google',
      (
        error: unknown,
        user: Express.User | false,
        info?: GoogleAuthInfo | { message?: string },
      ) => {
        const mode = (info as GoogleAuthInfo | undefined)?.mode ?? req.session.oauthMode ?? 'login'
        const reason =
          (info as GoogleAuthInfo | undefined)?.reason ??
          (info as { message?: string } | undefined)?.message ??
          (error instanceof Error ? error.message : undefined)

        if (mode === 'reauth') {
          const returnTo = req.session.reauth?.returnTo ?? '/'
          delete req.session.oauthMode
          delete req.session.reauth
          if (error || !user) {
            securityEvent('auth.reauth.failure', {
              ...context(req),
              userId: req.user?._id.toString(),
              reason,
            })
            res.redirect(`${config.frontendUrl}${appendQuery(returnTo, 'reauth', 'failed')}`)
            return
          }
          req.session.reauthAt = Date.now()
          securityEvent(
            'auth.reauth.success',
            { ...context(req), userId: user._id.toString() },
            'info',
          )
          res.redirect(`${config.frontendUrl}${appendQuery(returnTo, 'reauth', 'ok')}`)
          return
        }

        if (error || !user) {
          securityEvent('auth.login.failure', { ...context(req), reason })
          res.redirect(`${config.frontendUrl}/auth?error=google`)
          return
        }

        // req.logIn regenerates the session id (no fixation); the new session starts MFA-pending
        req.logIn(user, (loginError) => {
          if (loginError) {
            next(loginError)
            return
          }
          req.session.uaHash = userAgentHash(req.get('user-agent') ?? '')
          securityEvent(
            'auth.login.success',
            {
              ...context(req),
              userId: user._id.toString(),
              stage: 'google',
              factor: 'google-oidc',
            },
            'info',
          )
          startMfaChallenge(req, user, mfaDeps)
            .then(() => res.redirect(`${config.frontendUrl}/auth/verify`))
            .catch(next)
        })
      },
    )(req, res, next)
  })

  // ---- Second factor: emailed one-time code (ASVS V6.3.3) ----
  router.post('/mfa/verify', loginLimiter, (req, res, next) => {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
    const challenge = req.session.mfa
    if (!req.mfaPending || !challenge) {
      res
        .status(400)
        .json({ success: false, code: 'MFA_NO_CHALLENGE', message: 'กรุณาเข้าสู่ระบบใหม่' })
      return
    }

    const result = verifyMfaCode(req, code, mfaDeps)
    const userId = challenge.userId

    if (result === 'locked') {
      void alertMfaLockout(req, userId, mfaDeps)
      endSession(req, res, () => {
        res.status(429).json({
          success: false,
          code: 'MFA_LOCKED',
          message: `ใส่รหัสผิดเกิน ${MFA_MAX_ATTEMPTS} ครั้ง กรุณาเข้าสู่ระบบใหม่`,
        })
      })
      return
    }

    if (result !== 'ok') {
      securityEvent('auth.mfa.failure', { ...context(req), userId, result })
      res.status(400).json({
        success: false,
        code: result === 'expired' ? 'MFA_EXPIRED' : 'MFA_INVALID',
        message: result === 'expired' ? 'รหัสหมดอายุ กรุณาขอรหัสใหม่' : 'รหัสไม่ถูกต้อง',
        attemptsLeft: Math.max(0, MFA_MAX_ATTEMPTS - (req.session.mfa?.attempts ?? 0)),
      })
      return
    }

    void (async () => {
      const user = await User.findById(userId)
      if (!user || user.status === 'suspended') {
        endSession(req, res, () =>
          res.status(401).json({ success: false, code: 'MFA_NO_CHALLENGE' }),
        )
        return
      }
      // A fresh session id once the user is fully authenticated
      req.logIn(user, (loginError) => {
        if (loginError) {
          next(loginError)
          return
        }
        const now = Date.now()
        req.session.mfaVerifiedAt = now
        req.session.authAt = now
        req.session.lastSeenAt = now
        req.session.uaHash = userAgentHash(req.get('user-agent') ?? '')
        delete req.session.mfa
        securityEvent('auth.mfa.success', { ...context(req), userId, factor: 'email-otp' }, 'info')
        recordDeviceAndAlert(req, userId, mfaDeps)
          .catch(() => false)
          .then(() => res.json({ success: true }))
      })
    })().catch(next)
  })

  router.post('/mfa/resend', loginLimiter, (req, res, next) => {
    const challenge = req.session.mfa
    if (!req.mfaPending || !challenge) {
      res.status(400).json({ success: false, code: 'MFA_NO_CHALLENGE' })
      return
    }
    void (async () => {
      const user = await User.findById(challenge.userId)
      if (!user) {
        res.status(400).json({ success: false, code: 'MFA_NO_CHALLENGE' })
        return
      }
      const outcome = await startMfaChallenge(req, user, mfaDeps)
      if (outcome !== 'sent') {
        res
          .status(429)
          .json({ success: false, code: outcome === 'too_soon' ? 'MFA_TOO_SOON' : 'MFA_TOO_MANY' })
        return
      }
      res.json({ success: true })
    })().catch(next)
  })

  router.get('/me', (req, res) => {
    if (!req.user) {
      res.status(401).json(req.mfaPending ? { user: null, mfaRequired: true } : { user: null })
      return
    }

    const reauthAt = req.session?.reauthAt
    res.json({
      user: {
        id: req.user._id.toString(),
        name: req.user.name,
        email: req.user.email,
        image: req.user.image,
        role: req.user.role ?? 'user',
        status: req.user.status ?? 'active',
        scopes: scopesFor(req.user),
        ...(typeof reauthAt === 'number'
          ? { reauthValidUntil: new Date(reauthAt + RECENT_AUTH_MS).toISOString() }
          : {}),
        ...(req.user.sessionReview
          ? {
              sessionReview: {
                reason: req.user.sessionReview.reason,
                at: new Date(req.user.sessionReview.at).toISOString(),
              },
            }
          : {}),
      },
    })
  })

  // ---- Sign out other devices (ASVS V7.4.3) ----
  // Always available from the profile page, and offered after an authentication factor changes
  // (sessionReview above). Keeps the caller's own session. Either choice clears the offer.
  router.post('/sessions/revoke-others', (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ success: false, code: 'UNAUTHENTICATED' })
      return
    }
    const userId = req.user._id
    void (async () => {
      const revoked = await revokeUserSessions(userId, { exceptSessionId: req.sessionID })
      await User.updateOne({ _id: userId }, { $set: { sessionReview: null } })
      securityEvent(
        'session.revoked_others',
        { ...context(req), userId: userId.toString(), revoked },
        'info',
      )
      res.json({ success: true, revoked })
    })().catch(next)
  })

  router.post('/sessions/review/dismiss', (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ success: false, code: 'UNAUTHENTICATED' })
      return
    }
    const userId = req.user._id
    User.updateOne({ _id: userId }, { $set: { sessionReview: null } })
      .then(() => {
        securityEvent(
          'session.review_dismissed',
          { ...context(req), userId: userId.toString() },
          'info',
        )
        res.json({ success: true })
      })
      .catch(next)
  })

  router.post('/logout', (req, res, next) => {
    const userId = req.user?._id.toString()
    req.logout((logoutError) => {
      if (logoutError) {
        next(logoutError)
        return
      }

      req.session.destroy((sessionError) => {
        if (sessionError) {
          next(sessionError)
          return
        }

        securityEvent('auth.logout', { ...context(req), userId }, 'info')
        res.clearCookie(cookieName, cookieOptions)
        // Ask the browser to drop anything it cached or stored for the API origin (ASVS V14.3.1).
        // The frontend clears its own storage on sign-out as well.
        res.set('Clear-Site-Data', '"cache", "storage"')
        res.sendStatus(204)
      })
    })
  })

  return router
}
