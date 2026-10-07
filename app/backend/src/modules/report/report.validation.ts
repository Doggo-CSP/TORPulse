import { z } from 'zod'

import {
  PROCUREMENT_LIST_SORT_FIELDS,
  REPORT_PERIODS,
  SAVINGS_BUCKET_KEYS,
} from './report.constants.js'

// Filters shared by every report endpoint. Category is a key or a display name; it is checked
// against the categories collection in the handler.
export const reportFilterQuerySchema = z.object({
  period: z.enum(REPORT_PERIODS).optional().default('all'),
  category: z.string().trim().min(1).optional(),
  department: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  savings_bucket: z.enum(SAVINGS_BUCKET_KEYS).optional(),
})

export const procurementListQuerySchema = reportFilterQuerySchema.extend({
  page: z.coerce.number().int().min(1).optional().default(1),
  page_size: z.coerce.number().int().min(1).max(100).optional().default(10),
  sort_by: z.enum(PROCUREMENT_LIST_SORT_FIELDS).optional().default('announceDate'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
})

export const similarQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(5),
})
