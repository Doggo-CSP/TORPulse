import { Router, type RequestHandler } from 'express'
import type passport from 'passport'

import { sessionCookieName, type ApiAuthConfig } from './auth.config.js'
import { scopesFor } from './scopes.js'

interface AuthRouterOptions {
  // Limits login attempts; only the Google sign-in routes use it
  loginLimiter?: RequestHandler
}

const passThrough: RequestHandler = (_req, _res, next) => next()

export const createAuthRouter = (
  authPassport: passport.Authenticator,
  config: ApiAuthConfig,
  { loginLimiter = passThrough }: AuthRouterOptions = {},
): Router => {
  const router = Router()

  router.get(
    '/google',
    loginLimiter,
    authPassport.authenticate('google', { scope: ['profile', 'email'] }),
  )

  router.get(
    '/google/callback',
    loginLimiter,
    authPassport.authenticate('google', {
      failureRedirect: `${config.frontendUrl}/auth?error=google`,
      successRedirect: `${config.frontendUrl}/homepage`,
    }),
  )

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
        scopes: scopesFor(req.user),
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

        res.clearCookie(sessionCookieName(config.isProduction), {
          httpOnly: true,
          sameSite: 'lax',
          secure: config.isProduction,
          path: '/',
        })
        // Ask the browser to drop anything it cached or stored for the API origin (ASVS V14.3.1).
        // The frontend clears its own storage on sign-out as well.
        res.set('Clear-Site-Data', '"cache", "storage"')
        res.sendStatus(204)
      })
    })
  })

  return router
}
