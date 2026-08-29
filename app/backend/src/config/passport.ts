import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'

import { env } from './env.js'
import User, { type IUser } from '../models/User.js'

declare global {
  namespace Express {
    interface User extends IUser {}
  }
}

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    (_accessToken, _refreshToken, profile, done) => {
      void (async () => {
        try {
          let user = await User.findOne({ googleId: profile.id })

          if (!user) {
            user = await User.create({
              googleId: profile.id,
              name: profile.displayName,
              email: profile.emails?.[0]?.value ?? '',
              image: profile.photos?.[0]?.value ?? '',
            })
          }

          done(null, user)
        } catch (error) {
          done(error as Error)
        }
      })()
    },
  ),
)

passport.serializeUser((user, done) => {
  done(null, user._id.toString())
})

passport.deserializeUser((id: string, done) => {
  void (async () => {
    try {
      const user = await User.findById(id)
      done(null, user)
    } catch (error) {
      done(error as Error)
    }
  })()
})

export default passport
