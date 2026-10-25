import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose'

// queued → processing → done | skipped | failed. A queued job waits until runAfter.
export const QUALIFICATION_JOB_STATUSES = [
  'queued',
  'processing',
  'done',
  'skipped',
  'failed',
] as const
export type QualificationJobStatus = (typeof QUALIFICATION_JOB_STATUSES)[number]

export interface QualificationJobRecord {
  userId: mongoose.Types.ObjectId
  torId: mongoose.Types.ObjectId
  status: QualificationJobStatus
  runAfter: Date
  attemptCount: number
  lockedBy: string | null
  lockedUntil: Date | null
  lastError: string | null
  finishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// One row per (user, TOR): queueing it again moves the same row back to queued.
const qualificationJobSchema = new Schema<QualificationJobRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    torId: { type: Schema.Types.ObjectId, required: true, ref: 'Tor' },
    status: { type: String, enum: QUALIFICATION_JOB_STATUSES, required: true },
    runAfter: { type: Date, required: true },
    attemptCount: { type: Number, default: 0 },
    lockedBy: { type: String, default: null },
    lockedUntil: { type: Date, default: null },
    lastError: { type: String, default: null },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'qualification_match_jobs' },
)

qualificationJobSchema.index({ userId: 1, torId: 1 }, { unique: true })
qualificationJobSchema.index({ status: 1, runAfter: 1 })

export type QualificationJobDocument = HydratedDocument<QualificationJobRecord>

export const QualificationJobModel =
  (mongoose.models.QualificationJob as Model<QualificationJobRecord> | undefined) ??
  model<QualificationJobRecord>('QualificationJob', qualificationJobSchema)
