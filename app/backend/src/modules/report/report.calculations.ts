import type { FinishedTor } from './finished-tors.js'
import {
  SAVINGS_BUCKETS,
  type ProcurementListSortField,
  type SavingsBucketKey,
} from './report.constants.js'

// Pure report maths over finished projects (no database access), so it can be unit tested
// with plain arrays. Money is in baht; percentages are rounded to 1 decimal place.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const round1 = (value: number): number => Math.round(value * 10) / 10
const roundBaht = (value: number): number => Math.round(value)

export const savingsBaht = (tor: Pick<FinishedTor, 'midPriceBaht' | 'awardedPriceBaht'>) =>
  tor.midPriceBaht - tor.awardedPriceBaht

// Negative when the winning bid was above the reference (mid) price.
export const savingsPct = (tor: Pick<FinishedTor, 'midPriceBaht' | 'awardedPriceBaht'>) =>
  ((tor.midPriceBaht - tor.awardedPriceBaht) / tor.midPriceBaht) * 100

// Date a project is placed on the calendar by: its announcement, else its submission deadline
// (BMA TORs have no announce date), else when it was analysed.
export const reportDateOf = (
  tor: Pick<FinishedTor, 'announceDate' | 'analyzedAt'> &
    Partial<Pick<FinishedTor, 'submissionDeadlineAt'>>,
) => tor.announceDate ?? tor.submissionDeadlineAt ?? tor.analyzedAt

export function savingsBucketOf(pct: number): SavingsBucketKey {
  const bucket = SAVINGS_BUCKETS.find(
    (b) => (b.min === undefined || pct >= b.min) && (b.max === undefined || pct < b.max),
  )
  return (bucket ?? SAVINGS_BUCKETS[SAVINGS_BUCKETS.length - 1]!).key
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

// ---------------------------------------------------------------------------
// Hidden categories
// ---------------------------------------------------------------------------

// A hidden category is a soft delete for users: it is never shown, filtered on or matched,
// and comes back as soon as an admin shows it again. The TOR keeps its stored category; only
// what users see changes. `visible` is the set of active category keys.
export function withVisibleCategories<T extends Pick<FinishedTor, 'category' | 'categories'>>(
  tor: T,
  visible: ReadonlySet<string>,
): T {
  return {
    ...tor,
    category: tor.category !== null && visible.has(tor.category) ? tor.category : null,
    categories: tor.categories.filter((key) => visible.has(key)),
  }
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface FinishedTorFilters {
  // Projects whose report date is on or after this
  cutoff?: Date | null
  // Resolved primary category key
  category?: string
  departmentName?: string
  // Case-insensitive match on the project title or external id
  q?: string
  savingsBucket?: SavingsBucketKey
}

export function filterFinishedTors(items: FinishedTor[], filters: FinishedTorFilters) {
  const q = filters.q?.trim().toLowerCase()
  return items.filter((tor) => {
    if (filters.cutoff) {
      const date = reportDateOf(tor)
      if (!date || date < filters.cutoff) return false
    }
    if (filters.category && tor.category !== filters.category) return false
    if (filters.departmentName && tor.departmentName !== filters.departmentName) return false
    if (
      q &&
      !tor.projectTitle.toLowerCase().includes(q) &&
      !tor.externalId.toLowerCase().includes(q)
    ) {
      return false
    }
    if (filters.savingsBucket && savingsBucketOf(savingsPct(tor)) !== filters.savingsBucket) {
      return false
    }
    return true
  })
}

// ---------------------------------------------------------------------------
// GET /reports/price-overview
// ---------------------------------------------------------------------------

export function priceOverview(items: FinishedTor[]) {
  const count = items.length
  const totalMid = sum(items.map((t) => t.midPriceBaht))
  const totalAwarded = sum(items.map((t) => t.awardedPriceBaht))
  const totalSavings = totalMid - totalAwarded
  const belowReference = items.filter((t) => t.awardedPriceBaht < t.midPriceBaht)
  const pcts = items.map(savingsPct)

  return {
    project_count: count,
    total_mid_price_baht: roundBaht(totalMid),
    total_awarded_price_baht: roundBaht(totalAwarded),
    total_savings_baht: roundBaht(totalSavings),
    // Weighted by money: total savings over total reference price
    overall_savings_pct: totalMid === 0 ? null : round1((totalSavings / totalMid) * 100),
    avg_mid_price_baht: count === 0 ? null : roundBaht(totalMid / count),
    avg_awarded_price_baht: count === 0 ? null : roundBaht(totalAwarded / count),
    avg_savings_baht: count === 0 ? null : roundBaht(totalSavings / count),
    median_savings_pct: count === 0 ? null : round1(median(pcts)!),
    pct_projects_below_reference:
      count === 0 ? null : round1((belowReference.length / count) * 100),
    max_savings_pct: count === 0 ? null : round1(Math.max(...pcts)),
  }
}

// ---------------------------------------------------------------------------
// GET /reports/savings-distribution
// ---------------------------------------------------------------------------

export function savingsDistribution(items: FinishedTor[]) {
  const counts = new Map<SavingsBucketKey, number>()
  for (const tor of items) {
    const key = savingsBucketOf(savingsPct(tor))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return {
    total_projects: items.length,
    buckets: SAVINGS_BUCKETS.map((bucket) => {
      const count = counts.get(bucket.key) ?? 0
      return {
        key: bucket.key,
        label: bucket.label,
        count,
        pct: items.length === 0 ? 0 : round1((count / items.length) * 100),
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// GET /reports/category-comparison (also the homepage price chart)
// ---------------------------------------------------------------------------

export interface CategoryInfo {
  key: string
  name: string
  isActive: boolean
}

// Every active category in display order, empty ones included. Hidden categories are left out
// (soft delete), and so are projects whose primary category is hidden or unknown.
export function categoryComparison(items: FinishedTor[], categories: CategoryInfo[]) {
  const groups = new Map<string, FinishedTor[]>()
  for (const tor of items) {
    if (tor.category === null) continue
    const group = groups.get(tor.category)
    if (group) group.push(tor)
    else groups.set(tor.category, [tor])
  }

  const names = new Map(categories.map((c) => [c.key, c.name]))
  const keys = categories.filter((c) => c.isActive).map((c) => c.key)

  return keys.map((key) => {
    const group = groups.get(key) ?? []
    const count = group.length
    const totalMid = sum(group.map((t) => t.midPriceBaht))
    const totalAwarded = sum(group.map((t) => t.awardedPriceBaht))
    return {
      category: key,
      category_label: names.get(key) ?? key,
      project_count: count,
      total_mid_price_baht: roundBaht(totalMid),
      total_awarded_price_baht: roundBaht(totalAwarded),
      avg_mid_price_baht: count === 0 ? null : roundBaht(totalMid / count),
      avg_awarded_price_baht: count === 0 ? null : roundBaht(totalAwarded / count),
      avg_savings_pct: count === 0 ? null : round1(sum(group.map(savingsPct)) / count),
    }
  })
}

// ---------------------------------------------------------------------------
// GET /reports/timeline
// ---------------------------------------------------------------------------

const bangkokMonth = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
  }).format(date)

// One point per calendar month (Bangkok time) of the report date, oldest first.
export function monthlyTimeline(items: FinishedTor[]) {
  const months = new Map<string, FinishedTor[]>()
  for (const tor of items) {
    const date = reportDateOf(tor)
    if (!date) continue
    const month = bangkokMonth(date)
    const group = months.get(month)
    if (group) group.push(tor)
    else months.set(month, [tor])
  }

  return [...months.keys()].sort().map((month) => {
    const group = months.get(month)!
    const totalMid = sum(group.map((t) => t.midPriceBaht))
    const totalAwarded = sum(group.map((t) => t.awardedPriceBaht))
    return {
      month,
      project_count: group.length,
      total_mid_price_baht: roundBaht(totalMid),
      total_awarded_price_baht: roundBaht(totalAwarded),
      total_savings_baht: roundBaht(totalMid - totalAwarded),
      avg_savings_pct: round1(sum(group.map(savingsPct)) / group.length),
    }
  })
}

// ---------------------------------------------------------------------------
// GET /reports/procurement-list
// ---------------------------------------------------------------------------

export interface ProcurementListOptions {
  sortBy: ProcurementListSortField
  sortOrder: 'asc' | 'desc'
  page: number
  pageSize: number
}

export function procurementList(
  items: FinishedTor[],
  options: ProcurementListOptions,
  categoryNames: Map<string, string>,
) {
  const rows = items.map((tor) => ({
    tor_id: tor.id,
    external_id: tor.externalId,
    project_title: tor.projectTitle,
    department_name: tor.departmentName,
    agency_name: tor.agencyName,
    // null when the category is hidden (categoryNames holds active categories only)
    category: tor.category !== null && categoryNames.has(tor.category) ? tor.category : null,
    category_label: tor.category !== null ? (categoryNames.get(tor.category) ?? null) : null,
    announce_date: reportDateOf(tor)?.toISOString() ?? null,
    budget_baht: tor.budgetBaht,
    mid_price_baht: tor.midPriceBaht,
    awarded_price_baht: tor.awardedPriceBaht,
    // Mock until ingestion stores real awarded prices (see finished-tors.ts)
    awarded_is_mock: tor.awardedIsMock,
    savings_amount_baht: roundBaht(savingsBaht(tor)),
    savings_pct: round1(savingsPct(tor)),
    detail_url: tor.detailUrl,
  }))

  const value = (row: (typeof rows)[number]): number | string => {
    switch (options.sortBy) {
      case 'projectTitle':
        return row.project_title
      case 'midPriceBaht':
        return row.mid_price_baht
      case 'awardedPriceBaht':
        return row.awarded_price_baht
      case 'savings_amount':
        return row.savings_amount_baht
      case 'savings_pct':
        return row.savings_pct
      case 'announceDate':
        return row.announce_date ?? ''
    }
  }
  const direction = options.sortOrder === 'asc' ? 1 : -1
  rows.sort((a, b) => {
    const left = value(a)
    const right = value(b)
    const cmp =
      typeof left === 'string' && typeof right === 'string'
        ? left.localeCompare(right, 'th')
        : (left as number) - (right as number)
    return direction * cmp || a.external_id.localeCompare(b.external_id)
  })

  const totalCount = rows.length
  const start = (options.page - 1) * options.pageSize
  return {
    total_count: totalCount,
    page: options.page,
    page_size: options.pageSize,
    total_pages: totalCount === 0 ? 0 : Math.ceil(totalCount / options.pageSize),
    items: rows.slice(start, start + options.pageSize),
  }
}

// ---------------------------------------------------------------------------
// GET /tors/:id/similar (UC-05)
// ---------------------------------------------------------------------------

export interface SimilarityTarget {
  externalId: string
  category: string | null
  categories: string[]
  technologies: string[]
}

const SAME_PRIMARY_CATEGORY_SCORE = 3
const MAX_TECHNOLOGY_SCORE = 3

const normalizeTech = (tech: string) => tech.trim().toLowerCase()

// What a candidate needs to be compared: any TOR with a mid price, open for bids or not.
export type SimilarCandidate = Pick<
  FinishedTor,
  | 'externalId'
  | 'category'
  | 'categories'
  | 'technologies'
  | 'midPriceBaht'
  | 'announceDate'
  | 'analyzedAt'
  | 'submissionDeadlineAt'
>

// Score = 3 for the same primary category, +1 per other shared category, +1 per shared
// technology (at most 3). A project must share at least one category to count as similar.
export function scoreSimilarity(target: SimilarityTarget, candidate: SimilarCandidate) {
  const targetCategories = new Set(
    target.categories.length ? target.categories : target.category ? [target.category] : [],
  )
  const candidateCategories = new Set(candidate.categories)
  const matchedCategories = [...targetCategories].filter((key) => candidateCategories.has(key))
  if (matchedCategories.length === 0) return null

  const samePrimary = target.category !== null && target.category === candidate.category
  const targetTech = new Set(target.technologies.map(normalizeTech))
  const matchedTechnologies = candidate.technologies.filter((tech) =>
    targetTech.has(normalizeTech(tech)),
  )

  const score =
    (samePrimary ? SAME_PRIMARY_CATEGORY_SCORE : 0) +
    matchedCategories.filter((key) => !(samePrimary && key === target.category)).length +
    Math.min(matchedTechnologies.length, MAX_TECHNOLOGY_SCORE)

  return { score, matchedCategories, matchedTechnologies }
}

// How far a project's mid price is from the TOR's size, as a ratio on a log scale
// (0 = same size; 2x bigger and 2x smaller count the same).
const sizeDistance = (tor: SimilarCandidate, sizeBaht: number | null | undefined) =>
  sizeBaht ? Math.abs(Math.log(tor.midPriceBaht / sizeBaht)) : 0

// The most similar projects, best first; the TOR itself is never its own match. Equal scores go
// to the project closest in size to the TOR (its mid price, else its budget), then the newest.
export function findSimilarProjects<T extends SimilarCandidate>(
  target: SimilarityTarget & { midPriceBaht?: number | null; budgetBaht?: number | null },
  items: T[],
  limit = 5,
) {
  const sizeBaht = target.midPriceBaht ?? target.budgetBaht
  return items
    .filter((tor) => tor.externalId !== target.externalId)
    .map((tor) => ({ tor, match: scoreSimilarity(target, tor) }))
    .filter(
      (entry): entry is { tor: T; match: NonNullable<ReturnType<typeof scoreSimilarity>> } =>
        entry.match !== null,
    )
    .sort(
      (a, b) =>
        b.match.score - a.match.score ||
        sizeDistance(a.tor, sizeBaht) - sizeDistance(b.tor, sizeBaht) ||
        (reportDateOf(b.tor)?.getTime() ?? 0) - (reportDateOf(a.tor)?.getTime() ?? 0),
    )
    .slice(0, limit)
}

// A similar project's mid price against this TOR's mid price, in % of this TOR's.
// Negative: the similar project's mid price is lower. null when this TOR has no mid price.
export function midPriceDiffPct(
  projectMidPriceBaht: number,
  targetMidPriceBaht: number | null,
): number | null {
  if (!targetMidPriceBaht) return null
  return round1(((projectMidPriceBaht - targetMidPriceBaht) / targetMidPriceBaht) * 100)
}

// How this TOR's mid price compares with the mid prices of similar projects.
export function summarizeSimilar(
  projects: Pick<SimilarCandidate, 'midPriceBaht'>[],
  targetMidPriceBaht: number | null,
) {
  const mids = projects.map((t) => t.midPriceBaht)
  const medianMid = median(mids)
  return {
    project_count: projects.length,
    target_mid_price_baht: targetMidPriceBaht === null ? null : roundBaht(targetMidPriceBaht),
    median_mid_price_baht: medianMid === null ? null : roundBaht(medianMid),
    min_mid_price_baht: mids.length === 0 ? null : roundBaht(Math.min(...mids)),
    max_mid_price_baht: mids.length === 0 ? null : roundBaht(Math.max(...mids)),
    // Positive: this TOR's mid price is above the median mid price of similar projects
    target_vs_median_mid_pct:
      targetMidPriceBaht === null || !medianMid
        ? null
        : round1(((targetMidPriceBaht - medianMid) / medianMid) * 100),
  }
}
