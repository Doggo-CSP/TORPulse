import type { Types } from 'mongoose'

import { User } from '../auth/user.model.js'
import { publicTorFilter, TorModel } from '../tor/tor.model.js'
import { UserBookmarkModel } from './user-bookmark.model.js'
import type { UpdateProfileInput } from './user.types.js'

export async function findUserById(userId: Types.ObjectId | string) {
  return User.findById(userId)
}

export async function updateUserProfile(
  userId: Types.ObjectId | string,
  fields: UpdateProfileInput,
) {
  return User.findByIdAndUpdate(userId, { $set: fields }, { new: true, runValidators: true })
}

export async function updateUserInterests(userId: Types.ObjectId | string, interests: string[]) {
  return User.findByIdAndUpdate(userId, { $set: { interests } }, { new: true })
}

export async function isBookmarked(userId: Types.ObjectId | string, torId: string) {
  const bookmark = await UserBookmarkModel.exists({ userId, torId })
  return bookmark !== null
}

export async function addBookmark(userId: Types.ObjectId | string, torId: string) {
  return UserBookmarkModel.findOneAndUpdate(
    { userId, torId },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
}

export async function removeBookmark(userId: Types.ObjectId | string, torId: string) {
  return UserBookmarkModel.deleteOne({ userId, torId })
}

export async function listBookmarksByUser(userId: Types.ObjectId | string) {
  return UserBookmarkModel.find({ userId })
    .populate({ path: 'torId', match: publicTorFilter() })
    .sort({ createdAt: -1 })
}

// Counts only bookmarks whose TOR is still public, matching listBookmarksByUser.
export async function countBookmarksByUser(userId: Types.ObjectId | string) {
  const torIds = await UserBookmarkModel.distinct('torId', { userId })
  return TorModel.countDocuments({ _id: { $in: torIds }, ...publicTorFilter() })
}
