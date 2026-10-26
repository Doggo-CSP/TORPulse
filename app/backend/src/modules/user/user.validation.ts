import { z } from 'zod'

import { LEGACY_INTEREST_IDS } from '../category/category.constants.js'
import { CERTIFICATION_KEYS, STAFF_ROLE_KEYS } from '../notification/qualification.js'

const nullableAmount = z.number().nonnegative().nullable()

export const qualificationSchema = z.object({
  registeredCapitalBaht: nullableAmount,
  yearsInBusiness: nullableAmount,
  maxPastContractValueBaht: nullableAmount,
  certifications: z.array(z.enum(CERTIFICATION_KEYS)).transform((keys) => [...new Set(keys)]),
  isThaiJuristicPerson: z.boolean().nullable(),
  isSme: z.boolean().nullable(),
  hasPositiveNetWorth: z.boolean().nullable().default(null),
  pastContractAgeYears: nullableAmount.default(null),
  hasBangkokOffice: z.boolean().nullable().default(null),
  staffRoles: z
    .array(z.enum(STAFF_ROLE_KEYS))
    .default([])
    .transform((keys) => [...new Set(keys)]),
})

export const updateProfileSchema = z.object({
  accountType: z.enum(['personal', 'company']).optional(),
  displayName: z.string().trim().optional(),
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  jobTitle: z.string().trim().optional(),
  contactEmail: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  image: z.string().trim().optional(),
  address: z.string().trim().optional(),
  about: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  registrationNumber: z.string().trim().optional(),
  businessType: z.string().trim().optional(),
  website: z.string().trim().optional(),
  qualification: qualificationSchema.optional(),
  notificationPrefs: z.object({ emailEnabled: z.boolean() }).optional(),
})

// TODO(LEGACY-INTEREST-IDS): also accepts the profile page's old ids ("web", "ai", ...) and
// converts them to category keys before saving; drop the legacy ids once the frontend is fixed.
// Whether each key is an active category is checked against the DB in the handler.
export const updateInterestsSchema = z.object({
  interests: z
    .array(z.string().trim().min(1))
    .transform((values) => [
      ...new Set(values.map((value) => LEGACY_INTEREST_IDS[value] ?? value)),
    ]),
})
