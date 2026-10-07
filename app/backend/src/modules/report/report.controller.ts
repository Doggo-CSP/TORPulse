import type { Request, Response } from 'express'
import { isObjectIdOrHexString } from 'mongoose'

import { getCategoryNameMap, listCategories } from '../category/category.repository.js'
import { resolveTorCategory } from '../tor/tor.controller.js'
import { HIDDEN_TOR_REVIEW_STATUSES, TorModel } from '../tor/tor.model.js'
import { getFinishedTorSnapshot, snapshotSource, type FinishedTor } from './finished-tors.js'
import {
  categoryComparison,
  filterFinishedTors,
  findSimilarProjects,
  monthlyTimeline,
  priceOverview,
  procurementList,
  reportDateOf,
  round1,
  savingsBaht,
  savingsDistribution,
  savingsPct,
  summarizeSimilar,
  type FinishedTorFilters,
} from './report.calculations.js'
import { periodToCutoff } from './report.constants.js'
import {
  procurementListQuerySchema,
  reportFilterQuerySchema,
  similarQuerySchema,
} from './report.validation.js'

// Every report reads finished projects from the newest `tors_bk_*` snapshot (see
// finished-tors.ts), not from `tors`, which only holds TORs still open for bidding. Money is
// in baht. Each response carries `source` so the page can say which snapshot it shows.

type FilterQuery = ReturnType<typeof reportFilterQuerySchema.parse>

// The category filter is a key or a display name (case-insensitive). Returns its key, or null
// after answering 400. Hidden categories still match so old links keep working.
async function resolveCategoryFilter(
  category: string | undefined,
  res: Response,
): Promise<string | undefined | null> {
  if (!category) return undefined
  const wanted = category.toLowerCase()
  for (const [key, name] of await getCategoryNameMap()) {
    if (key === wanted || name.toLowerCase() === wanted) return key
  }
  res.status(400).json({ success: false, message: 'ไม่พบหมวดหมู่ที่ระบุ' })
  return null
}

// Parses the shared filters and loads the snapshot. Returns null after answering an error.
async function loadFiltered(
  req: Request,
  res: Response,
  options: { ignore?: (keyof FilterQuery)[] } = {},
): Promise<{
  items: FinishedTor[]
  source: ReturnType<typeof snapshotSource>
  query: FilterQuery
} | null> {
  const parsed = reportFilterQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'พารามิเตอร์ไม่ถูกต้อง' })
    return null
  }
  const query = parsed.data
  const ignore = new Set(options.ignore ?? [])

  const category = ignore.has('category')
    ? undefined
    : await resolveCategoryFilter(query.category, res)
  if (category === null) return null

  const snapshot = await getFinishedTorSnapshot()
  const filters: FinishedTorFilters = {
    cutoff: periodToCutoff(query.period),
    category,
    departmentName: query.department,
    q: query.q,
    savingsBucket: ignore.has('savings_bucket') ? undefined : query.savings_bucket,
  }
  return {
    items: filterFinishedTors(snapshot?.items ?? [], filters),
    source: snapshotSource(snapshot),
    query,
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/reports/price-overview
// ---------------------------------------------------------------------------

export async function priceOverviewHandler(req: Request, res: Response): Promise<void> {
  const loaded = await loadFiltered(req, res)
  if (!loaded) return
  res.json({ success: true, data: priceOverview(loaded.items), source: loaded.source })
}

// ---------------------------------------------------------------------------
// GET /api/v1/reports/savings-distribution
// ---------------------------------------------------------------------------

// The bucket filter is ignored here; this endpoint is what shows the buckets.
export async function savingsDistributionHandler(req: Request, res: Response): Promise<void> {
  const loaded = await loadFiltered(req, res, { ignore: ['savings_bucket'] })
  if (!loaded) return
  res.json({ success: true, data: savingsDistribution(loaded.items), source: loaded.source })
}

// ---------------------------------------------------------------------------
// GET /api/v1/reports/category-comparison
// ---------------------------------------------------------------------------

// The category filter is ignored here; every category is compared.
export async function categoryComparisonHandler(req: Request, res: Response): Promise<void> {
  const loaded = await loadFiltered(req, res, { ignore: ['category'] })
  if (!loaded) return
  const categories = await listCategories()
  res.json({
    success: true,
    data: { categories: categoryComparison(loaded.items, categories) },
    source: loaded.source,
  })
}

// ---------------------------------------------------------------------------
// GET /api/v1/reports/timeline
// ---------------------------------------------------------------------------

export async function timelineHandler(req: Request, res: Response): Promise<void> {
  const loaded = await loadFiltered(req, res)
  if (!loaded) return
  res.json({
    success: true,
    data: { months: monthlyTimeline(loaded.items) },
    source: loaded.source,
  })
}

// ---------------------------------------------------------------------------
// GET /api/v1/reports/procurement-list
// ---------------------------------------------------------------------------

export async function procurementListHandler(req: Request, res: Response): Promise<void> {
  const parsed = procurementListQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'พารามิเตอร์ไม่ถูกต้อง' })
    return
  }
  const loaded = await loadFiltered(req, res)
  if (!loaded) return

  const { page, page_size: pageSize, sort_by: sortBy, sort_order: sortOrder } = parsed.data
  const data = procurementList(
    loaded.items,
    { page, pageSize, sortBy, sortOrder },
    await getCategoryNameMap(),
  )
  res.json({ success: true, data, source: loaded.source })
}

// ---------------------------------------------------------------------------
// GET /api/v1/reports/filters/departments
// ---------------------------------------------------------------------------

// Departments that have at least one finished project, for the report's department filter.
export async function departmentsFilterHandler(_req: Request, res: Response): Promise<void> {
  const snapshot = await getFinishedTorSnapshot()
  const departments = [
    ...new Set(
      (snapshot?.items ?? [])
        .map((tor) => tor.departmentName)
        .filter((name): name is string => name !== null),
    ),
  ].sort((a, b) => a.localeCompare(b, 'th'))
  res.json({ success: true, data: { departments }, source: snapshotSource(snapshot) })
}

// ---------------------------------------------------------------------------
// GET /api/v1/tors/:id/similar (UC-05)
// ---------------------------------------------------------------------------

// Finished projects similar to an open TOR (shared categories and technologies), with their
// prices, so the user can judge whether the TOR's budget is reasonable.
export async function similarFinishedTorsHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  if (!isObjectIdOrHexString(id)) {
    res.status(400).json({ success: false, message: 'รหัส TOR ไม่ถูกต้อง' })
    return
  }
  const parsed = similarQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'พารามิเตอร์ไม่ถูกต้อง' })
    return
  }

  const tor = await TorModel.findById(id, {
    externalId: 1,
    category: 1,
    categories: 1,
    technologies: 1,
    budgetBaht: 1,
    reviewStatus: 1,
  }).lean()
  if (!tor || (tor.reviewStatus && HIDDEN_TOR_REVIEW_STATUSES.includes(tor.reviewStatus))) {
    res.status(404).json({ success: false, message: 'ไม่พบ TOR' })
    return
  }

  const category = resolveTorCategory(tor)
  const target = {
    externalId: tor.externalId,
    category,
    categories: tor.categories?.length ? tor.categories : [category],
    technologies: tor.technologies ?? [],
    budgetBaht: tor.budgetBaht ?? null,
  }

  const [snapshot, categoryNames] = await Promise.all([
    getFinishedTorSnapshot(),
    getCategoryNameMap(),
  ])
  const matches = findSimilarProjects(target, snapshot?.items ?? [], parsed.data.limit)

  res.json({
    success: true,
    data: {
      summary: summarizeSimilar(
        matches.map((match) => match.tor),
        tor.budgetBaht ?? null,
      ),
      items: matches.map(({ tor: project, match }) => ({
        external_id: project.externalId,
        project_title: project.projectTitle,
        department_name: project.departmentName,
        category: project.category,
        category_label: categoryNames.get(project.category) ?? project.category,
        matched_categories: match.matchedCategories.map((key) => ({
          key,
          label: categoryNames.get(key) ?? key,
        })),
        matched_technologies: match.matchedTechnologies,
        score: match.score,
        announce_date: reportDateOf(project)?.toISOString() ?? null,
        budget_baht: project.budgetBaht,
        mid_price_baht: project.midPriceBaht,
        awarded_price_baht: project.awardedPriceBaht,
        savings_amount_baht: Math.round(savingsBaht(project)),
        savings_pct: round1(savingsPct(project)),
        requirements: project.requirements.slice(0, 5),
        detail_url: project.detailUrl,
      })),
    },
    source: snapshotSource(snapshot),
  })
}
