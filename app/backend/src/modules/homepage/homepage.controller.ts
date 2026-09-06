import type { Request, Response } from 'express'

import { deriveCategory, type TorCategory } from '../tor/tor.controller.js'
import { TorModel } from '../tor/tor.model.js'

const CATEGORY_LABELS: Record<TorCategory, string> = {
  web_application: 'งานพัฒนาเว็บไซต์',
  data_bi: 'งานข้อมูลและวิเคราะห์',
  mobile_app: 'งานแอปพลิเคชันมือถือ',
  enterprise_system: 'งานระบบองค์กร',
}

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
  const [topTechnologies, technologyDocs] = await Promise.all([
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
      { $sort: { count: -1, _id: 1 } }, // secondary key on _id keeps tie-break order deterministic
      { $limit: 10 },
    ]),
    TorModel.find({}, { technologies: 1, _id: 0 }).lean(),
  ])

  const totalTors = technologyDocs.length
  const counts: Record<TorCategory, number> = {
    web_application: 0,
    data_bi: 0,
    mobile_app: 0,
    enterprise_system: 0,
  }
  for (const doc of technologyDocs) {
    counts[deriveCategory(doc.technologies ?? [])] += 1
  }

  const categoryDistribution = (Object.keys(counts) as TorCategory[]).map((category) => {
    const rawPercentage = totalTors === 0 ? 0 : (counts[category] / totalTors) * 100
    return {
      category,
      label: CATEGORY_LABELS[category],
      percentage: Math.round(rawPercentage * 100) / 100,
    }
  })

  res.json({ topTechnologies, categoryDistribution })
}
