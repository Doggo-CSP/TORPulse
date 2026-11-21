import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import session from 'express-session'
import request from 'supertest'
import { Types } from 'mongoose'

import { createSessionTimeout } from './session-timeout.middleware.js'

const MINUTE = 60_000
const IDLE_MS = 30 * MINUTE
const ABSOLUTE_MS = 120 * MINUTE

declare module 'express-session' {
  interface SessionData {
    testUserId?: string
  }
}

// A mini app with a fake login route standing in for Passport: it stores a user id in the
// session, and a later middleware turns it back into req.user.
const buildApp = (clock: { now: number }) => {
  const app = express()
  app.use(
    session({
      name: 'torpulse.sid',
      secret: 'session-timeout-test-secret-long-enough',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      store: new session.MemoryStore(),
      cookie: { httpOnly: true, sameSite: 'lax', maxAge: IDLE_MS },
    }),
  )
  app.use((req, _res, next) => {
    if (req.session.testUserId) {
      req.user = {
        _id: new Types.ObjectId(req.session.testUserId),
        googleId: 'g',
        name: 'n',
        email: 'e@example.com',
        image: null,
      }
    }
    next()
  })
  app.use(
    createSessionTimeout({
      idleMs: IDLE_MS,
      absoluteMs: ABSOLUTE_MS,
      cookieName: 'torpulse.sid',
      cookieOptions: { httpOnly: true, sameSite: 'lax', path: '/' },
      now: () => clock.now,
    }),
  )
  app.post('/login', (req, res) => {
    req.session.testUserId = new Types.ObjectId().toString()
    res.sendStatus(204)
  })
  app.get('/me', (req, res) => {
    if (!req.user) {
      res.status(401).json({ user: null })
      return
    }
    res.json({ user: req.user._id.toString() })
  })
  return app
}

test('a request inside the idle window keeps the session alive', async () => {
  const clock = { now: 0 }
  const agent = request.agent(buildApp(clock))

  await agent.post('/login').expect(204)
  await agent.get('/me').expect(200)

  clock.now += IDLE_MS - MINUTE
  await agent.get('/me').expect(200)

  // The idle clock restarts on every request
  clock.now += IDLE_MS - MINUTE
  await agent.get('/me').expect(200)
})

test('an idle session is logged out and its cookie cleared', async () => {
  const clock = { now: 0 }
  const agent = request.agent(buildApp(clock))

  await agent.post('/login').expect(204)
  await agent.get('/me').expect(200)

  clock.now += IDLE_MS + 1
  const expired = await agent.get('/me')

  assert.equal(expired.status, 401)
  assert.match(String(expired.headers['set-cookie']?.[0] ?? ''), /^torpulse\.sid=;/)

  // The server-side session is gone too, not just the cookie
  await agent.get('/me').expect(401)
})

test('an active session still ends at the absolute limit', async () => {
  const clock = { now: 0 }
  const agent = request.agent(buildApp(clock))

  await agent.post('/login').expect(204)
  await agent.get('/me').expect(200)

  // Stay active every 20 minutes until past the absolute limit
  while (clock.now + 20 * MINUTE <= ABSOLUTE_MS) {
    clock.now += 20 * MINUTE
    await agent.get('/me').expect(200)
  }

  clock.now = ABSOLUTE_MS + 1
  await agent.get('/me').expect(401)
})
