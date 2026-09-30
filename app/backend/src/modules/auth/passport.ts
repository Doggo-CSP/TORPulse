import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import type { Types } from 'mongoose'

import { createAuditLog } from '../admin/audit-log.repository.js'
import { getSettings } from '../admin/settings.repository.js'
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
      role?: 'admin' | 'editor' | 'user'
      status?: 'active' | 'pending' | 'suspended'
    }
  }
}

// New accounts start as pending. When auto-approval is on, a verified .go.th address is
// approved at once and marked as a government agency account. Only used with $setOnInsert,
// so existing accounts (including people already waiting) are never changed here.
export const newUserDefaults = (
  email: string,
  emailVerified: boolean,
  autoApproveGovEmails: boolean,
): { status: 'active' | 'pending'; accountType?: 'agency'; autoApproved: boolean } => {
  const autoApproved =
    autoApproveGovEmails && emailVerified && email.trim().toLowerCase().endsWith('.go.th')

  return autoApproved
    ? { status: 'active', accountType: 'agency', autoApproved }
    : { status: 'pending', autoApproved }
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

            const { autoApproveGovEmails } = await getSettings()
            const defaults = newUserDefaults(
              email,
              profile.emails?.[0]?.verified === true,
              autoApproveGovEmails,
            )

            const result = await User.findOneAndUpdate(
              { googleId: profile.id },
              {
                $set: {
                  name: profile.displayName || email,
                  email,
                  image: profile.photos?.[0]?.value ?? null,
                },
                $setOnInsert: {
                  googleId: profile.id,
                  role: 'user',
                  status: defaults.status,
                  ...(defaults.accountType ? { accountType: defaults.accountType } : {}),
                },
              },
              {
                upsert: true,
                returnDocument: 'after',
                runValidators: true,
                includeResultMetadata: true,
              },
            )
            const user = result.value

            if (
              user &&
              defaults.autoApproved &&
              result.lastErrorObject?.updatedExisting === false
            ) {
              await createAuditLog({
                actorType: 'system',
                action: 'user.approved',
                targetType: 'user',
                targetId: user._id,
                targetLabel: user.name,
                after: { status: 'active' },
                metadata: { reason: 'auto_approve_gov_email' },
              })
            }

            // TODO(QUESTION-8): pending users are not restricted outside /admin yet; see QUESTIONS.md
            if (!user || user.status === 'suspended') {
              done(null, false)
              return
            }

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
      .then((user: UserDocument | null) =>
        done(null, user && user.status !== 'suspended' ? user : false),
      )
      .catch((error: unknown) => done(error as Error))
  })

  return authPassport
}
