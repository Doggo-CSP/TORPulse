import type { Request, Response } from 'express'

import { deriveCategory, type TorCategory } from '../tor/tor.controller.js'
import { TorModel } from '../tor/tor.model.js'
import {
  CATEGORY_LABEL_TO_KEY,
  REPORT_CATEGORY_LABELS,
  REPORT_CATEGORY_ORDER,
  periodToCutoff,
  type ReportPeriod,
} from './report.constants.js'
import {
  categoryPriceHistoryQuerySchema,
  priceOverviewQuerySchema,
  procurementComparisonQuerySchema,
} from './report.validation.js'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface ClosedProjectLean {
  referencePriceBaht?: number | null
  winningPriceBaht?: number | null
  technologies?: string[]
}

function closedMatch(cutoff: Date | null, department?: string): Record<string, unknown> {
  const match: Record<string, unknown> = {
    status: 'closed',
    referencePriceBaht: { $gt: 0 },
    winningPriceBaht: { $ne: null },
  }
  if (cutoff) match.announcementDate = { $gte: cutoff }
  if (department) match.department = department
  return match
}

interface GroupStats {
  avg_reference_price: number | null
  avg_winning_price: number | null
  avg_percentage_diff: number | null
  project_count: number
}

function toMillion(baht: number): number {
  return Math.round((baht / 1_000_000) * 10) / 10
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function computeStats(projects: ClosedProjectLean[]): GroupStats {
  if (projects.length === 0) {
    return {
      avg_reference_price: null,
      avg_winning_price: null,
      avg_percentage_diff: null,
      project_count: 0,
    }
  }

  const percentageDiffs = projects.map(
    (p) => ((p.winningPriceBaht! - p.referencePriceBaht!) / p.referencePriceBaht!) * 100,
  )
  const avgReference = projects.reduce((sum, p) => sum + p.referencePriceBaht!, 0) / projects.length
  const avgWinning = projects.reduce((sum, p) => sum + p.winningPriceBaht!, 0) / projects.length
  const avgPercentageDiff = percentageDiffs.reduce((sum, v) => sum + v, 0) / percentageDiffs.length

  return {
    avg_reference_price: toMillion(avgReference),
    avg_winning_price: toMillion(avgWinning),
    avg_percentage_diff: round1(avgPercentageDiff),
    project_count: projects.length,
  }
}

function groupByCategory(projects: ClosedProjectLean[]): Map<TorCategory, ClosedProjectLean[]> {
  const byCategory = new Map<TorCategory, ClosedProjectLean[]>()
  for (const project of projects) {
    const category = deriveCategory(project.technologies ?? [])
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
// GET /api/v1/reports/procurement-comparison
// ---------------------------------------------------------------------------

export async function procurementComparisonHandler(req: Request, res: Response): Promise<void> {
  const parsed = procurementComparisonQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query parameters' })
    return
  }
  const { period, category, department, budget_min: budgetMin, budget_max: budgetMax } = parsed.data

  const cutoff = periodToCutoff(period as ReportPeriod)
  const match = closedMatch(cutoff, department)
  if (budgetMin !== undefined || budgetMax !== undefined) {
    const referencePriceRange = match.referencePriceBaht as Record<string, number>
    if (budgetMin !== undefined) referencePriceRange.$gte = budgetMin * 1_000_000
    if (budgetMax !== undefined) referencePriceRange.$lte = budgetMax * 1_000_000
  }

  const projects = await TorModel.find(match, {
    referencePriceBaht: 1,
    winningPriceBaht: 1,
    technologies: 1,
  }).lean()

  const byCategory = groupByCategory(projects)
  const selectedCategory = category ? CATEGORY_LABEL_TO_KEY[category] : undefined

  const categories = REPORT_CATEGORY_ORDER.map((cat) => {
    const inSelection = !selectedCategory || selectedCategory === cat
    const stats = inSelection ? computeStats(byCategory.get(cat) ?? []) : computeStats([])
    return { category: REPORT_CATEGORY_LABELS[cat], ...stats }
  })

  res.json({
    success: true,
    data: {
      filters_applied: {
        period,
        category: category ?? null,
        department: department ?? null,
        budget_min: budgetMin ?? null,
        budget_max: budgetMax ?? null,
      },
      categories,
    },
  })
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
  const { period, category, department } = parsed.data
  const selectedCategory = category ? CATEGORY_LABEL_TO_KEY[category] : undefined

  const cutoff = periodToCutoff(period as ReportPeriod)
  const closedProjects = await TorModel.find(closedMatch(cutoff, department), {
    referencePriceBaht: 1,
    winningPriceBaht: 1,
    technologies: 1,
  }).lean()
  const filteredClosed = selectedCategory
    ? closedProjects.filter((p) => deriveCategory(p.technologies ?? []) === selectedCategory)
    : closedProjects

  const stats = computeStats(filteredClosed)
  const trend =
    stats.avg_percentage_diff === null
      ? null
      : stats.avg_percentage_diff < -1
        ? 'ราคามีแนวโน้มลดลง'
        : stats.avg_percentage_diff > 1
          ? 'ราคามีแนวโน้มเพิ่มขึ้น'
          : 'ราคาคงที่'

  // "current" bucket: open projects, filtered by category/department only — never by period.
  const openMatch: Record<string, unknown> = { status: 'open' }
  if (department) openMatch.department = department
  const openProjects = await TorModel.find(openMatch, {
    referencePriceBaht: 1,
    technologies: 1,
  }).lean()
  const filteredOpen = selectedCategory
    ? openProjects.filter((p) => deriveCategory(p.technologies ?? []) === selectedCategory)
    : openProjects
  const openWithReference = filteredOpen.filter((p) => p.referencePriceBaht != null)

  const currentAvgReferencePrice =
    openWithReference.length === 0
      ? null
      : toMillion(
          openWithReference.reduce((sum, p) => sum + p.referencePriceBaht!, 0) /
            openWithReference.length,
        )
  const higherThanAvgPct =
    currentAvgReferencePrice !== null && stats.avg_reference_price !== null
      ? round1(
          ((currentAvgReferencePrice - stats.avg_reference_price) / stats.avg_reference_price) *
            100,
        )
      : null

  res.json({
    success: true,
    data: {
      filters_applied: { period, category: category ?? null, department: department ?? null },
      avg_reference_price: stats.avg_reference_price,
      avg_winning_price: stats.avg_winning_price,
      avg_percentage_diff: stats.avg_percentage_diff,
      project_count: stats.project_count,
      trend,
      current_vs_historical: {
        current_avg_reference_price: currentAvgReferencePrice,
        current_project_count: openWithReference.length,
        historical_avg_reference_price: stats.avg_reference_price,
        higher_than_avg_pct: higherThanAvgPct,
      },
    },
  })
}

// ---------------------------------------------------------------------------
// GET /api/v1/reports/category-price-history
// ---------------------------------------------------------------------------

export async function categoryPriceHistoryHandler(req: Request, res: Response): Promise<void> {
  const parsed = categoryPriceHistoryQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query parameters' })
    return
  }
  const { period } = parsed.data

  const cutoff = periodToCutoff(period as ReportPeriod)
  const projects = await TorModel.find(closedMatch(cutoff), {
    referencePriceBaht: 1,
    winningPriceBaht: 1,
    technologies: 1,
  }).lean()

  const byCategory = groupByCategory(projects)
  const categories = [...byCategory.entries()]
    .map(([cat, list]) => ({ category: REPORT_CATEGORY_LABELS[cat], ...computeStats(list) }))
    .sort((a, b) => (b.avg_reference_price ?? 0) - (a.avg_reference_price ?? 0))

  res.json({
    success: true,
    data: { filters_applied: { period }, categories },
  })
}
