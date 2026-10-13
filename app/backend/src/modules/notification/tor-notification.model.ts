import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose'

export const TOR_NOTIFICATION_STATUSES = ['pending', 'sending', 'sent', 'failed', 'skipped'] as const
export type TorNotificationStatus = (typeof TOR_NOTIFICATION_STATUSES)[number]

// One row per (user, TOR) pair the user fully qualifies for. The unique index is what
// guarantees the same TOR is never emailed to the same user twice.
export interface TorNotificationRecord {
  userId: mongoose.Types.ObjectId
  torId: mongoose.Types.ObjectId
  status: TorNotificationStatus
  attemptCount: number
  nextRetryAt: Date | null
  lockedBy: string | null
  lockedUntil: Date | null
  lastError: { code: string; message: string; occurredAt: Date } | null
  emailBatchId: string | null
  sentAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const torNotificationSchema = new Schema<TorNotificationRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    torId: { type: Schema.Types.ObjectId, required: true, ref: 'Tor' },
    status: { type: String, required: true, enum: TOR_NOTIFICATION_STATUSES, default: 'pending' },
    attemptCount: { type: Number, required: true, default: 0 },
    nextRetryAt: { type: Date, default: null },
    lockedBy: { type: String, default: null },
    lockedUntil: { type: Date, default: null },
    lastError: {
      type: new Schema(
        { code: String, message: String, occurredAt: Date },
        { _id: false },
      ),
      default: null,
    },
    emailBatchId: { type: String, default: null },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'tor_notifications' },
)

torNotificationSchema.index({ userId: 1, torId: 1 }, { unique: true })
torNotificationSchema.index({ status: 1, nextRetryAt: 1, lockedUntil: 1 })

export type TorNotificationDocument = HydratedDocument<TorNotificationRecord>

export const TorNotificationModel =
  (mongoose.models.TorNotification as Model<TorNotificationRecord> | undefined) ??
  model<TorNotificationRecord>('TorNotification', torNotificationSchema)
