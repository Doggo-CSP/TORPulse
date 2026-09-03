import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose'

export interface UserRecord {
  googleId: string
  name: string
  email: string
  image?: string | null
  accountType?: 'personal' | 'company' | 'agency'
  displayName?: string
  firstName?: string
  lastName?: string
  jobTitle?: string
  contactEmail?: string
  phone?: string
  address?: string
  about?: string
  interests?: string[]
  bookmarkedTorIds?: mongoose.Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<UserRecord>(
  {
    googleId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    image: { type: String, default: null },
    accountType: { type: String, enum: ['personal', 'company', 'agency'], default: 'personal' },
    displayName: { type: String, default: '' },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    jobTitle: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    about: { type: String, default: '' },
    interests: { type: [String], default: [] },
    bookmarkedTorIds: [{ type: Schema.Types.ObjectId, ref: 'Tor' }],
  },
  { timestamps: true },
)

export type UserDocument = HydratedDocument<UserRecord>

export const User =
  (mongoose.models.User as Model<UserRecord> | undefined) ?? model<UserRecord>('User', userSchema)

