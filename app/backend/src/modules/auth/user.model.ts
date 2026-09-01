import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose'

export interface UserRecord {
  googleId: string
  name: string
  email: string
  image: string | null
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<UserRecord>(
  {
    googleId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    image: { type: String, default: null },
  },
  { timestamps: true },
)

export type UserDocument = HydratedDocument<UserRecord>

export const User =
  (mongoose.models.User as Model<UserRecord> | undefined) ?? model<UserRecord>('User', userSchema)
