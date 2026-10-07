import { isObjectIdOrHexString } from 'mongoose'
import { z } from 'zod'

import { TOR_REVIEW_STATUSES } from '../tor/tor.model.js'
import { ACTIVITY_GROUPS } from './admin.types.js'

const stringList = z.array(z.string().trim().min(1))

export const adminTorListQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z
    .enum([...TOR_REVIEW_STATUSES, 'all'])
    .optional()
    .default('all'),
  category: z.string().trim().min(1).optional(),
  confidence_min: z.coerce.number().min(0).max(1).optional(),
  confidence_max: z.coerce.number().min(0).max(1).optional(),
  data_source_id: z
    .string()
    .refine((value) => isObjectIdOrHexString(value))
    .optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  page_size: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// Only extracted fields are editable; source traceability fields (detailUrl, documents,
// externalId, dataSourceId, ...) are rejected by .strict().
export const updateAdminTorSchema = z
  .object({
    budgetBaht: z.number().min(0).nullable().optional(),
    scope: z.string().trim().nullable().optional(),
    technologies: stringList.optional(),
    bidderQualifications: stringList.optional(),
    deliverables: stringList.optional(),
    timeline: stringList.optional(),
    evaluationCriteria: stringList.optional(),
    // Must be an active category; checked against the DB in the handler
    category: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0)

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  group: z.enum(ACTIVITY_GROUPS).optional(),
})

export const updateDataSourceSchema = z.object({ enabled: z.boolean() }).strict()

// ingestionIntervalMinutes is read-only (it comes from the scheduler's env), so it is not here.
export const updateSettingsSchema = z
  .object({
    ingestionEnabled: z.boolean().optional(),
    senderEmail: z.email().nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0)

// Profile fields an admin may fix. Uses the existing User field names:
// organization -> agencyName / companyName, position -> jobTitle, government -> 'agency'.
// email, role and status are rejected here (role/status have their own endpoints).
export const updateAdminUserSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    jobTitle: z.string().trim().optional(),
    agencyName: z.string().trim().optional(),
    companyName: z.string().trim().optional(),
    accountType: z.enum(['personal', 'company', 'agency']).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0)

// Categories: the key is optional on create (generated from the name when missing) and can
// never change afterwards, so the update schema rejects it via .strict().
const categoryFields = {
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500),
  keywords: z.array(z.string()),
  // Extra guidance for the AI classifier; an empty string clears it.
  aiHint: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .transform((value) => value || null),
}

export const createCategorySchema = z
  .object({
    key: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]+$/)
      .max(50)
      .optional(),
    name: categoryFields.name,
    description: categoryFields.description.optional(),
    keywords: categoryFields.keywords.optional(),
    aiHint: categoryFields.aiHint.optional(),
  })
  .strict()

export const updateCategorySchema = z
  .object({
    name: categoryFields.name.optional(),
    description: categoryFields.description.optional(),
    keywords: categoryFields.keywords.optional(),
    aiHint: categoryFields.aiHint.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0)

export const categoryStatusSchema = z.object({ isActive: z.boolean() }).strict()

export const adminCategoryListQuerySchema = z.object({
  search: z.string().trim().optional(),
})
