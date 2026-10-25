import type { Types } from 'mongoose'

import { QualificationMatchModel } from './qualification-match.model.js'
import type { MatchResult } from './qualification-match.service.js'

export async function findQualificationMatch(
  userId: Types.ObjectId | string,
  torId: Types.ObjectId | string,
) {
  return QualificationMatchModel.findOne({ userId, torId })
}

export async function findQualificationMatches(
  userId: Types.ObjectId | string,
  torIds: Types.ObjectId[],
) {
  return QualificationMatchModel.find({ userId, torId: { $in: torIds } }).lean()
}

// Keeps one result per (user, TOR): a new evaluation replaces the old one.
export async function saveQualificationMatch(
  userId: Types.ObjectId | string,
  torId: Types.ObjectId | string,
  inputVersion: string,
  aiModel: string,
  result: MatchResult,
) {
  return QualificationMatchModel.findOneAndUpdate(
    { userId, torId },
    { $set: { ...result, inputVersion, aiModel, evaluatedAt: new Date() } },
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).orFail()
}
