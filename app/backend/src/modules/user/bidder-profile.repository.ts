import type { Types } from 'mongoose'

import { User } from '../auth/user.model.js'
import type { CompanyQualification } from '../notification/qualification.js'
import {
  BidderProfileModel,
  type PersonRecord,
  type PastProjectRecord,
} from './bidder-profile.model.js'
import {
  deriveQualification,
  type BidderProfileInput,
  type BidderUser,
} from './bidder-profile.qualification.js'

export async function findBidderProfile(userId: Types.ObjectId | string) {
  return BidderProfileModel.findOne({ userId })
}

// Every user gets an empty profile the first time they save any part of it.
export async function findOrCreateBidderProfile(userId: Types.ObjectId | string) {
  return BidderProfileModel.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).orFail()
}

export function findTeamMember(team: PersonRecord[], memberId: string) {
  return team.find((member) => member._id.toString() === memberId) ?? null
}

export function findProject(projects: PastProjectRecord[], projectId: string) {
  return projects.find((project) => project._id.toString() === projectId) ?? null
}

// Rewrites users.qualification, the snapshot notification/eligibility.ts reads, from the
// detailed profile. Users without a bidder profile keep the qualification they entered by hand.
export async function syncDerivedQualification(
  user: BidderUser & { _id: Types.ObjectId },
  profile: BidderProfileInput,
): Promise<CompanyQualification> {
  const qualification = deriveQualification(user, profile)
  await User.updateOne({ _id: user._id }, { $set: { qualification } })
  return qualification
}
