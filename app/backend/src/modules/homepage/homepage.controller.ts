import type { Request, Response } from 'express'

import { CATEGORY_LABELS, deriveCategory, type TorCategory } from '../tor/tor.controller.js'
import { TorModel } from '../tor/tor.model.js'

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

export async function getSummaryHandler(_req: Request, res: Response): Promise<void> {
  const { start, end } = getBangkokWeekRange(new Date())

  const [facet] = await TorModel.aggregate<{
    total_tors: Array<{ count: number }>
    total_sources: Array<{ count: number }>
    total_budget: Array<{ sum: number }>
    new_this_week: Array<{ count: number }>
    last_updated: Array<{ updatedAt: Date }>
  }>([
    {
      $facet: {
        total_tors: [{ $count: 'count' }],
        total_sources: [{ $group: { _id: '$dataSourceId' } }, { $count: 'count' }],
        total_budget: [
          { $match: { budgetBaht: { $ne: null } } },
          { $group: { _id: null, sum: { $sum: '$budgetBaht' } } },
        ],
        new_this_week: [{ $match: { updatedAt: { $gte: start, $lt: end } } }, { $count: 'count' }],
        last_updated: [
          { $sort: { updatedAt: -1 } },
          { $limit: 1 },
          { $project: { _id: 0, updatedAt: 1 } },
        ],
      },
    },
  ])

  const lastUpdated = facet?.last_updated[0]?.updatedAt ?? null

  res.json({
    total_tors: facet?.total_tors[0]?.count ?? 0,
    total_sources: facet?.total_sources[0]?.count ?? 0,
    total_budget: facet?.total_budget[0]?.sum ?? 0,
    new_this_week: facet?.new_this_week[0]?.count ?? 0,
    last_updated: lastUpdated ? lastUpdated.toISOString() : null,
  })
}

export async function getAnalyticsHandler(_req: Request, res: Response): Promise<void> {
  const [topTechnologies, torDocs] = await Promise.all([
    TorModel.aggregate<{ _id: string; count: number; percentage: number }>([
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
    TorModel.find(
      {},
      { technologies: 1, midPriceBaht: 1, awardedPriceBaht: 1, _id: 0 },
    ).lean(),
  ])

  const totalTors = torDocs.length
  const counts: Record<TorCategory, number> = {
    web_application: 0,
    data_bi: 0,
    mobile_app: 0,
    enterprise_system: 0,
    consulting_architecture: 0,
  }

  type PriceAccumulator = { midSum: number; midCount: number; awardedSum: number; awardedCount: number }
  const priceSums: Record<TorCategory, PriceAccumulator> = {
    web_application: { midSum: 0, midCount: 0, awardedSum: 0, awardedCount: 0 },
    data_bi: { midSum: 0, midCount: 0, awardedSum: 0, awardedCount: 0 },
    mobile_app: { midSum: 0, midCount: 0, awardedSum: 0, awardedCount: 0 },
    enterprise_system: { midSum: 0, midCount: 0, awardedSum: 0, awardedCount: 0 },
    consulting_architecture: { midSum: 0, midCount: 0, awardedSum: 0, awardedCount: 0 },
  }

  // overall (cross-category) stats — only over TORs where both prices are known,
  // so the discount % is comparing like-for-like
  let overallMidSum = 0
  let overallAwardedSum = 0
  let overallPairedCount = 0

  for (const doc of torDocs) {
    const category = deriveCategory(doc.technologies ?? [])
    counts[category] += 1

    if (doc.midPriceBaht != null) {
      priceSums[category].midSum += doc.midPriceBaht
      priceSums[category].midCount += 1
    }
    if (doc.awardedPriceBaht != null) {
      priceSums[category].awardedSum += doc.awardedPriceBaht
      priceSums[category].awardedCount += 1
    }
    if (doc.midPriceBaht != null && doc.awardedPriceBaht != null) {
      overallMidSum += doc.midPriceBaht
      overallAwardedSum += doc.awardedPriceBaht
      overallPairedCount += 1
    }
  }

  const categoryDistribution = (Object.keys(counts) as TorCategory[]).map((category) => {
    const rawPercentage = totalTors === 0 ? 0 : (counts[category] / totalTors) * 100
    return {
      category,
      label: CATEGORY_LABELS[category],
      percentage: Math.round(rawPercentage * 100) / 100,
    }
  })

  const priceComparison = (Object.keys(priceSums) as TorCategory[])
    .filter((category) => priceSums[category].midCount > 0 || priceSums[category].awardedCount > 0)
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      avgMidPriceBaht:
        priceSums[category].midCount > 0
          ? Math.round(priceSums[category].midSum / priceSums[category].midCount)
          : null,
      avgAwardedPriceBaht:
        priceSums[category].awardedCount > 0
          ? Math.round(priceSums[category].awardedSum / priceSums[category].awardedCount)
          : null,
    }))

  const avgMidPriceBaht = overallPairedCount > 0 ? Math.round(overallMidSum / overallPairedCount) : null
  const avgAwardedPriceBaht = overallPairedCount > 0 ? Math.round(overallAwardedSum / overallPairedCount) : null
  const avgDiscountPct =
    avgMidPriceBaht && avgAwardedPriceBaht
      ? Math.round(((avgMidPriceBaht - avgAwardedPriceBaht) / avgMidPriceBaht) * 100 * 100) / 100
      : null

  res.json({
    topTechnologies,
    categoryDistribution,
    priceComparison,
    priceSummary: { avgMidPriceBaht, avgAwardedPriceBaht, avgDiscountPct },
  })
}
