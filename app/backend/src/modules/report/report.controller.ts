import type { Request, Response } from 'express'

import { getCategoryNameMap, listCategories } from '../category/category.repository.js'
import { resolveTorCategory } from '../tor/tor.controller.js'
import { PUBLIC_TOR_FILTER, TorModel } from '../tor/tor.model.js'
import {
  SAVINGS_BUCKETS,
  periodToCutoff,
  type ProcurementListSortField,
  type ReportPeriod,
} from './report.constants.js'
import {
  agencyNameMatchForDepartment,
  getKnownDepartments,
  isKnownDepartment,
} from './report.department-cache.js'
import {
  categoryComparisonQuerySchema,
  priceOverviewQuerySchema,
  procurementListQuerySchema,
  savingsDistributionQuerySchema,
} from './report.validation.js'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface PricedProjectLean {
  referencePriceBaht: number
  winningPriceBaht: number
  technologies: string[]
  category: string | null
}

function toMillionRound2(baht: number): number {
  return Math.round((baht / 1_000_000) * 100) / 100
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function savingsPct(referencePriceBaht: number, winningPriceBaht: number): number {
  return ((referencePriceBaht - winningPriceBaht) / referencePriceBaht) * 100
}

function baseMatch(cutoff: Date | null, agencyName?: string): Record<string, unknown> {
  const match: Record<string, unknown> = { ...PUBLIC_TOR_FILTER, awardedPriceBaht: { $ne: null } }
  if (cutoff) match.analyzedAt = { $gte: cutoff }
  if (agencyName) Object.assign(match, agencyNameMatchForDepartment(agencyName))
  return match
}

async function validateAgencyName(agencyName: string | undefined, res: Response): Promise<boolean> {
  if (!agencyName) return true
  if (await isKnownDepartment(agencyName)) return true
  res.status(400).json({ message: 'Invalid agencyName' })
  return false
}

// The category filter is a key or a display name (case-insensitive); returns its key, or null
// after answering 400 when no category matches. Hidden categories still match so old reports keep
// working.
async function resolveCategoryFilter(
  category: string | undefined,
  res: Response,
): Promise<string | undefined | null> {
  if (!category) return undefined
  const wanted = category.toLowerCase()
  const names = await getCategoryNameMap()
  for (const [key, name] of names) {
    if (key === wanted || name.toLowerCase() === wanted) return key
  }
  res.status(400).json({ message: 'Invalid query parameters' })
  return null
}

function filterByCategory<T extends { technologies: string[]; category: string | null }>(
  projects: T[],
  category: string | undefined,
): T[] {
  if (!category) return projects
  return projects.filter((p) => resolveTorCategory(p) === category)
}

function groupByCategory<T extends { technologies: string[]; category: string | null }>(
  projects: T[],
): Map<string, T[]> {
  const byCategory = new Map<string, T[]>()
  for (const project of projects) {
    const category = resolveTorCategory(project)
    const bucket = byCategory.get(category)
    if (bucket) {
      bucket.push(project)
    } else {
      byCategory.set(category, [project])
    }
  }
  return byCategory
}

// ---------------------------------------------------------------------------
// GET /api/v1/reports/price-overview
// ---------------------------------------------------------------------------

export async function priceOverviewHandler(req: Request, res: Response): Promise<void> {
  const parsed = priceOverviewQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query parameters' })
    return
  }
  const { period, category, agencyName } = parsed.data
  if (!(await validateAgencyName(agencyName, res))) return
  const categoryKey = await resolveCategoryFilter(category, res)
  if (categoryKey === null) return

  const cutoff = periodToCutoff(period as ReportPeriod)
  const match = baseMatch(cutoff, agencyName)

  const rawProjects = await TorModel.find(match, {
    midPriceBaht: 1,
    awardedPriceBaht: 1,
    technologies: 1,
    category: 1,
  }).lean()

  const projects: PricedProjectLean[] = filterByCategory(
    rawProjects.map((p) => ({
      referencePriceBaht: p.midPriceBaht!,
      winningPriceBaht: p.awardedPriceBaht!,
      technologies: p.technologies ?? [],
      category: p.category ?? null,
    })),
    categoryKey,
  )

  const projectCount = projects.length
  const totalMid = projects.reduce((sum, p) => sum + p.referencePriceBaht, 0)
  const totalAwarded = projects.reduce((sum, p) => sum + p.winningPriceBaht, 0)
  const totalSavingsRaw = totalMid - totalAwarded

  const belowReference = projects.filter((p) => p.winningPriceBaht < p.referencePriceBaht)

  res.json({
    success: true,
    data: {
      total_mid_price: toMillionRound2(totalMid),
      total_awarded_price: toMillionRound2(totalAwarded),
      avg_mid_price: projectCount === 0 ? null : toMillionRound2(totalMid / projectCount),
      project_count: projectCount,

      total_savings: toMillionRound2(totalSavingsRaw),
      overall_savings_pct: totalMid === 0 ? null : round1((totalSavingsRaw / totalMid) * 100),
      avg_savings_baht: projectCount === 0 ? null : toMillionRound2(totalSavingsRaw / projectCount),

      pct_projects_below_reference:
        projectCount === 0 ? null : round1((belowReference.length / projectCount) * 100),
      max_savings_pct:
        belowReference.length === 0
          ? null
          : round1(
              Math.max(
                ...belowReference.map((p) => savingsPct(p.referencePriceBaht, p.winningPriceBaht)),
              ),
            ),
    },
  })
}

// ---------------------------------------------------------------------------
// GET /api/v1/reports/savings-distribution
// ---------------------------------------------------------------------------

export async function savingsDistributionHandler(req: Request, res: Response): Promise<void> {
  const parsed = savingsDistributionQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query parameters' })
    return
  }
  const { period, category, agencyName } = parsed.data
  if (!(await validateAgencyName(agencyName, res))) return
  const categoryKey = await resolveCategoryFilter(category, res)
  if (categoryKey === null) return

  const cutoff = periodToCutoff(period as ReportPeriod)
  const match = baseMatch(cutoff, agencyName)

  const rawProjects = await TorModel.find(match, {
    midPriceBaht: 1,
    awardedPriceBaht: 1,
    technologies: 1,
    category: 1,
  }).lean()

  const projects: PricedProjectLean[] = filterByCategory(
    rawProjects.map((p) => ({
      referencePriceBaht: p.midPriceBaht!,
      winningPriceBaht: p.awardedPriceBaht!,
      technologies: p.technologies ?? [],
      category: p.category ?? null,
    })),
    categoryKey,
  )

  const totalProjects = projects.length
  const counts = SAVINGS_BUCKETS.map(() => 0)

  for (const project of projects) {
    const pct = savingsPct(project.referencePriceBaht, project.winningPriceBaht)
    const index = SAVINGS_BUCKETS.findIndex((bucket) => {
      if (bucket.min !== undefined && pct < bucket.min) return false
      if (bucket.max !== undefined && pct >= bucket.max) return false
      return true
    })
    if (index !== -1) counts[index]!++
  }

  res.json({
    success: true,
    data: {
      total_projects: totalProjects,
      buckets: SAVINGS_BUCKETS.map((bucket, index) => ({
        label: bucket.label,
        count: counts[index]!,
        pct: totalProjects === 0 ? 0 : round1((counts[index]! / totalProjects) * 100),
      })),
    },
  })
}

// ---------------------------------------------------------------------------
// GET /api/v1/reports/category-comparison
// ---------------------------------------------------------------------------

export async function categoryComparisonHandler(req: Request, res: Response): Promise<void> {
  const parsed = categoryComparisonQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query parameters' })
    return
  }
  const { period, agencyName } = parsed.data
  if (!(await validateAgencyName(agencyName, res))) return

  const cutoff = periodToCutoff(period as ReportPeriod)
  const match = baseMatch(cutoff, agencyName)

  const [rawProjects, allCategories] = await Promise.all([
    TorModel.find(match, {
      midPriceBaht: 1,
      awardedPriceBaht: 1,
      technologies: 1,
      category: 1,
    }).lean(),
    listCategories(),
  ])

  const projects: PricedProjectLean[] = rawProjects.map((p) => ({
    referencePriceBaht: p.midPriceBaht!,
    winningPriceBaht: p.awardedPriceBaht!,
    technologies: p.technologies ?? [],
    category: p.category ?? null,
  }))

  const byCategory = groupByCategory(projects)
  const names = new Map(allCategories.map((category) => [category.key, category.name]))

  // Every active category in display order (empty ones too), plus hidden or unknown categories
  // that still have projects.
  const orderedKeys = allCategories
    .filter((category) => category.isActive || byCategory.has(category.key))
    .map((category) => category.key)
  for (const key of byCategory.keys()) {
    if (!names.has(key)) orderedKeys.push(key)
  }

  const categories = orderedKeys.map((cat) => {
    const group = byCategory.get(cat) ?? []
    if (group.length === 0) {
      return {
        category: cat,
        category_label: names.get(cat) ?? cat,
        total_mid_price: 0,
        total_awarded_price: 0,
        avg_savings_pct: null,
        project_count: 0,
      }
    }

    const totalMid = group.reduce((sum, p) => sum + p.referencePriceBaht, 0)
    const totalAwarded = group.reduce((sum, p) => sum + p.winningPriceBaht, 0)
    const avgSavingsPct =
      group.reduce((sum, p) => sum + savingsPct(p.referencePriceBaht, p.winningPriceBaht), 0) /
      group.length

    return {
      category: cat,
      category_label: names.get(cat) ?? cat,
      total_mid_price: toMillionRound2(totalMid),
      total_awarded_price: toMillionRound2(totalAwarded),
      avg_savings_pct: round1(avgSavingsPct),
      project_count: group.length,
    }
  })

  res.json({ success: true, data: { categories } })
}

// ---------------------------------------------------------------------------
// GET /api/v1/reports/procurement-list
// ---------------------------------------------------------------------------

interface ProcurementListRow {
  id: string
  external_id: string
  category: string
  category_label: string
  project_title: string
  agency_name: string | null
  mid_price_baht: number
  awarded_price_baht: number
  savings_amount: number
  savings_pct: number
  detail_url: string
}

function compareRows(
  a: ProcurementListRow,
  b: ProcurementListRow,
  sortBy: ProcurementListSortField,
): number {
  switch (sortBy) {
    case 'projectTitle':
      return a.project_title.localeCompare(b.project_title)
    case 'midPriceBaht':
      return a.mid_price_baht - b.mid_price_baht
    case 'awardedPriceBaht':
      return a.awarded_price_baht - b.awarded_price_baht
    case 'savings_amount':
      return a.savings_amount - b.savings_amount
    case 'savings_pct':
      return a.savings_pct - b.savings_pct
  }
}

export async function procurementListHandler(req: Request, res: Response): Promise<void> {
  const parsed = procurementListQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query parameters' })
    return
  }
  const {
    period,
    category,
    agencyName,
    budget_min: budgetMin,
    budget_max: budgetMax,
    page,
    page_size: pageSize,
    sort_by: sortBy,
    sort_order: sortOrder,
  } = parsed.data
  if (!(await validateAgencyName(agencyName, res))) return
  const categoryKey = await resolveCategoryFilter(category, res)
  if (categoryKey === null) return

  const cutoff = periodToCutoff(period as ReportPeriod)
  const match = baseMatch(cutoff, agencyName)
  if (budgetMin !== undefined || budgetMax !== undefined) {
    const range: Record<string, number> = {}
    if (budgetMin !== undefined) range.$gte = budgetMin * 1_000_000
    if (budgetMax !== undefined) range.$lte = budgetMax * 1_000_000
    match.midPriceBaht = { ...(match.midPriceBaht as object | undefined), ...range }
  }

  const [rawProjects, names] = await Promise.all([
    TorModel.find(match, {
      externalId: 1,
      projectTitle: 1,
      agencyName: 1,
      midPriceBaht: 1,
      awardedPriceBaht: 1,
      technologies: 1,
      category: 1,
      detailUrl: 1,
    }).lean(),
    getCategoryNameMap(),
  ])

  const filtered = categoryKey
    ? rawProjects.filter((p) => resolveTorCategory(p) === categoryKey)
    : rawProjects

  const rows: ProcurementListRow[] = filtered.map((p) => {
    const midPriceBaht = round2(p.midPriceBaht!)
    const awardedPriceBaht = round2(p.awardedPriceBaht!)
    const cat = resolveTorCategory(p)
    return {
      id: String(p._id),
      external_id: p.externalId,
      category: cat,
      category_label: names.get(cat) ?? cat,
      project_title: p.projectTitle,
      agency_name: p.agencyName ?? null,
      mid_price_baht: midPriceBaht,
      awarded_price_baht: awardedPriceBaht,
      savings_amount: round2(midPriceBaht - awardedPriceBaht),
      savings_pct: round1(savingsPct(midPriceBaht, awardedPriceBaht)),
      detail_url: p.detailUrl,
    }
  })

  const direction = sortOrder === 'asc' ? 1 : -1
  rows.sort((a, b) => direction * compareRows(a, b, sortBy))

  const totalCount = rows.length
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize)
  const items = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)

  res.json({
    success: true,
    data: { total_count: totalCount, page, page_size: pageSize, total_pages: totalPages, items },
  })
}

// ---------------------------------------------------------------------------
// GET /api/v1/reports/filters/departments
// ---------------------------------------------------------------------------

export async function departmentsFilterHandler(_req: Request, res: Response): Promise<void> {
  const departments = await getKnownDepartments()
  res.json({ success: true, data: { departments } })
}
