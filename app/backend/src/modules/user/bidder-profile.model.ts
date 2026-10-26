import mongoose, { Schema, model, type HydratedDocument, type Model } from 'mongoose'

import {
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  JURISTIC_TYPES,
  PROJECT_CLIENT_TYPES,
  PROJECT_ROLES,
  STAFF_ROLE_KEYS,
  type EducationLevel,
  type EmploymentType,
  type JuristicType,
  type ProjectClientType,
  type ProjectRole,
} from './bidder-profile.constants.js'

// Shared by company and person certifications. The name says what the certificate is
// (e.g. "ISO/IEC 27001:2022", "PMP"); the AI matcher compares it with TOR requirements.
export interface CertificationRecord {
  name: string
  issuer: string
  issuedAt: Date | null // how long it has been held is counted from here
  expiresAt: Date | null
}

export interface EducationRecord {
  level: EducationLevel
  field: string
  institution: string
  graduatedYear: number | null // ค.ศ.
}

// One person: the individual bidder themself, or a member of a company's team.
export interface PersonRecord {
  _id: mongoose.Types.ObjectId
  fullName: string
  positionTitle: string
  roles: string[]
  yearsExperience: number | null
  employmentType: EmploymentType | null
  joinedAt: Date | null // date joined the company; TORs often require tenure of 1 year or more
  education: EducationRecord[]
  certifications: CertificationRecord[]
  skills: string[]
}

export interface OrganizationRecord {
  juristicType: JuristicType | null
  registeredDate: Date | null
  registeredCapitalBaht: number | null
  isSme: boolean | null
  hasPositiveNetWorth: boolean | null
  hasBangkokOffice: boolean | null
  certifications: CertificationRecord[]
}

export interface PastProjectRecord {
  _id: mongoose.Types.ObjectId
  name: string
  clientName: string
  clientType: ProjectClientType | null
  contractValueBaht: number | null
  startDate: Date | null
  endDate: Date | null // delivery date (วันที่ส่งมอบงาน); null while still running
  role: ProjectRole | null
  categories: string[]
  technologies: string[]
  description: string
  hasCompletionCertificate: boolean // หนังสือรับรองผลงาน
  memberIds: mongoose.Types.ObjectId[] // team members who worked on it
}

export interface BidderProfileRecord {
  userId: mongoose.Types.ObjectId
  organization: OrganizationRecord
  self: PersonRecord | null
  team: PersonRecord[]
  projects: PastProjectRecord[]
  createdAt: Date
  updatedAt: Date
}

const certificationSchema = new Schema<CertificationRecord>(
  {
    name: { type: String, required: true, trim: true },
    issuer: { type: String, default: '', trim: true },
    issuedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { _id: false },
)

const educationSchema = new Schema<EducationRecord>(
  {
    level: { type: String, enum: EDUCATION_LEVELS, required: true },
    field: { type: String, default: '', trim: true },
    institution: { type: String, default: '', trim: true },
    graduatedYear: { type: Number, default: null },
  },
  { _id: false },
)

const personSchema = new Schema<PersonRecord>({
  fullName: { type: String, default: '', trim: true },
  positionTitle: { type: String, default: '', trim: true },
  roles: { type: [String], enum: STAFF_ROLE_KEYS, default: [] },
  yearsExperience: { type: Number, min: 0, default: null },
  employmentType: { type: String, enum: [...EMPLOYMENT_TYPES, null], default: null },
  joinedAt: { type: Date, default: null },
  education: { type: [educationSchema], default: [] },
  certifications: { type: [certificationSchema], default: [] },
  skills: { type: [String], default: [] },
})

const organizationSchema = new Schema<OrganizationRecord>(
  {
    juristicType: { type: String, enum: [...JURISTIC_TYPES, null], default: null },
    registeredDate: { type: Date, default: null },
    registeredCapitalBaht: { type: Number, min: 0, default: null },
    isSme: { type: Boolean, default: null },
    hasPositiveNetWorth: { type: Boolean, default: null },
    hasBangkokOffice: { type: Boolean, default: null },
    certifications: { type: [certificationSchema], default: [] },
  },
  { _id: false },
)

const pastProjectSchema = new Schema<PastProjectRecord>({
  name: { type: String, required: true, trim: true },
  clientName: { type: String, default: '', trim: true },
  clientType: { type: String, enum: [...PROJECT_CLIENT_TYPES, null], default: null },
  contractValueBaht: { type: Number, min: 0, default: null },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  role: { type: String, enum: [...PROJECT_ROLES, null], default: null },
  // Category keys, the same ones TORs and user interests use
  categories: { type: [String], default: [] },
  technologies: { type: [String], default: [] },
  description: { type: String, default: '', trim: true },
  hasCompletionCertificate: { type: Boolean, default: false },
  memberIds: { type: [Schema.Types.ObjectId], default: [] },
})

// Kept apart from users because passport loads the user document on every request.
const bidderProfileSchema = new Schema<BidderProfileRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true, ref: 'User' },
    organization: { type: organizationSchema, default: () => ({}) },
    self: { type: personSchema, default: null },
    team: { type: [personSchema], default: [] },
    projects: { type: [pastProjectSchema], default: [] },
  },
  { timestamps: true, collection: 'bidder_profiles' },
)

export type BidderProfileDocument = HydratedDocument<BidderProfileRecord>

export const BidderProfileModel =
  (mongoose.models.BidderProfile as Model<BidderProfileRecord> | undefined) ??
  model<BidderProfileRecord>('BidderProfile', bidderProfileSchema)
