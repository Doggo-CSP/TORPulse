import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import type { Types } from 'mongoose'

import type { ApiAuthConfig } from './auth.config.js'
import { User, type UserDocument } from './user.model.js'

declare global {
  namespace Express {
    interface User {
      _id: Types.ObjectId
      googleId: string
      name: string
      email: string
      image: string | null
    }
  }
}

export const createPassport = (config: ApiAuthConfig): passport.Authenticator => {
  const authPassport = new passport.Passport()

  authPassport.use(
    new GoogleStrategy(
      {
        clientID: config.googleClientId,
        clientSecret: config.googleClientSecret,
        callbackURL: config.googleCallbackUrl,
      },
      (_accessToken, _refreshToken, profile, done) => {
        void (async () => {
          try {
            const email = profile.emails?.[0]?.value?.trim().toLowerCase()

            if (!email) {
              done(new Error('Google account did not provide an email address'))
              return
            }

            const user = await User.findOneAndUpdate(
              { googleId: profile.id },
              {
                $set: {
                  name: profile.displayName || email,
                  email,
                  image: profile.photos?.[0]?.value ?? null,
                },
                $setOnInsert: { googleId: profile.id },
              },
              { upsert: true, returnDocument: 'after', runValidators: true },
            )

            done(null, user)
          } catch (error) {
            done(error as Error)
          }
        })()
      },
    ),
  )

  authPassport.serializeUser((user, done) => {
    done(null, user._id.toString())
  })

  authPassport.deserializeUser((id: string, done) => {
    void User.findById(id)
      .then((user: UserDocument | null) => done(null, user ?? false))
      .catch((error: unknown) => done(error as Error))
  })

  return authPassport
}
