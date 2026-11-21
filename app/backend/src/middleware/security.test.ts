import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'

import { createOriginCheck, createSecurityHeaders } from './security.middleware.js'

const FRONTEND = 'http://localhost:3000'

const buildApp = (isProduction = false) => {
  const app = express()
  app.use(createSecurityHeaders({ isProduction }))
  app.use(createOriginCheck(FRONTEND))
  app.get('/data', (_req, res) => {
    res.json({ ok: true })
  })
  app.post('/data', (_req, res) => {
    res.json({ ok: true })
  })
  return app
}

test('API responses carry the security headers', async () => {
  const response = await request(buildApp()).get('/data')

  const csp = response.headers['content-security-policy'] ?? ''
  assert.match(csp, /default-src 'none'/)
  assert.match(csp, /frame-ancestors 'none'/)
  assert.match(csp, /sandbox/)
  assert.equal(response.headers['x-content-type-options'], 'nosniff')
  assert.equal(response.headers['x-frame-options'], 'DENY')
  assert.equal(response.headers['referrer-policy'], 'no-referrer')
  assert.equal(response.headers['cross-origin-resource-policy'], 'same-site')
  assert.equal(response.headers['x-powered-by'], undefined)
})

test('HSTS is sent only in production (behind the HTTPS proxy)', async () => {
  const dev = await request(buildApp(false)).get('/data')
  const prod = await request(buildApp(true)).get('/data')

  assert.equal(dev.headers['strict-transport-security'], undefined)
  assert.equal(prod.headers['strict-transport-security'], 'max-age=31536000; includeSubDomains')
})

test('origin check refuses state-changing requests from another origin', async () => {
  const response = await request(buildApp()).post('/data').set('Origin', 'https://evil.example')

  assert.equal(response.status, 403)
  assert.equal(response.body.success, false)
})

test('origin check refuses a cross-site browser request that hides its Origin', async () => {
  const response = await request(buildApp()).post('/data').set('Sec-Fetch-Site', 'cross-site')

  assert.equal(response.status, 403)
})

test('origin check allows the frontend, non-browser clients, and safe methods', async () => {
  const app = buildApp()

  assert.equal((await request(app).post('/data').set('Origin', FRONTEND)).status, 200)
  assert.equal((await request(app).post('/data')).status, 200)
  assert.equal((await request(app).get('/data').set('Origin', 'https://evil.example')).status, 200)
})
