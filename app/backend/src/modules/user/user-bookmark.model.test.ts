import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import { UserBookmarkModel } from './user-bookmark.model.js'

test('validates a bookmark and exposes its unique (userId, torId) index', async () => {
  const input = { userId: new Types.ObjectId(), torId: new Types.ObjectId() }
  await new UserBookmarkModel(input).validate()

  const uniqueIndex = UserBookmarkModel.schema
    .indexes()
    .find(([, options]) => options.unique === true)?.[0]

  assert.deepEqual(uniqueIndex, { userId: 1, torId: 1 })
})

test('requires both userId and torId', async () => {
  await assert.rejects(() => new UserBookmarkModel({ torId: new Types.ObjectId() }).validate(), /userId/)
  await assert.rejects(() => new UserBookmarkModel({ userId: new Types.ObjectId() }).validate(), /torId/)
})
