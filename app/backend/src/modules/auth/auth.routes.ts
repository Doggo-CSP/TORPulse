import { Router } from 'express'
import type passport from 'passport'

import type { ApiAuthConfig } from './auth.config.js'

declare module 'express-session' {
  interface SessionData {
    returnTo?: string
  }
}

const DEFAULT_RETURN_TO = '/homepage'

// A page on this site to return to after login, e.g. "/tor/abc?x=1". Anything that could
// leave the site ("//evil.com", "https://...", "/\evil.com") or carries control characters
// is rejected, so the redirect cannot be used as an open redirect.
export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 512) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  if (/[\u0000-\u001f\u007f]/.test(value)) return null
  return value
}

export const createAuthRouter = (
  authPassport: passport.Authenticator,
  config: ApiAuthConfig,
): Router => {
  const router = Router()

  router.get(
    '/google',
    (req, _res, next) => {
      const returnTo = safeReturnTo(req.query.returnTo)
      if (returnTo) req.session.returnTo = returnTo
      else delete req.session.returnTo
      next()
    },
    authPassport.authenticate('google', { scope: ['profile', 'email'] }),
  )

  router.get('/google/callback', (req, res, next) => {
    // Read before login: passport starts a fresh session on login, which drops returnTo
    const returnTo = safeReturnTo(req.session?.returnTo) ?? DEFAULT_RETURN_TO
    authPassport.authenticate('google', (authError: unknown, user: Express.User | false) => {
      if (authError) {
        next(authError)
        return
      }
      if (!user) {
        res.redirect(`${config.frontendUrl}/auth?error=google`)
        return
      }
      req.logIn(user, (loginError) => {
        if (loginError) {
          next(loginError)
          return
        }
        res.redirect(`${config.frontendUrl}${returnTo}`)
      })
    })(req, res, next)
  })

  router.get('/me', (req, res) => {
    if (!req.user) {
      res.status(401).json({ user: null })
      return
    }

    res.json({
      user: {
        id: req.user._id.toString(),
        name: req.user.name,
        email: req.user.email,
        image: req.user.image,
        role: req.user.role ?? 'user',
        status: req.user.status ?? 'active',
      },
    })
  })

  router.post('/logout', (req, res, next) => {
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

        res.clearCookie('torpulse.sid', {
          httpOnly: true,
          sameSite: 'lax',
          secure: config.isProduction,
          path: '/',
        })
        res.sendStatus(204)
      })
    })
  })

  return router
}
