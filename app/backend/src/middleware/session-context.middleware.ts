import type { CookieOptions, Request, RequestHandler } from 'express'

import { securityEvent } from '../lib/logger.js'
import { userAgentHash } from '../modules/auth/mfa.js'

declare module 'express-session' {
  interface SessionData {
    // Browser/OS family the session was created with (ASVS V8.2.4)
    uaHash?: string
    // When the user last proved their identity to Google again (ASVS V7.5.1)
    reauthAt?: number
  }
}

declare global {
  namespace Express {
    interface Request {
      // Google sign-in done, emailed code not entered yet
      mfaPending?: boolean
    }
  }
}

interface SessionGateOptions {
  cookieName: string
  cookieOptions: CookieOptions
}

// Runs after passport.session() and the session timeout. Two context checks:
//
// 1. MFA gate (ASVS V6.3.3): a session that passed Google sign-in but not the emailed code is
//    treated as logged out everywhere. Only /auth/mfa/* and /auth/me look at `mfaPending`.
// 2. Device binding (ASVS V8.2.4, adaptive control): a session is tied to the browser/OS family
//    it was created on. A request from a different family with the same cookie means the
//    cookie was copied to another device, so the session is destroyed.
export const createSessionGate = ({
  cookieName,
  cookieOptions,
}: SessionGateOptions): RequestHandler => {
  return (req, res, next) => {
    if (!req.user || !req.session) {
      next()
      return
    }

    const currentUa = userAgentHash(req.get('user-agent') ?? '')
    if (req.session.uaHash && req.session.uaHash !== currentUa) {
      securityEvent('session.context_changed', {
        requestId: req.requestId,
        userId: req.user._id.toString(),
        ip: req.ip,
        userAgent: req.get('user-agent'),
      })
      req.session.destroy((error) => {
        if (error) {
          next(error)
          return
        }
        req.user = undefined
        res.clearCookie(cookieName, cookieOptions)
        next()
      })
      return
    }
    req.session.uaHash = currentUa

    if (!req.session.mfaVerifiedAt) {
      req.mfaPending = true
      req.user = undefined
    }

    next()
  }
}

export const RECENT_AUTH_MS = 5 * 60 * 1000

export const hasRecentAuth = (req: Request, now = Date.now()): boolean =>
  typeof req.session?.reauthAt === 'number' && now - req.session.reauthAt <= RECENT_AUTH_MS

// Sensitive actions need a Google re-authentication in the last 5 minutes. The frontend sends
// the user to `reauthUrl` (Google with prompt=login) and back, then repeats the action.
export const reauthRequiredBody = (req: Request) => ({
  success: false,
  code: 'REAUTH_REQUIRED',
  message: 'กรุณายืนยันตัวตนกับ Google อีกครั้งก่อนดำเนินการนี้',
  reauthUrl: '/auth/google/reauth',
  requestId: req.requestId,
})

export const requireRecentAuth: RequestHandler = (req, res, next) => {
  if (hasRecentAuth(req)) {
    next()
    return
  }
  securityEvent(
    'auth.reauth.required',
    {
      requestId: req.requestId,
      userId: req.user?._id.toString(),
      method: req.method,
      path: req.path,
    },
    'info',
  )
  res.status(403).json(reauthRequiredBody(req))
}
