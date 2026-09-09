import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import request from 'supertest'
import { Types } from 'mongoose'

import { database } from '../../config/mongoose.js'
import { User } from '../auth/user.model.js'
import { TorModel } from '../tor/tor.model.js'
import { UserBookmarkModel } from './user-bookmark.model.js'
import router from './user.routes.js'

const SEED_PREFIX = 'seed-user-routes-test-'

test('user routes: profile, interests, and bookmark flow', async (t) => {
  await database.connect()

  const testUser = await User.create({
    googleId: `${SEED_PREFIX}google-id`,
    name: 'Test User',
    email: `${SEED_PREFIX}user@example.com`,
    image: null,
  })

  const testTor = await TorModel.create({
    dataSourceId: new Types.ObjectId(),
    ingestionJobId: new Types.ObjectId(),
    externalId: `${SEED_PREFIX}tor-1`,
    sourceVersion: 'v1',
    sourceAdapter: 'central_egp',
    detailUrl: 'https://example.com/tor',
    projectTitle: 'Test Project',
    classificationReason: 'test',
    confidence: 0.9,
    analysisModel: 'test-model',
    analysisVersion: 'v1',
    analyzedAt: new Date(),
  })

  t.after(async () => {
    await UserBookmarkModel.deleteMany({ userId: testUser._id })
    await User.deleteOne({ _id: testUser._id })
    await TorModel.deleteOne({ _id: testTor._id })
    await database.disconnect()
  })

  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = {
      _id: testUser._id,
      googleId: testUser.googleId,
      name: testUser.name,
      email: testUser.email,
      image: testUser.image,
    }
    next()
  })
  app.use('/user', router)

  await t.test('GET /user/profile returns the profile with a zero bookmark count', async () => {
    const response = await request(app).get('/user/profile')

    assert.equal(response.status, 200)
    assert.equal(response.body.user.email, testUser.email)
    assert.equal(response.body.user.bookmarkedCount, 0)
  })

  await t.test('PUT /user/profile updates allowed fields, including the new org fields', async () => {
    const response = await request(app)
      .put('/user/profile')
      .send({ displayName: 'Updated Name', website: 'https://example.com', companyName: 'Acme' })

    assert.equal(response.status, 200)
    assert.equal(response.body.user.displayName, 'Updated Name')
    assert.equal(response.body.user.website, 'https://example.com')
    assert.equal(response.body.user.companyName, 'Acme')
  })

  await t.test('PUT /user/interests rejects a non-array payload', async () => {
    const response = await request(app).put('/user/interests').send({ interests: 'web' })

    assert.equal(response.status, 400)
  })

  await t.test('PUT /user/interests saves a valid interests array', async () => {
    const response = await request(app).put('/user/interests').send({ interests: ['web', 'data'] })

    assert.equal(response.status, 200)
    assert.deepEqual(response.body.interests, ['web', 'data'])
  })

  await t.test('POST /user/bookmarks/:torId toggles a bookmark on, then off', async () => {
    const onResponse = await request(app).post(`/user/bookmarks/${testTor._id.toString()}`)
    assert.equal(onResponse.status, 200)
    assert.equal(onResponse.body.bookmarked, true)
    assert.equal(onResponse.body.bookmarkedCount, 1)

    const listResponse = await request(app).get('/user/bookmarks')
    assert.equal(listResponse.status, 200)
    assert.equal(listResponse.body.tors.length, 1)
    assert.equal(listResponse.body.tors[0]._id, testTor._id.toString())

    const offResponse = await request(app).post(`/user/bookmarks/${testTor._id.toString()}`)
    assert.equal(offResponse.status, 200)
    assert.equal(offResponse.body.bookmarked, false)
    assert.equal(offResponse.body.bookmarkedCount, 0)
  })
})
