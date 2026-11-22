import type { CookieOptions, RequestHandler } from 'express'

import { securityEvent } from '../lib/logger.js'

declare module 'express-session' {
  interface SessionData {
    // First authenticated request of this login (ms since epoch)
    authAt?: number
    // Latest authenticated request (ms since epoch)
    lastSeenAt?: number
  }
}

interface SessionTimeoutOptions {
  // Log out after this long with no requests
  idleMs: number
  // Log out this long after login, however active the user is
  absoluteMs: number
  cookieName: string
  cookieOptions: CookieOptions
  now?: () => number
}

// Login timeout. Runs after passport.session(). When the session has been idle too long, or is
// older than the absolute limit, the server-side session is destroyed and the request carries on
// as a guest, so the route answers with its normal 401.
export const createSessionTimeout = ({
  idleMs,
  absoluteMs,
  cookieName,
  cookieOptions,
  now = Date.now,
}: SessionTimeoutOptions): RequestHandler => {
  return (req, res, next) => {
    if (!req.user || !req.session) {
      next()
      return
    }

    const current = now()
    const authAt = req.session.authAt ?? current
    const lastSeenAt = req.session.lastSeenAt ?? current

    if (current - lastSeenAt > idleMs || current - authAt > absoluteMs) {
      securityEvent(
        'session.expired',
        {
          requestId: req.requestId,
          userId: req.user._id.toString(),
          ip: req.ip,
          reason: current - lastSeenAt > idleMs ? 'idle' : 'absolute',
        },
        'info',
      )
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

    req.session.authAt = authAt
    req.session.lastSeenAt = current
    next()
  }
}
