import type { Request, Response } from 'express'

import { listCategories } from '../category/category.repository.js'
import { getFinishedTors, reportSource, type FinishedTor } from '../report/finished-tors.js'
import {
  categoryComparison,
  priceOverview,
  type CategoryInfo,
} from '../report/report.calculations.js'
import { resolveTorCategory } from '../tor/tor.controller.js'
import { PUBLIC_TOR_FILTER, TorModel } from '../tor/tor.model.js'

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

export function getBangkokWeekRange(now: Date): { start: Date; end: Date } {
  const bangkokNow = new Date(now.getTime() + BANGKOK_OFFSET_MS)
  const dayIndex = bangkokNow.getUTCDay() // 0=Sun..6=Sat, evaluated on the shifted clock
  const daysSinceMonday = (dayIndex + 6) % 7

  const bangkokMonday = new Date(
    Date.UTC(
      bangkokNow.getUTCFullYear(),
      bangkokNow.getUTCMonth(),
      bangkokNow.getUTCDate() - daysSinceMonday,
      0,
      0,
      0,
      0,
    ),
  )

  const start = new Date(bangkokMonday.getTime() - BANGKOK_OFFSET_MS)
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
  return { start, end }
}

// Reads `tors`, the TORs still open for bidding (UC-04).
export async function getSummaryHandler(_req: Request, res: Response): Promise<void> {
  const { start, end } = getBangkokWeekRange(new Date())

  const [facet] = await TorModel.aggregate<{
    total_tors: Array<{ count: number }>
    total_sources: Array<{ count: number }>
    total_budget: Array<{ sum: number; count: number }>
    new_this_week: Array<{ count: number }>
    last_updated: Array<{ updatedAt: Date }>
  }>([
    { $match: PUBLIC_TOR_FILTER },
    {
      $facet: {
        total_tors: [{ $count: 'count' }],
        total_sources: [{ $group: { _id: '$dataSourceId' } }, { $count: 'count' }],
        total_budget: [
          { $match: { budgetBaht: { $ne: null } } },
          { $group: { _id: null, sum: { $sum: '$budgetBaht' }, count: { $sum: 1 } } },
        ],
        // createdAt is set once, when the TOR first enters the system. updatedAt changes on
        // every producer sync, so it would count old TORs as new.
        new_this_week: [{ $match: { createdAt: { $gte: start, $lt: end } } }, { $count: 'count' }],
        last_updated: [
          { $sort: { updatedAt: -1 } },
          { $limit: 1 },
          { $project: { _id: 0, updatedAt: 1 } },
        ],
      },
    },
  ])

  const lastUpdated = facet?.last_updated[0]?.updatedAt ?? null
  const budget = facet?.total_budget[0]

  res.json({
    total_tors: facet?.total_tors[0]?.count ?? 0,
    total_sources: facet?.total_sources[0]?.count ?? 0,
    total_budget: budget?.sum ?? 0,
    // Average over the TORs that state a budget
    avg_budget: budget && budget.count > 0 ? Math.round(budget.sum / budget.count) : null,
    new_this_week: facet?.new_this_week[0]?.count ?? 0,
    last_updated: lastUpdated ? lastUpdated.toISOString() : null,
  })
}

// Category share and technologies come from `tors` (open TORs); prices from finished projects.
export async function getAnalyticsHandler(_req: Request, res: Response): Promise<void> {
  const [topTechnologies, torDocs, categories] = await Promise.all([
    TorModel.aggregate<{ _id: string; count: number; percentage: number }>([
      { $match: PUBLIC_TOR_FILTER },
      { $unwind: '$technologies' },
      { $group: { _id: '$technologies', count: { $sum: 1 } } },
      { $setWindowFields: { output: { total: { $sum: '$count' } } } },
      {
        $project: {
          _id: 1,
          count: 1,
          percentage: { $round: [{ $multiply: [{ $divide: ['$count', '$total'] }, 100] }, 2] },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 10 },
    ]),
    TorModel.find(PUBLIC_TOR_FILTER, { technologies: 1, category: 1, _id: 0 }).lean(),
    listCategories(),
  ])

  const totalTors = torDocs.length

  // Every active category is listed in display order (0% when unused). Hidden categories are a
  // soft delete for users, so they are left out; their TORs still count in the total, so the
  // shares can add up to less than 100%.
  const names = new Map(categories.map((category) => [category.key, category.name]))
  const counts = new Map<string, number>(
    categories.filter((category) => category.isActive).map((category) => [category.key, 0]),
  )
  for (const doc of torDocs) {
    const category = resolveTorCategory(doc)
    if (counts.has(category)) counts.set(category, counts.get(category)! + 1)
  }

  const categoryDistribution = [...counts.keys()].map((category) => {
    const rawPercentage = totalTors === 0 ? 0 : ((counts.get(category) ?? 0) / totalTors) * 100
    return {
      category,
      label: names.get(category) ?? category,
      percentage: Math.round(rawPercentage * 100) / 100,
    }
  })

  // Prices: TORs in `tors` with a mid price and an awarded price. Awarded prices are a labelled
  // mock for TORs whose bidding has closed (see report/finished-tors.ts); open TORs have none.
  const finished = await getFinishedTors()
  const { priceComparison, priceSummary } = homepagePrices(finished.items, categories)

  res.json({
    topTechnologies,
    categoryDistribution,
    priceComparison,
    priceSummary,
    priceSource: reportSource(finished),
  })
}

// Homepage price chart and cards: every active category (null averages when a category has no
// finished project), plus overall averages over all finished projects.
export function homepagePrices(items: FinishedTor[], categories: CategoryInfo[]) {
  const priceComparison = categoryComparison(items, categories).map((row) => ({
    category: row.category,
    label: row.category_label,
    projectCount: row.project_count,
    avgMidPriceBaht: row.avg_mid_price_baht,
    avgAwardedPriceBaht: row.avg_awarded_price_baht,
  }))
  const overview = priceOverview(items)
  return {
    priceComparison,
    priceSummary: {
      projectCount: overview.project_count,
      avgMidPriceBaht: overview.avg_mid_price_baht,
      avgAwardedPriceBaht: overview.avg_awarded_price_baht,
      avgDiscountPct: overview.overall_savings_pct,
    },
  }
}
