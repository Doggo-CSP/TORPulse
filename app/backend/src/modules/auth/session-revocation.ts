import mongoose, { isObjectIdOrHexString, type Types } from 'mongoose'

// Name of the connect-mongo collection set in apps/api/app.ts
export const SESSIONS_COLLECTION = 'sessions'

// Deletes every stored login session of one user (ASVS V7.4.2), e.g. when an admin suspends the
// account. connect-mongo stores each session as a JSON string, and Passport keeps the user id at
// "passport":{"user":"<id>"}. The id is checked to be a 24-hex ObjectId before it is placed in
// the pattern, so it cannot inject regex syntax.
export const revokeUserSessions = async (userId: Types.ObjectId | string): Promise<number> => {
  const id = userId.toString()
  if (!isObjectIdOrHexString(id) || !/^[0-9a-f]{24}$/i.test(id)) {
    throw new Error('revokeUserSessions needs a valid ObjectId')
  }

  const db = mongoose.connection.db
  if (!db) {
    throw new Error('revokeUserSessions needs an open MongoDB connection')
  }

  const result = await db
    .collection(SESSIONS_COLLECTION)
    .deleteMany({ session: { $regex: `"passport":\\{"user":"${id}"\\}` } })

  return result.deletedCount
}
