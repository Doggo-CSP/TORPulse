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

// Positive validation for profile input (ASVS V2.2.1): every field has a length limit, and
// fields with a known format must match it. An empty string clears the field.
const text = (max: number) => z.string().trim().max(max)

// Only http(s) links are stored, so a saved value can never become a javascript: or data: URL
// when it is rendered. A bare domain ("example.com") is stored as https://example.com.
const webUrl = z
  .string()
  .trim()
  .max(2048)
  .transform((value) => (value && !/^[a-z][a-z0-9+.-]*:/i.test(value) ? `https://${value}` : value))
  .refine((value) => {
    if (value === '') return true
    try {
      const url = new URL(value)
      return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.')
    } catch {
      return false
    }
  }, 'Must be an http(s) URL')

export const updateProfileSchema = z.object({
  accountType: z.enum(['personal', 'company']).optional(),
  displayName: text(100).optional(),
  firstName: text(100).optional(),
  lastName: text(100).optional(),
  jobTitle: text(100).optional(),
  contactEmail: z
    .string()
    .trim()
    .max(254)
    .refine((value) => value === '' || z.email().safeParse(value).success, 'Invalid email')
    .optional(),
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || /^[0-9+()\-\s]{6,30}$/.test(value), 'Invalid phone number')
    .optional(),
  image: webUrl.optional(),
  address: text(500).optional(),
  about: text(2000).optional(),
  companyName: text(200).optional(),
  // Thai juristic person registration numbers are 13 digits; dashes and spaces are allowed
  registrationNumber: z
    .string()
    .trim()
    .refine((value) => /^[0-9A-Za-z\-\s]{0,30}$/.test(value), 'Invalid registration number')
    .optional(),
  businessType: text(100).optional(),
  website: webUrl.optional(),
  qualification: qualificationSchema.optional(),
  notificationPrefs: z.object({ emailEnabled: z.boolean() }).optional(),
})

// TODO(LEGACY-INTEREST-IDS): also accepts the profile page's old ids ("web", "ai", ...) and
// converts them to category keys before saving; drop the legacy ids once the frontend is fixed.
// Whether each key is an active category is checked against the DB in the handler.
export const updateOnboardingSchema = z.object({
  status: z.enum(['completed', 'dismissed']),
})

export const updateInterestsSchema = z.object({
  interests: z
    .array(z.string().trim().min(1).max(100))
    .max(50)
    .transform((values) => [
      ...new Set(values.map((value) => LEGACY_INTEREST_IDS[value] ?? value)),
    ]),
})
