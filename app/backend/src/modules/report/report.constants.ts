import type { TorCategory } from '../tor/tor.controller.js'

export const REPORT_DEPARTMENTS = [
  'สำนักการโยธา กทม.',
  'สำนักการแพทย์ กทม.',
  'สำนักป้องกันและบรรเทาสาธารณภัย',
  'สำนักงานเลขานุการปลัด กทม.',
  'สำนักยุทธศาสตร์และประเมินผล',
  'สำนักงานประชาสัมพันธ์ กทม.',
] as const

export type ReportDepartment = (typeof REPORT_DEPARTMENTS)[number]

export const REPORT_CATEGORY_LABELS: Record<TorCategory, string> = {
  consulting_architecture: 'Consulting / Architecture',
  data_bi: 'Data / BI',
  web_application: 'Web Application',
  mobile_app: 'Mobile App',
  enterprise_system: 'Enterprise System',
}

// Fixed display order for endpoint 1, which must always emit all 5 categories.
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
