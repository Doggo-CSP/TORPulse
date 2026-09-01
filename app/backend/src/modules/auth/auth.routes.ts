import { Router } from 'express'
import type passport from 'passport'

import type { ApiAuthConfig } from './auth.config.js'

export const createAuthRouter = (
  authPassport: passport.Authenticator,
  config: ApiAuthConfig,
): Router => {
  const router = Router()

  router.get('/google', authPassport.authenticate('google', { scope: ['profile', 'email'] }))

  router.get(
    '/google/callback',
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
