import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import { User } from '../auth/user.model.js'
import { PUBLIC_TOR_FILTER, TorModel } from '../tor/tor.model.js'
import { UserBookmarkModel } from './user-bookmark.model.js'
import {
  addBookmark,
  countBookmarksByUser,
  isBookmarked,
  removeBookmark,
  updateUserInterests,
  updateUserProfile,
} from './user.repository.js'

test('updateUserProfile sets the given fields and returns the updated document', async (context) => {
  const userId = new Types.ObjectId()
  let capturedFilter: unknown
  let capturedUpdate: unknown

  context.mock.method(User, 'findByIdAndUpdate', async (filter: unknown, update: unknown) => {
    capturedFilter = filter
    capturedUpdate = update
    return { _id: userId, displayName: 'New Name' }
  })

  await updateUserProfile(userId, { displayName: 'New Name' })

  assert.equal(capturedFilter, userId)
  assert.deepEqual(capturedUpdate, { $set: { displayName: 'New Name' } })
})

test('updateUserInterests sets the interests array', async (context) => {
  const userId = new Types.ObjectId()
  let capturedUpdate: unknown

  context.mock.method(User, 'findByIdAndUpdate', async (_filter: unknown, update: unknown) => {
    capturedUpdate = update
    return { _id: userId, interests: ['web'] }
  })

  await updateUserInterests(userId, ['web'])

  assert.deepEqual(capturedUpdate, { $set: { interests: ['web'] } })
})

test('isBookmarked reflects whether a matching bookmark document exists', async (context) => {
  const userId = new Types.ObjectId()
  const torId = new Types.ObjectId().toString()

  context.mock.method(UserBookmarkModel, 'exists', async () => null)
  assert.equal(await isBookmarked(userId, torId), false)

  context.mock.method(UserBookmarkModel, 'exists', async () => ({ _id: new Types.ObjectId() }))
  assert.equal(await isBookmarked(userId, torId), true)
})

test('addBookmark upserts on the (userId, torId) pair', async (context) => {
  const userId = new Types.ObjectId()
  const torId = new Types.ObjectId().toString()
  let capturedOptions: unknown

  context.mock.method(UserBookmarkModel, 'findOneAndUpdate', async (_filter: unknown, _update: unknown, options: unknown) => {
    capturedOptions = options
    return { userId, torId }
  })

  await addBookmark(userId, torId)

  assert.deepEqual(capturedOptions, { upsert: true, new: true, setDefaultsOnInsert: true })
})

test('removeBookmark deletes the matching (userId, torId) document', async (context) => {
  const userId = new Types.ObjectId()
  const torId = new Types.ObjectId().toString()
  let capturedFilter: unknown

  context.mock.method(UserBookmarkModel, 'deleteOne', async (filter: unknown) => {
    capturedFilter = filter
    return { deletedCount: 1 }
  })

  await removeBookmark(userId, torId)

  assert.deepEqual(capturedFilter, { userId, torId })
})

test('countBookmarksByUser counts only the user bookmarks whose TOR is still public', async (context) => {
  const userId = new Types.ObjectId()
  const torIds = [new Types.ObjectId(), new Types.ObjectId()]
  let capturedBookmarkFilter: unknown
  let capturedTorFilter: unknown

  context.mock.method(UserBookmarkModel, 'distinct', async (_field: string, filter: unknown) => {
    capturedBookmarkFilter = filter
    return torIds
  })
  context.mock.method(TorModel, 'countDocuments', async (filter: unknown) => {
    capturedTorFilter = filter
    return 1
  })

  const count = await countBookmarksByUser(userId)

  assert.equal(count, 1)
  assert.deepEqual(capturedBookmarkFilter, { userId })
  assert.deepEqual(capturedTorFilter, { _id: { $in: torIds }, ...PUBLIC_TOR_FILTER })
})
