import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose'

import type { CompanyQualification } from '../notification/qualification.js'

export interface PrimaryContactRecord {
  name: string
  position: string
  education: string
  startDate: string
}

export interface UserRecord {
  googleId: string
  name: string
  email: string
  image: string | null
  accountType?: 'personal' | 'company'
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
  primaryContact?: PrimaryContactRecord
  role?: 'admin' | 'user'
  status?: 'active' | 'suspended'
  qualification?: CompanyQualification
  notificationPrefs?: { emailEnabled: boolean }
  // null until the user finishes or skips the onboarding wizard after their first login
  onboardingStatus?: 'completed' | 'dismissed' | null
  createdAt: Date
  updatedAt: Date
}

const primaryContactSchema = new Schema<PrimaryContactRecord>(
  {
    name: { type: String, default: '', trim: true },
    position: { type: String, default: '', trim: true },
    education: { type: String, default: '', trim: true },
    startDate: { type: String, default: '', trim: true },
  },
  { _id: false },
)

const qualificationSchema = new Schema<CompanyQualification>(
  {
    registeredCapitalBaht: { type: Number, min: 0, default: null },
    yearsInBusiness: { type: Number, min: 0, default: null },
    maxPastContractValueBaht: { type: Number, min: 0, default: null },
    certifications: { type: [String], default: [] },
    isThaiJuristicPerson: { type: Boolean, default: null },
    isSme: { type: Boolean, default: null },
    hasPositiveNetWorth: { type: Boolean, default: null },
    pastContractAgeYears: { type: Number, min: 0, default: null },
    hasBangkokOffice: { type: Boolean, default: null },
    staffRoles: { type: [String], default: [] },
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
    accountType: { type: String, enum: ['personal', 'company'], default: 'personal' },
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
    companyName: { type: String, default: '' },
    registrationNumber: { type: String, default: '' },
    businessType: { type: String, default: '' },
    primaryContact: {
      type: primaryContactSchema,
      default: () => ({ name: '', position: '', education: '', startDate: '' }),
    },
    // Matched against TOR eligibility for qualifying-TOR email notifications
    qualification: { type: qualificationSchema, default: () => ({}) },
    onboardingStatus: { type: String, enum: ['completed', 'dismissed', null], default: null },
    notificationPrefs: {
      type: new Schema({ emailEnabled: { type: Boolean, default: true } }, { _id: false }),
      default: () => ({}),
    },
  },
  { timestamps: true },
)

export type UserDocument = HydratedDocument<UserRecord>

export const User =
  (mongoose.models.User as Model<UserRecord> | undefined) ?? model<UserRecord>('User', userSchema)
