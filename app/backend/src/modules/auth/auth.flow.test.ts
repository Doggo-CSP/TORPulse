import assert from 'node:assert/strict'
import test from 'node:test'

import session from 'express-session'
import mongoose from 'mongoose'
import request from 'supertest'

import { createApiApp } from '../../apps/api/app.js'
import { database } from '../../config/mongoose.js'
import type { MailMessage } from '../notification/mailer.js'
import type { ApiAuthConfig } from './auth.config.js'
import type { GoogleIdTokenClaims } from './oidc.js'
import { createPassport } from './passport.js'
import { SESSIONS_COLLECTION } from './session-revocation.js'
import { User } from './user.model.js'

// End-to-end sign-in: Google (token endpoint, profile, ID token signature) is simulated, every
// part of TORPulse is real: state + PKCE, nonce, ID-token checks, MFA code, session gate,
// device binding, re-authentication and new-device alert.

const GOOGLE_ID = 'flow-test-google-id'
const EMAIL = 'flow-test@example.com'
const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36'
const FIREFOX_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0'

const config: ApiAuthConfig = {
  googleClientId: 'flow-client',
  googleClientSecret: 'flow-secret',
  googleCallbackUrl: 'http://localhost:8000/auth/google/callback',
  sessionSecret: 'flow-test-session-secret-long-enough-123',
  frontendUrl: 'http://localhost:3000',
  isProduction: false,
}

interface FakeGoogle {
  nonce?: string
  authTime?: number
  sub?: string
  email?: string
}

const buildApp = () => {
  const google: FakeGoogle = {}
  const mail: MailMessage[] = []
  const authPassport = createPassport(config, {
    verifyIdToken: async () =>
      ({
        sub: google.sub ?? GOOGLE_ID,
        email: google.email ?? EMAIL,
        email_verified: true,
        nonce: google.nonce,
        auth_time: google.authTime,
      }) as GoogleIdTokenClaims,
  })

  // Replace the two network calls passport-oauth2 makes to Google
  const strategy = (authPassport as unknown as { _strategy(name: string): any })._strategy('google')
  strategy._oauth2.getOAuthAccessToken = (
    _code: string,
    params: Record<string, string>,
    callback: (error: unknown, at?: string, rt?: string, result?: unknown) => void,
  ) => {
    // PKCE: the token request must carry the verifier for the challenge sent earlier
    assert.ok(params.code_verifier, 'PKCE code_verifier is sent to the token endpoint')
    callback(null, 'access-token', 'refresh-token', { id_token: 'header.payload.signature' })
  }
  strategy.userProfile = (_token: string, done: (error: unknown, profile?: unknown) => void) =>
    done(null, {
      id: google.sub ?? GOOGLE_ID,
      displayName: 'Flow Test',
      emails: [{ value: google.email ?? EMAIL }],
    })

  const app = createApiApp(config, {
    sessionStore: new session.MemoryStore(),
    authPassport,
    mailer: { send: async (message) => void mail.push(message) },
    // This test signs in many times; the limiter has its own tests
    rateLimit: { loginMax: 1000, apiMax: 1000 },
  })
  return { app, google, mail }
}

const codeFrom = (message: MailMessage | undefined) => message?.text.match(/\b(\d{6})\b/)?.[1] ?? ''

// Starts sign-in and returns the parameters TORPulse sent to Google
const startGoogle = async (agent: request.Agent, path = '/auth/google') => {
  const response = await agent.get(path).set('User-Agent', CHROME_MAC)
  assert.equal(response.status, 302)
  return new URL(response.headers.location ?? '')
}

test('sign-in flow: state, PKCE, nonce, MFA, session gate, device binding, re-auth', async (t) => {
  await database.connect()
  await User.deleteMany({ googleId: GOOGLE_ID })
  t.after(async () => {
    await User.deleteMany({ googleId: GOOGLE_ID })
    await database.disconnect()
  })

  const { app, google, mail } = buildApp()
  const agent = request.agent(app)

  await t.test(
    'the authorization request carries state, PKCE, nonce and select_account',
    async () => {
      const url = await startGoogle(agent)
      assert.equal(url.hostname, 'accounts.google.com')
      assert.ok(url.searchParams.get('state'))
      assert.ok(url.searchParams.get('nonce'))
      assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
      assert.ok(url.searchParams.get('code_challenge'))
      assert.equal(url.searchParams.get('prompt'), 'select_account')
      assert.match(url.searchParams.get('scope') ?? '', /openid/)
    },
  )

  await t.test('a callback with a forged state is refused', async () => {
    const response = await agent
      .get('/auth/google/callback?code=abc&state=forged')
      .set('User-Agent', CHROME_MAC)
    assert.equal(response.headers.location, `${config.frontendUrl}/auth?error=google`)
  })

  await t.test('a valid callback logs in as MFA-pending and emails a code', async () => {
    const url = await startGoogle(agent)
    google.nonce = url.searchParams.get('nonce') ?? undefined
    const response = await agent
      .get(`/auth/google/callback?code=abc&state=${url.searchParams.get('state')}`)
      .set('User-Agent', CHROME_MAC)

    assert.equal(response.headers.location, `${config.frontendUrl}/auth/verify`)
    assert.equal(mail.length, 1)
    assert.equal(mail[0]?.to, EMAIL)
    assert.match(codeFrom(mail[0]), /^\d{6}$/)
  })

  await t.test('before the code, the session is treated as logged out', async () => {
    const me = await agent.get('/auth/me').set('User-Agent', CHROME_MAC)
    assert.equal(me.status, 401)
    assert.deepEqual(me.body, { user: null, mfaRequired: true })

    const profile = await agent.get('/api/v1/user/profile').set('User-Agent', CHROME_MAC)
    assert.equal(profile.status, 401)
  })

  await t.test('a wrong code is refused with attempts left', async () => {
    const wrong = codeFrom(mail[0]) === '000000' ? '111111' : '000000'
    const response = await agent
      .post('/auth/mfa/verify')
      .set('User-Agent', CHROME_MAC)
      .send({ code: wrong })
    assert.equal(response.status, 400)
    assert.equal(response.body.code, 'MFA_INVALID')
    assert.equal(response.body.attemptsLeft, 4)
  })

  await t.test('the right code completes sign-in', async () => {
    const response = await agent
      .post('/auth/mfa/verify')
      .set('User-Agent', CHROME_MAC)
      .send({ code: codeFrom(mail[0]) })
    assert.equal(response.status, 200)

    const me = await agent.get('/auth/me').set('User-Agent', CHROME_MAC)
    assert.equal(me.status, 200)
    assert.equal(me.body.user.email, EMAIL)
    // First device ever: recorded without an alert
    assert.equal(mail.length, 1)
  })

  await t.test(
    'a sensitive change needs re-authentication, which needs a fresh auth_time',
    async () => {
      const before = await agent
        .put('/api/v1/user/profile')
        .set('User-Agent', CHROME_MAC)
        .send({ contactEmail: 'new-contact@example.com' })
      assert.equal(before.status, 403)
      assert.equal(before.body.code, 'REAUTH_REQUIRED')

      const stale = await startGoogle(agent, '/auth/google/reauth?returnTo=/profile')
      assert.equal(stale.searchParams.get('prompt'), 'login')
      assert.equal(stale.searchParams.get('max_age'), '0')
      google.nonce = stale.searchParams.get('nonce') ?? undefined
      google.authTime = Math.floor(Date.now() / 1000) - 3600
      const staleCallback = await agent
        .get(`/auth/google/callback?code=abc&state=${stale.searchParams.get('state')}`)
        .set('User-Agent', CHROME_MAC)
      assert.equal(staleCallback.headers.location, `${config.frontendUrl}/profile?reauth=failed`)

      const fresh = await startGoogle(agent, '/auth/google/reauth?returnTo=/profile')
      google.nonce = fresh.searchParams.get('nonce') ?? undefined
      google.authTime = Math.floor(Date.now() / 1000) + 1
      const freshCallback = await agent
        .get(`/auth/google/callback?code=abc&state=${fresh.searchParams.get('state')}`)
        .set('User-Agent', CHROME_MAC)
      assert.equal(freshCallback.headers.location, `${config.frontendUrl}/profile?reauth=ok`)

      const after = await agent
        .put('/api/v1/user/profile')
        .set('User-Agent', CHROME_MAC)
        .send({ contactEmail: 'new-contact@example.com' })
      assert.equal(after.status, 200)
    },
  )

  await t.test('returnTo cannot redirect off-site', async () => {
    const url = await startGoogle(agent, '/auth/google/reauth?returnTo=//evil.example/x')
    google.nonce = url.searchParams.get('nonce') ?? undefined
    google.authTime = Math.floor(Date.now() / 1000) + 1
    const callback = await agent
      .get(`/auth/google/callback?code=abc&state=${url.searchParams.get('state')}`)
      .set('User-Agent', CHROME_MAC)
    assert.equal(callback.headers.location, `${config.frontendUrl}/?reauth=ok`)
  })

  await t.test('the same cookie from another browser family ends the session', async () => {
    const stolen = await agent.get('/auth/me').set('User-Agent', FIREFOX_WIN)
    assert.equal(stolen.status, 401)

    const original = await agent.get('/auth/me').set('User-Agent', CHROME_MAC)
    assert.equal(original.status, 401)
  })
})

test('five wrong codes lock the sign-in and alert the owner', async (t) => {
  await database.connect()
  await User.deleteMany({ googleId: GOOGLE_ID })
  t.after(async () => {
    await User.deleteMany({ googleId: GOOGLE_ID })
    await database.disconnect()
  })

  const { app, google, mail } = buildApp()
  const agent = request.agent(app)
  const url = await startGoogle(agent)
  google.nonce = url.searchParams.get('nonce') ?? undefined
  await agent
    .get(`/auth/google/callback?code=abc&state=${url.searchParams.get('state')}`)
    .set('User-Agent', CHROME_MAC)
  const wrong = codeFrom(mail[0]) === '000000' ? '111111' : '000000'

  let last: request.Response | undefined
  for (let attempt = 0; attempt < 5; attempt += 1) {
    last = await agent.post('/auth/mfa/verify').set('User-Agent', CHROME_MAC).send({ code: wrong })
  }

  assert.equal(last?.status, 429)
  assert.equal(last?.body.code, 'MFA_LOCKED')
  // Wait for the alert email sent in the background
  await new Promise((resolve) => setTimeout(resolve, 100))
  assert.ok(mail.some((message) => message.subject === 'Failed sign-in attempt on TORPulse'))

  const afterLock = await agent
    .post('/auth/mfa/verify')
    .set('User-Agent', CHROME_MAC)
    .send({ code: codeFrom(mail[0]) })
  assert.equal(afterLock.status, 400)
  assert.equal(afterLock.body.code, 'MFA_NO_CHALLENGE')
})

// Signs in through Google and the emailed code, and returns the agent
const signIn = async (
  app: ReturnType<typeof buildApp>['app'],
  google: FakeGoogle,
  mail: MailMessage[],
) => {
  const agent = request.agent(app)
  const url = await startGoogle(agent)
  google.nonce = url.searchParams.get('nonce') ?? undefined
  await agent
    .get(`/auth/google/callback?code=abc&state=${url.searchParams.get('state')}`)
    .set('User-Agent', CHROME_MAC)
  const verify = await agent
    .post('/auth/mfa/verify')
    .set('User-Agent', CHROME_MAC)
    .send({ code: codeFrom(mail.at(-1)) })
  assert.equal(verify.status, 200)
  return agent
}

test('a changed sign-in email offers to sign out other devices (ASVS V7.4.3)', async (t) => {
  const NEW_EMAIL = 'flow-test-new@example.com'
  const otherUserId = new mongoose.Types.ObjectId().toString()
  await database.connect()
  await User.deleteMany({ googleId: GOOGLE_ID })
  const sessions = () => mongoose.connection.db!.collection<{ _id: string }>(SESSIONS_COLLECTION)
  t.after(async () => {
    await User.deleteMany({ googleId: GOOGLE_ID })
    await sessions().deleteMany({ _id: { $regex: '^v743-' } })
    await database.disconnect()
  })

  const { app, google, mail } = buildApp()

  await t.test('a first sign-in is not a factor change', async () => {
    const agent = await signIn(app, google, mail)
    const me = await agent.get('/auth/me').set('User-Agent', CHROME_MAC)
    assert.equal(me.status, 200)
    assert.equal(me.body.user.sessionReview, undefined)
  })

  await t.test('signing in again with a new Google email sets the offer', async () => {
    google.email = NEW_EMAIL
    const agent = await signIn(app, google, mail)
    // The code for this sign-in went to the new address
    assert.equal(mail.at(-1)?.to, NEW_EMAIL)

    const me = await agent.get('/auth/me').set('User-Agent', CHROME_MAC)
    assert.equal(me.body.user.email, NEW_EMAIL)
    assert.equal(me.body.user.sessionReview.reason, 'email_changed')
    assert.ok(Date.parse(me.body.user.sessionReview.at))
  })

  await t.test('sign out other devices keeps only the current session', async () => {
    const agent = await signIn(app, google, mail)
    const user = await User.findOne({ googleId: GOOGLE_ID })
    const stored = (userId: string, id: string) => ({
      _id: id,
      expires: new Date(Date.now() + 60_000),
      session: JSON.stringify({ cookie: {}, passport: { user: userId } }),
    })
    // Two other sessions of this user (stored in MongoDB) and one of someone else
    await sessions().insertMany([
      stored(user!._id.toString(), 'v743-mine-1'),
      stored(user!._id.toString(), 'v743-mine-2'),
      stored(otherUserId, 'v743-other'),
    ])

    const guest = await request(app).post('/auth/sessions/revoke-others')
    assert.equal(guest.status, 401)

    const response = await agent.post('/auth/sessions/revoke-others').set('User-Agent', CHROME_MAC)
    assert.equal(response.status, 200)
    assert.equal(response.body.revoked, 2)

    const left = await sessions()
      .find({ _id: { $regex: '^v743-' } })
      .toArray()
    assert.deepEqual(
      left.map((doc) => doc._id),
      ['v743-other'],
    )

    // The caller stays signed in, and the offer is gone
    const me = await agent.get('/auth/me').set('User-Agent', CHROME_MAC)
    assert.equal(me.status, 200)
    assert.equal(me.body.user.sessionReview, undefined)
  })

  await t.test('keeping the other sessions also clears the offer', async () => {
    google.email = EMAIL
    const agent = await signIn(app, google, mail)
    const before = await agent.get('/auth/me').set('User-Agent', CHROME_MAC)
    assert.equal(before.body.user.sessionReview.reason, 'email_changed')

    const guest = await request(app).post('/auth/sessions/review/dismiss')
    assert.equal(guest.status, 401)

    const dismiss = await agent.post('/auth/sessions/review/dismiss').set('User-Agent', CHROME_MAC)
    assert.equal(dismiss.status, 200)
    const after = await agent.get('/auth/me').set('User-Agent', CHROME_MAC)
    assert.equal(after.body.user.sessionReview, undefined)
  })
})
