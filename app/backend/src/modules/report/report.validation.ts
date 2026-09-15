import { z } from 'zod'

import { REPORT_CATEGORY_LABELS, REPORT_DEPARTMENTS, REPORT_PERIODS } from './report.constants.js'

const categoryLabelValues = Object.values(REPORT_CATEGORY_LABELS) as [string, ...string[]]

export const procurementComparisonQuerySchema = z.object({
  period: z.enum(REPORT_PERIODS).optional().default('all'),
  category: z.enum(categoryLabelValues).optional(),
  department: z.enum(REPORT_DEPARTMENTS).optional(),
  budget_min: z.coerce.number().min(0).optional(),
  budget_max: z.coerce.number().min(0).optional(),
})

export const priceOverviewQuerySchema = z.object({
  period: z.enum(REPORT_PERIODS).optional().default('all'),
  category: z.enum(categoryLabelValues).optional(),
  department: z.enum(REPORT_DEPARTMENTS).optional(),
})

export const categoryPriceHistoryQuerySchema = z.object({
  period: z.enum(REPORT_PERIODS).optional().default('all'),
})
