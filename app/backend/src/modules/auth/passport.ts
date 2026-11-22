import type { Request } from 'express'
import passport from 'passport'
import type { Profile, VerifyCallback } from 'passport-google-oauth20'
import type { Types } from 'mongoose'

import { securityEvent } from '../../lib/logger.js'
import type { ApiAuthConfig } from './auth.config.js'
import {
  createGoogleIdTokenVerifier,
  GoogleOidcStrategy,
  type GoogleIdTokenClaims,
  type IdTokenVerifier,
} from './oidc.js'
import { User, type UserDocument } from './user.model.js'

declare global {
  namespace Express {
    interface User {
      _id: Types.ObjectId
      googleId: string
      name: string
      email: string
      image: string | null
      role?: 'admin' | 'user'
      status?: 'active' | 'suspended'
      sessionReview?: { reason: 'email_changed'; at: Date } | null
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    // Set when the authorization request is sent, checked against the ID token's `nonce`
    oidcNonce?: string
    // 'login' for a normal sign-in, 'reauth' for "confirm it's you" before a sensitive change
    oauthMode?: 'login' | 'reauth'
    reauth?: { startedAt: number; returnTo: string }
  }
}

// Passed from the verify callback to the route through `info`
export interface GoogleAuthInfo {
  mode: 'login' | 'reauth'
  authTime?: number
  reason?: string
}

interface CreatePassportOptions {
  // Tests replace the network call to Google's key set
  verifyIdToken?: IdTokenVerifier
}

// Re-authentication must have happened after the flow started (small clock-skew allowance)
const REAUTH_CLOCK_SKEW_S = 30

export const checkIdToken = (
  req: Request,
  claims: GoogleIdTokenClaims,
  profileId: string,
): string | null => {
  if (claims.sub !== profileId) return 'subject_mismatch'
  if (!req.session.oidcNonce || claims.nonce !== req.session.oidcNonce) return 'nonce_mismatch'
  if (claims.email_verified !== true) return 'email_not_verified'

  if (req.session.oauthMode === 'reauth') {
    if (!req.user || req.user.googleId !== claims.sub) return 'reauth_different_account'
    const startedAt = req.session.reauth?.startedAt ?? Infinity
    if (
      typeof claims.auth_time !== 'number' ||
      claims.auth_time * 1000 < startedAt - REAUTH_CLOCK_SKEW_S * 1000
    ) {
      return 'reauth_not_fresh'
    }
  }
  return null
}

export const createPassport = (
  config: ApiAuthConfig,
  options: CreatePassportOptions = {},
): passport.Authenticator => {
  const authPassport = new passport.Passport()
  const verifyIdToken = options.verifyIdToken ?? createGoogleIdTokenVerifier(config.googleClientId)

  authPassport.use(
    'google',
    new GoogleOidcStrategy(
      {
        clientID: config.googleClientId,
        clientSecret: config.googleClientSecret,
        callbackURL: config.googleCallbackUrl,
        // ASVS V10.1.2: the callback is only accepted for a flow this browser session started
        // (`state` kept in the session) and the code is bound to it with PKCE (S256)
        state: true,
        pkce: true,
        passReqToCallback: true,
      },
      // Arity 6 makes passport-oauth2 pass the raw token response (`params`) with the ID token
      (
        req: Request,
        _accessToken: string,
        _refreshToken: string,
        params: { id_token?: string },
        profile: Profile,
        done: VerifyCallback,
      ) => {
        void (async () => {
          const mode = req.session.oauthMode ?? 'login'
          try {
            // The access token is never stored or sent to the browser (ASVS V10.1.1); only the
            // verified ID token claims are used, then discarded
            if (!params.id_token) {
              done(null, false, { mode, reason: 'no_id_token' } satisfies GoogleAuthInfo)
              return
            }
            const claims = await verifyIdToken(params.id_token)
            const problem = checkIdToken(req, claims, profile.id)
            if (problem) {
              done(null, false, { mode, reason: problem } satisfies GoogleAuthInfo)
              return
            }

            if (mode === 'reauth') {
              done(null, req.user, { mode, authTime: claims.auth_time } satisfies GoogleAuthInfo)
              return
            }

            const email = (claims.email ?? profile.emails?.[0]?.value)?.trim().toLowerCase()
            if (!email) {
              done(null, false, { mode, reason: 'no_email' } satisfies GoogleAuthInfo)
              return
            }

            // The sign-in code goes to this email, so a new address is a changed authentication
            // factor: record it so the user is offered to end their other sessions (ASVS V7.4.3)
            const emailChanged = Boolean(
              await User.exists({ googleId: profile.id, email: { $ne: email } }),
            )

            const user = await User.findOneAndUpdate(
              { googleId: profile.id },
              {
                $set: {
                  name: profile.displayName || email,
                  email,
                  image: profile.photos?.[0]?.value ?? null,
                  ...(emailChanged
                    ? { sessionReview: { reason: 'email_changed', at: new Date() } }
                    : {}),
                },
                $setOnInsert: {
                  googleId: profile.id,
                  role: 'user',
                  status: 'active',
                },
              },
              { upsert: true, returnDocument: 'after', runValidators: true },
            )

            if (!user || user.status === 'suspended') {
              done(null, false, { mode, reason: 'suspended' } satisfies GoogleAuthInfo)
              return
            }

            if (emailChanged) {
              // Addresses are not logged (V16.2.5); the event says only that the factor changed
              securityEvent(
                'auth.factor.changed',
                { requestId: req.requestId, userId: user._id.toString(), factor: 'email' },
                'info',
              )
            }

            done(null, user, { mode } satisfies GoogleAuthInfo)
          } catch (error) {
            done(null, false, {
              mode,
              reason:
                error instanceof Error ? `id_token_invalid: ${error.message}` : 'id_token_invalid',
            } satisfies GoogleAuthInfo)
          } finally {
            // One nonce per flow
            delete req.session.oidcNonce
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
