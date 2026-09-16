import { CATEGORY_LABELS, type TorCategory } from '../tor/tor.controller.js'

export const UNKNOWN_DEPARTMENT_LABEL = 'อื่นๆ'

export const REPORT_CATEGORY_LABELS = CATEGORY_LABELS

// Fixed display order for endpoint C, which must always emit all 5 categories.
export const REPORT_CATEGORY_ORDER: TorCategory[] = [
  'consulting_architecture',
  'data_bi',
  'web_application',
  'mobile_app',
  'enterprise_system',
]

export const CATEGORY_LABEL_TO_KEY: Record<string, TorCategory> = Object.fromEntries(
  (Object.entries(REPORT_CATEGORY_LABELS) as [TorCategory, string][]).map(([key, label]) => [
    label,
    key,
  ]),
)

export const REPORT_PERIODS = ['6m', '1y', '3y', 'all'] as const
export type ReportPeriod = (typeof REPORT_PERIODS)[number]

export function periodToCutoff(period: ReportPeriod, now: Date = new Date()): Date | null {
  if (period === 'all') return null

  const cutoff = new Date(now)
  if (period === '6m') cutoff.setMonth(cutoff.getMonth() - 6)
  if (period === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1)
  if (period === '3y') cutoff.setFullYear(cutoff.getFullYear() - 3)
  return cutoff
}

export interface SavingsBucket {
  label: string
  min?: number
  max?: number
}

export const SAVINGS_BUCKETS: SavingsBucket[] = [
  { label: 'ประหยัด < 5%', max: 5 },
  { label: 'ประหยัด 5% - 10%', min: 5, max: 10 },
  { label: 'ประหยัด 10% - 15%', min: 10, max: 15 },
  { label: 'ประหยัดสูง > 15%', min: 15 },
]

export const PROCUREMENT_LIST_SORT_FIELDS = [
  'projectTitle',
  'midPriceBaht',
  'awardedPriceBaht',
  'savings_amount',
  'savings_pct',
] as const
export type ProcurementListSortField = (typeof PROCUREMENT_LIST_SORT_FIELDS)[number]
