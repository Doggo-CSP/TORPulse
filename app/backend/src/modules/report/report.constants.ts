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
  key: SavingsBucketKey
  label: string
  // Savings % range: min inclusive, max exclusive
  min?: number
  max?: number
}

export const SAVINGS_BUCKET_KEYS = ['over', 'lt5', '5to10', '10to15', 'gt15'] as const
export type SavingsBucketKey = (typeof SAVINGS_BUCKET_KEYS)[number]

// Savings % = (mid - awarded) / mid. A negative value means the winning bid was above the
// reference price, which does happen, so it gets its own bucket.
export const SAVINGS_BUCKETS: SavingsBucket[] = [
  { key: 'over', label: 'สูงกว่าราคากลาง', max: 0 },
  { key: 'lt5', label: 'ประหยัด 0% - 5%', min: 0, max: 5 },
  { key: '5to10', label: 'ประหยัด 5% - 10%', min: 5, max: 10 },
  { key: '10to15', label: 'ประหยัด 10% - 15%', min: 10, max: 15 },
  { key: 'gt15', label: 'ประหยัดสูง > 15%', min: 15 },
]

export const PROCUREMENT_LIST_SORT_FIELDS = [
  'projectTitle',
  'midPriceBaht',
  'awardedPriceBaht',
  'savings_amount',
  'savings_pct',
  'announceDate',
] as const
export type ProcurementListSortField = (typeof PROCUREMENT_LIST_SORT_FIELDS)[number]
