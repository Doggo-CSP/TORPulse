import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose'

export interface PastProject {
  name: string
  client: string
  valueBaht: number | null
  year: number | null // พ.ศ.
}

export interface UserRecord {
  googleId: string
  name: string
  email: string
  image: string | null
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
  website?: string | null
  companyName?: string
  registrationNumber?: string
  businessType?: string
  registeredDate?: string // YYYY-MM-DD, '' when unset
  registeredCapital?: number | null
  yearsExperience?: number | null
  teamSize?: number | null
  budgetMin?: number | null
  budgetMax?: number | null
  businessObjectives?: string
  certifications?: string[]
  isEgpRegistered?: boolean
  pastProjects?: PastProject[]
  agencyName?: string
  agencyType?: string
  role?: 'admin' | 'user'
  status?: 'active' | 'suspended'
  createdAt: Date
  updatedAt: Date
}

const pastProjectSchema = new Schema<PastProject>(
  {
    name: { type: String, default: '', trim: true },
    client: { type: String, default: '', trim: true },
    valueBaht: { type: Number, default: null, min: 0 },
    year: { type: Number, default: null },
  },
  { _id: false },
)

const userSchema = new Schema<UserRecord>(
  {
    googleId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    image: { type: String, default: null },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    accountType: { type: String, enum: ['personal', 'company', 'agency'], default: 'personal' },
    displayName: { type: String, default: '' },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    jobTitle: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    about: { type: String, default: '' },
    // Category keys; validated against the categories collection by PUT /user/interests
    interests: { type: [String], default: [] },
    website: { type: String, default: null },

    // company profile
    companyName: { type: String, default: '' },
    registrationNumber: { type: String, default: '' },
    businessType: { type: String, default: '' },
    registeredDate: { type: String, default: '' },
    registeredCapital: { type: Number, default: null, min: 0 },
    yearsExperience: { type: Number, default: null, min: 0 },
    teamSize: { type: Number, default: null, min: 0 },
    budgetMin: { type: Number, default: null, min: 0 },
    budgetMax: { type: Number, default: null, min: 0 },
    businessObjectives: { type: String, default: '' },
    certifications: { type: [String], default: [] },
    isEgpRegistered: { type: Boolean, default: false },
    pastProjects: { type: [pastProjectSchema], default: [] },

    // agency profile
    agencyName: { type: String, default: '' },
    agencyType: { type: String, default: '' },
  },
  { timestamps: true },
)

export type UserDocument = HydratedDocument<UserRecord>

export const User =
  (mongoose.models.User as Model<UserRecord> | undefined) ?? model<UserRecord>('User', userSchema)