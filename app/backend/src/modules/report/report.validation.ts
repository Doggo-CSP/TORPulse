import { z } from 'zod'

import {
  PROCUREMENT_LIST_SORT_FIELDS,
  REPORT_CATEGORY_LABELS,
  REPORT_PERIODS,
} from './report.constants.js'

const categoryLabelValues = Object.values(REPORT_CATEGORY_LABELS) as [string, ...string[]]

export const priceOverviewQuerySchema = z.object({
  period: z.enum(REPORT_PERIODS).optional().default('all'),
  category: z.enum(categoryLabelValues).optional(),
  agencyName: z.string().min(1).optional(),
})

export const savingsDistributionQuerySchema = priceOverviewQuerySchema

export const categoryComparisonQuerySchema = z.object({
  period: z.enum(REPORT_PERIODS).optional().default('all'),
  agencyName: z.string().min(1).optional(),
})

export const procurementListQuerySchema = z.object({
  period: z.enum(REPORT_PERIODS).optional().default('all'),
  category: z.enum(categoryLabelValues).optional(),
  agencyName: z.string().min(1).optional(),
  budget_min: z.coerce.number().min(0).optional(),
  budget_max: z.coerce.number().min(0).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  page_size: z.coerce.number().int().min(1).max(100).optional().default(8),
  sort_by: z.enum(PROCUREMENT_LIST_SORT_FIELDS).optional().default('savings_amount'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
})
