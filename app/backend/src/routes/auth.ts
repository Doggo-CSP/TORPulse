import { Router, type Request, type Response, type NextFunction } from 'express'

import passport from '../config/passport.js'

export const ensureAuthenticated = (req: Request, res: Response, next: NextFunction): void => {
  if (req.isAuthenticated()) {
    next()
    return
  }

  res.redirect('/auth/failure')
}

const router = Router()

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/failure',
    successRedirect: 'http://localhost:3000/homepage',
  }),
)

router.get('/failure', (_req, res) => {
  res.send('Authentication failed')
})

router.get('/profile', ensureAuthenticated, (req, res) => {
  const user = req.user

  res.send(`
    <h1>Profile</h1>
    <p>Name: ${user?.name ?? ''}</p>
    <p>Email: ${user?.email ?? ''}</p>
    <img src="${user?.image ?? ''}" alt="profile image" width="100" />
    <p><a href="/auth/logout">Logout</a></p>
  `)
})

router.get('/logout', (req, res, next) => {
  req.logout((error) => {
    if (error) {
      next(error)
      return
    }

    req.session.destroy(() => {
      res.redirect('/')
    })
  })
})

export default router
