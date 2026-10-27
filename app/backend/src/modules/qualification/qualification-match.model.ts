import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose'

export const REQUIREMENT_CATEGORIES = [
  'legal',
  'financial',
  'experience',
  'personnel',
  'certification',
  'technical',
  'other',
] as const
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number]

// unknown: the profile has no information to judge this requirement either way
export const REQUIREMENT_STATUSES = ['met', 'partial', 'not_met', 'unknown'] as const
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number]

export interface RequirementResultRecord {
  requirement: string
  category: RequirementCategory
  mandatory: boolean
  status: RequirementStatus
  reason: string
  suggestion: string
}

export interface QualificationMatchRecord {
  userId: mongoose.Types.ObjectId
  torId: mongoose.Types.ObjectId
  // Which profile, TOR and prompt the result was computed from; a mismatch means stale
  inputVersion: string
  percentage: number | null
  allMandatoryMet: boolean
  counts: Record<RequirementStatus, number>
  requirements: RequirementResultRecord[]
  summary: string
  aiModel: string
  evaluatedAt: Date
}

const requirementResultSchema = new Schema<RequirementResultRecord>(
  {
    requirement: { type: String, required: true },
    category: { type: String, enum: REQUIREMENT_CATEGORIES, required: true },
    mandatory: { type: Boolean, required: true },
    status: { type: String, enum: REQUIREMENT_STATUSES, required: true },
    reason: { type: String, default: '' },
    suggestion: { type: String, default: '' },
  },
  { _id: false },
)

// One cached AI result per (user, TOR), so viewing a TOR again costs no AI call.
const qualificationMatchSchema = new Schema<QualificationMatchRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    torId: { type: Schema.Types.ObjectId, required: true, ref: 'Tor' },
    inputVersion: { type: String, required: true },
    percentage: { type: Number, min: 0, max: 100, default: null },
    allMandatoryMet: { type: Boolean, required: true },
    counts: {
      met: { type: Number, default: 0 },
      partial: { type: Number, default: 0 },
      not_met: { type: Number, default: 0 },
      unknown: { type: Number, default: 0 },
    },
    requirements: { type: [requirementResultSchema], default: [] },
    summary: { type: String, default: '' },
    aiModel: { type: String, required: true },
    evaluatedAt: { type: Date, required: true },
  },
  { collection: 'qualification_matches' },
)

qualificationMatchSchema.index({ userId: 1, torId: 1 }, { unique: true })

export type QualificationMatchDocument = HydratedDocument<QualificationMatchRecord>

export const QualificationMatchModel =
  (mongoose.models.QualificationMatch as Model<QualificationMatchRecord> | undefined) ??
  model<QualificationMatchRecord>('QualificationMatch', qualificationMatchSchema)
