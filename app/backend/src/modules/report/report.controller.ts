import type { Request, Response } from 'express'
import { isObjectIdOrHexString } from 'mongoose'

import { getVisibleCategoryNameMap, listCategories } from '../category/category.repository.js'
import { resolveTorCategory } from '../tor/tor.controller.js'
import { HIDDEN_TOR_REVIEW_STATUSES, TorModel } from '../tor/tor.model.js'
import { getFinishedTors, reportSource, type FinishedTor } from './finished-tors.js'
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
  withVisibleCategories,
  type FinishedTorFilters,
} from './report.calculations.js'
import { periodToCutoff } from './report.constants.js'
import {
  procurementListQuerySchema,
  reportFilterQuerySchema,
  similarQuerySchema,
} from './report.validation.js'

// Every report reads TORs from `tors` that have a mid price and an awarded price. Awarded
// prices are a mock for TORs whose bidding has closed until ingestion stores real ones (see
// finished-tors.ts); TORs still open for bids never have one. Money is in baht. Each response
// carries `source` (as_of, project_count, mock_awarded_count).
//
// Hidden categories are a soft delete for users: reports never show, filter on or match them
// (see withVisibleCategories). Showing the category again brings it back.

type FilterQuery = ReturnType<typeof reportFilterQuerySchema.parse>

// The category filter is a key or a display name (case-insensitive) of an active category.
// Returns its key, or null after answering 400 (unknown or hidden category).
function resolveCategoryFilter(
  category: string | undefined,
  visibleNames: Map<string, string>,
  res: Response,
): string | undefined | null {
  if (!category) return undefined
  const wanted = category.toLowerCase()
  for (const [key, name] of visibleNames) {
    if (key === wanted || name.toLowerCase() === wanted) return key
  }
  res.status(400).json({ success: false, message: 'ไม่พบหมวดหมู่ที่ระบุ' })
  return null
}

// Parses the shared filters and loads the priced TORs. Returns null after answering an error.
async function loadFiltered(
  req: Request,
  res: Response,
  options: { ignore?: (keyof FilterQuery)[] } = {},
): Promise<{
  items: FinishedTor[]
  source: ReturnType<typeof reportSource>
  query: FilterQuery
  // Active categories only
  categoryNames: Map<string, string>
} | null> {
  const parsed = reportFilterQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'พารามิเตอร์ไม่ถูกต้อง' })
    return null
  }
  const query = parsed.data
  const ignore = new Set(options.ignore ?? [])

  const [finished, categoryNames] = await Promise.all([
    getFinishedTors(),
    getVisibleCategoryNameMap(),
  ])
  const category = ignore.has('category')
    ? undefined
    : resolveCategoryFilter(query.category, categoryNames, res)
  if (category === null) return null

  const visible = new Set(categoryNames.keys())
  const filters: FinishedTorFilters = {
    cutoff: periodToCutoff(query.period),
    category,
    departmentName: query.department,
    q: query.q,
    savingsBucket: ignore.has('savings_bucket') ? undefined : query.savings_bucket,
  }
  return {
    items: filterFinishedTors(
      finished.items.map((tor) => withVisibleCategories(tor, visible)),
      filters,
    ),
    source: reportSource(finished),
    query,
    categoryNames,
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
    loaded.categoryNames,
  )
  res.json({ success: true, data, source: loaded.source })
}

// ---------------------------------------------------------------------------
// GET /api/v1/reports/filters/departments
// ---------------------------------------------------------------------------

// Departments that have at least one priced TOR, for the report's department filter.
export async function departmentsFilterHandler(_req: Request, res: Response): Promise<void> {
  const finished = await getFinishedTors()
  const departments = [
    ...new Set(
      finished.items
        .map((tor) => tor.departmentName)
        .filter((name): name is string => name !== null),
    ),
  ].sort((a, b) => a.localeCompare(b, 'th'))
  res.json({ success: true, data: { departments }, source: reportSource(finished) })
}

// ---------------------------------------------------------------------------
// GET /api/v1/tors/:id/similar (UC-05)
// ---------------------------------------------------------------------------

// TORs whose bidding has closed and that are similar to this TOR (shared categories and
// technologies), with their mid and awarded prices, so the user can judge whether this TOR's
// budget is reasonable. Awarded prices may be mock (awarded_is_mock).
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

  const [finished, categoryNames] = await Promise.all([
    getFinishedTors(),
    getVisibleCategoryNameMap(),
  ])
  // Hidden categories are never matched on or shown (soft delete)
  const visible = new Set(categoryNames.keys())
  const category = resolveTorCategory(tor)
  const targetCategories = (tor.categories?.length ? tor.categories : [category]).filter((key) =>
    visible.has(key),
  )
  const target = {
    externalId: tor.externalId,
    category: visible.has(category) ? category : null,
    categories: targetCategories,
    technologies: tor.technologies ?? [],
    budgetBaht: tor.budgetBaht ?? null,
  }

  const matches = findSimilarProjects(
    target,
    finished.items.map((item) => withVisibleCategories(item, visible)),
    parsed.data.limit,
  )

  res.json({
    success: true,
    data: {
      summary: summarizeSimilar(
        matches.map((match) => match.tor),
        tor.budgetBaht ?? null,
      ),
      items: matches.map(({ tor: project, match }) => ({
        tor_id: project.id,
        external_id: project.externalId,
        project_title: project.projectTitle,
        department_name: project.departmentName,
        // null when the project's primary category is hidden
        category: project.category,
        category_label: project.category ? (categoryNames.get(project.category) ?? null) : null,
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
        awarded_is_mock: project.awardedIsMock,
        savings_amount_baht: Math.round(savingsBaht(project)),
        savings_pct: round1(savingsPct(project)),
        requirements: project.requirements.slice(0, 5),
        detail_url: project.detailUrl,
      })),
    },
    source: reportSource(finished),
  })
}
