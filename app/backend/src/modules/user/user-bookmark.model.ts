import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose'

export interface UserBookmarkRecord {
  userId: mongoose.Types.ObjectId
  torId: mongoose.Types.ObjectId
  createdAt: Date
}

const userBookmarkSchema = new Schema<UserBookmarkRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    torId: { type: Schema.Types.ObjectId, required: true, ref: 'Tor' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

userBookmarkSchema.index({ userId: 1, torId: 1 }, { unique: true })

export type UserBookmarkDocument = HydratedDocument<UserBookmarkRecord>

export const UserBookmarkModel =
  (mongoose.models.UserBookmark as Model<UserBookmarkRecord> | undefined) ??
  model<UserBookmarkRecord>('UserBookmark', userBookmarkSchema)
