import { isObjectIdOrHexString } from 'mongoose'
import { z } from 'zod'

import { CATEGORY_KEYS } from '../category/category.constants.js'
import { TOR_REVIEW_STATUSES } from '../tor/tor.model.js'
import { ACTIVITY_GROUPS } from './admin.types.js'

const stringList = z.array(z.string().trim().min(1))

export const adminTorListQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z
    .enum([...TOR_REVIEW_STATUSES, 'all'])
    .optional()
    .default('all'),
  category: z.enum(CATEGORY_KEYS).optional(),
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
    category: z.enum(CATEGORY_KEYS).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0)

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  group: z.enum(ACTIVITY_GROUPS).optional(),
})

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
// TODO(QUESTION-6): confirm the field-name mapping and whether 'personal' stays; see QUESTIONS.md
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
