import { z } from 'zod'

import {
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  JURISTIC_TYPES,
  PROJECT_CLIENT_TYPES,
  PROJECT_ROLES,
  STAFF_ROLE_KEYS,
} from './bidder-profile.constants.js'

// Every field is optional so a half-filled profile can be saved as a draft (UC-07);
// completeness is reported separately by GET /user/bidder-profile.

const nullableAmount = z.number().nonnegative().nullable()

// YYYY-MM-DD from the client, stored as a Date
const nullableDate = z.iso
  .date()
  .nullable()
  .transform((value) => (value === null ? null : new Date(value)))

// Dates that describe something that already happened cannot be in the future (one day of
// slack for time zones). ASVS V2.2.3: related values must make sense together.
const notInFuture = (date: Date | null | undefined) =>
  !date || date.getTime() <= Date.now() + 24 * 60 * 60 * 1000
const pastDate = nullableDate.refine(notInFuture, 'date must not be in the future')

const uniqueStrings = (schema: z.ZodType<string>, max: number) =>
  z
    .array(schema)
    .max(max)
    .transform((values) => [...new Set(values)])

const tagList = uniqueStrings(z.string().trim().min(1).max(100), 50)

// Stored by name, e.g. "ISO/IEC 27001:2022" or "PMP"; the AI matcher reads the name
const certificationSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    issuer: z.string().trim().max(200).default(''),
    issuedAt: pastDate.default(null),
    expiresAt: nullableDate.default(null),
  })
  .refine((c) => !c.issuedAt || !c.expiresAt || c.issuedAt <= c.expiresAt, {
    message: 'expiresAt must not be before issuedAt',
    path: ['expiresAt'],
  })

const educationSchema = z.object({
  level: z.enum(EDUCATION_LEVELS),
  field: z.string().trim().max(200).default(''),
  institution: z.string().trim().max(200).default(''),
  // ค.ศ.; at most next year (expected graduation)
  graduatedYear: z
    .number()
    .int()
    .min(1950)
    .refine((year) => year <= new Date().getFullYear() + 1, 'graduatedYear is too far ahead')
    .nullable()
    .default(null),
})

export const personSchema = z.object({
  fullName: z.string().trim().max(200).optional(),
  positionTitle: z.string().trim().max(200).optional(),
  roles: uniqueStrings(z.enum(STAFF_ROLE_KEYS), STAFF_ROLE_KEYS.length).optional(),
  yearsExperience: z.number().min(0).max(60).nullable().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).nullable().optional(),
  joinedAt: pastDate.optional(),
  education: z.array(educationSchema).max(10).optional(),
  certifications: z.array(certificationSchema).max(30).optional(),
  skills: tagList.optional(),
})

export const organizationSchema = z.object({
  juristicType: z.enum(JURISTIC_TYPES).nullable().optional(),
  registeredDate: pastDate.optional(),
  registeredCapitalBaht: nullableAmount.optional(),
  isSme: z.boolean().nullable().optional(),
  hasPositiveNetWorth: z.boolean().nullable().optional(),
  hasBangkokOffice: z.boolean().nullable().optional(),
  certifications: z.array(certificationSchema).max(30).optional(),
})

export const preferencesSchema = z
  .object({
    budgetMinBaht: nullableAmount.optional(),
    budgetMaxBaht: nullableAmount.optional(),
    businessObjectives: z.string().trim().max(2000).optional(),
  })
  .refine(
    (v) => v.budgetMinBaht == null || v.budgetMaxBaht == null || v.budgetMinBaht <= v.budgetMaxBaht,
    { message: 'budgetMinBaht must not exceed budgetMaxBaht', path: ['budgetMinBaht'] },
  )

const objectIdString = z.string().regex(/^[0-9a-f]{24}$/i, 'must be an ObjectId')

const pastProjectFields = {
  name: z.string().trim().min(1).max(300),
  clientName: z.string().trim().max(300).optional(),
  clientType: z.enum(PROJECT_CLIENT_TYPES).nullable().optional(),
  contractValueBaht: nullableAmount.optional(),
  startDate: pastDate.optional(),
  endDate: nullableDate.optional(),
  role: z.enum(PROJECT_ROLES).nullable().optional(),
  categories: tagList.optional(),
  technologies: tagList.optional(),
  description: z.string().trim().max(5000).optional(),
  hasCompletionCertificate: z.boolean().optional(),
  memberIds: uniqueStrings(objectIdString, 100).optional(),
}

const endNotBeforeStart = (project: { startDate?: Date | null; endDate?: Date | null }) =>
  !project.startDate || !project.endDate || project.startDate <= project.endDate

export const createProjectSchema = z
  .object(pastProjectFields)
  .refine(endNotBeforeStart, { message: 'endDate must not be before startDate', path: ['endDate'] })

export const updateProjectSchema = z
  .object({ ...pastProjectFields, name: pastProjectFields.name.optional() })
  .refine(endNotBeforeStart, { message: 'endDate must not be before startDate', path: ['endDate'] })
