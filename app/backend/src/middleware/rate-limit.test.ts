import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'
import { Types } from 'mongoose'

import { createApiLimiter, createLoginLimiter } from './rate-limit.middleware.js'

const FRONTEND = 'http://localhost:3000'

test('login limiter redirects to the sign-in page after the limit', async () => {
  const app = express()
  app.get(
    '/auth/google',
    createLoginLimiter({ windowMs: 60_000, max: 3, frontendUrl: FRONTEND }),
    (_req, res) => {
      res.redirect(302, 'https://accounts.google.com/o/oauth2/v2/auth')
    },
  )

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await request(app).get('/auth/google')
    assert.equal(response.headers.location, 'https://accounts.google.com/o/oauth2/v2/auth')
  }

  const blocked = await request(app).get('/auth/google')

  assert.equal(blocked.status, 302)
  assert.equal(blocked.headers.location, `${FRONTEND}/auth?error=rate_limited`)
})

test('API limiter answers 429 with rate-limit headers after the limit', async () => {
  const app = express()
  app.use('/api/v1', createApiLimiter({ windowMs: 60_000, max: 3 }))
  app.get('/api/v1/ping', (_req, res) => {
    res.json({ ok: true })
  })

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await request(app).get('/api/v1/ping')
    assert.equal(response.status, 200)
    assert.ok(response.headers['ratelimit'], 'RateLimit header is sent')
  }

  const blocked = await request(app).get('/api/v1/ping')

  assert.equal(blocked.status, 429)
  assert.equal(blocked.body.success, false)
  assert.ok(blocked.headers['retry-after'], 'Retry-After header is sent')
})

test('API limiter keeps a separate bucket for each logged-in user', async () => {
  const userA = new Types.ObjectId()
  const userB = new Types.ObjectId()
  let current = userA

  const app = express()
  app.use((req, _res, next) => {
    req.user = { _id: current, googleId: 'g', name: 'n', email: 'e@example.com', image: null }
    next()
  })
  app.use('/api/v1', createApiLimiter({ windowMs: 60_000, max: 2 }))
  app.get('/api/v1/ping', (_req, res) => {
    res.json({ ok: true })
  })

  assert.equal((await request(app).get('/api/v1/ping')).status, 200)
  assert.equal((await request(app).get('/api/v1/ping')).status, 200)
  assert.equal((await request(app).get('/api/v1/ping')).status, 429)

  current = userB
  assert.equal((await request(app).get('/api/v1/ping')).status, 200)
})
