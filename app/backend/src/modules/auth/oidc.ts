import { randomBytes } from 'node:crypto'

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'

// OpenID Connect on top of Google's OAuth 2.0 sign-in (ASVS V10.1.2, V6.8.4, V7.5.1).
// The ID token Google returns is verified here: signature against Google's published keys,
// issuer, audience (our client id), expiry, the per-login nonce, and for re-authentication the
// `auth_time` claim that proves the user signed in again just now.

export const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'

export interface GoogleIdTokenClaims extends JWTPayload {
  sub: string
  email?: string
  email_verified?: boolean
  nonce?: string
  auth_time?: number
}

export type IdTokenVerifier = (idToken: string) => Promise<GoogleIdTokenClaims>

export const createGoogleIdTokenVerifier = (clientId: string): IdTokenVerifier => {
  const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL))

  return async (idToken) => {
    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: GOOGLE_ISSUERS,
      audience: clientId,
      algorithms: ['RS256'],
      clockTolerance: 60,
    })

    if (typeof payload.sub !== 'string') {
      throw new Error('ID token has no subject')
    }

    return payload as GoogleIdTokenClaims
  }
}

export const generateNonce = (): string => randomBytes(32).toString('base64url')

interface OidcAuthorizationOptions {
  nonce?: string
  maxAge?: number
  prompt?: string
  loginHint?: string
}

// passport-google-oauth20 does not forward the OIDC `nonce` and `max_age` parameters, so this
// subclass adds them to the authorization request.
export class GoogleOidcStrategy extends GoogleStrategy {
  override authorizationParams(options: OidcAuthorizationOptions): object {
    const params = super.authorizationParams(options) as Record<string, string | number>

    if (options.nonce) {
      params.nonce = options.nonce
    }
    if (typeof options.maxAge === 'number') {
      params.max_age = options.maxAge
    }

    return params
  }
}
