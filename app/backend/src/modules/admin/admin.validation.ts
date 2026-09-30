import { isObjectIdOrHexString } from 'mongoose'
import { z } from 'zod'

import { CATEGORY_LABELS } from '../tor/tor.controller.js'
import { TOR_REVIEW_STATUSES } from '../tor/tor.model.js'

const categoryKeys = Object.keys(CATEGORY_LABELS) as [string, ...string[]]

const stringList = z.array(z.string().trim().min(1))

export const adminTorListQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z
    .enum([...TOR_REVIEW_STATUSES, 'all'])
    .optional()
    .default('all'),
  category: z.enum(categoryKeys).optional(),
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
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0)
