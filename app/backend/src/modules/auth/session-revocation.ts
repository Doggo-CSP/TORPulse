import mongoose, { isObjectIdOrHexString, type Types } from 'mongoose'

import { securityEvent } from '../../lib/logger.js'

// Name of the connect-mongo collection set in apps/api/app.ts
export const SESSIONS_COLLECTION = 'sessions'

// Deletes every stored login session of one user (ASVS V7.4.2), e.g. when an admin suspends the
// account. connect-mongo stores each session as a JSON string, and Passport keeps the user id at
// "passport":{"user":"<id>"}. The id is checked to be a 24-hex ObjectId before it is placed in
// the pattern, so it cannot inject regex syntax.
// With exceptSessionId, the caller's own session is kept: "sign out other devices" (ASVS V7.4.3).
// connect-mongo uses the session id as the document _id.
export const revokeUserSessions = async (
  userId: Types.ObjectId | string,
  { exceptSessionId }: { exceptSessionId?: string } = {},
): Promise<number> => {
  const id = userId.toString()
  if (!isObjectIdOrHexString(id) || !/^[0-9a-f]{24}$/i.test(id)) {
    throw new Error('revokeUserSessions needs a valid ObjectId')
  }

  const db = mongoose.connection.db
  if (!db) {
    throw new Error('revokeUserSessions needs an open MongoDB connection')
  }

  const result = await db.collection<{ _id: string }>(SESSIONS_COLLECTION).deleteMany({
    session: { $regex: `"passport":\\{"user":"${id}"\\}` },
    ...(exceptSessionId ? { _id: { $ne: String(exceptSessionId) } } : {}),
  })

  securityEvent(
    'session.revoked',
    { userId: id, sessions: result.deletedCount, keptCurrent: Boolean(exceptSessionId) },
    'info',
  )
  return result.deletedCount
}
