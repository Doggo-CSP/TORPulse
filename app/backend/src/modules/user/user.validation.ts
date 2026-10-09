import { z } from 'zod'

import { LEGACY_INTEREST_IDS } from '../category/category.constants.js'

const optionalNumber = (schema: z.ZodNumber) => schema.nullable().optional()

export const pastProjectSchema = z.object({
  name: z.string().trim().max(200),
  client: z.string().trim().max(200),
  valueBaht: z.number().nonnegative().nullable(),
  year: z.number().int().min(2400).max(2700).nullable(), // พ.ศ.
})

export const updateProfileSchema = z
  .object({
    accountType: z.enum(['personal', 'company', 'agency']).optional(),
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
    registrationNumber: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d{13}$/.test(v), 'ต้องเป็นตัวเลข 13 หลัก')
      .optional(),
    businessType: z.string().trim().optional(),
    agencyName: z.string().trim().optional(),
    agencyType: z.string().trim().optional(),
    website: z.string().trim().optional(),

    // ── company profile (used by qualification matching) ──
    registeredDate: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'รูปแบบวันที่ไม่ถูกต้อง')
      .optional(),
    registeredCapital: optionalNumber(z.number().nonnegative()),
    yearsExperience: optionalNumber(z.number().int().min(0).max(200)),
    teamSize: optionalNumber(z.number().int().min(0)),
    budgetMin: optionalNumber(z.number().nonnegative()),
    budgetMax: optionalNumber(z.number().nonnegative()),
    businessObjectives: z.string().trim().max(2000).optional(),
    certifications: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
    isEgpRegistered: z.boolean().optional(),
    pastProjects: z.array(pastProjectSchema).max(20).optional(),
  })
  .refine(
    (v) => v.budgetMin == null || v.budgetMax == null || v.budgetMin <= v.budgetMax,
    { message: 'budgetMin must not exceed budgetMax', path: ['budgetMin'] },
  )

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
