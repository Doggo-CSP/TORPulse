import { createHash } from 'node:crypto'

import type { Request, Response } from 'express'

import { TorModel } from './tor.model.js'

// ---------------------------------------------------------------------------
// Category derivation (pure, no DB) — shared with homepage.controller.ts
// ---------------------------------------------------------------------------

export type TorCategory = 'mobile_app' | 'data_bi' | 'web_application' | 'enterprise_system'

const MOBILE_APP_KEYWORDS = ['flutter', 'react native', 'swift', 'kotlin', 'android', 'ios']
const DATA_BI_KEYWORDS = [
  'python',
  'power bi',
  'tableau',
  'machine learning',
  'sql server',
  'postgresql',
]
const WEB_APPLICATION_KEYWORDS = [
  'react',
  'next.js',
  'vue',
  'angular',
  'node.js',
  'express',
  'django',
]

const matchesAny = (technologies: string[], keywords: string[]): boolean =>
  technologies.some((tech) => keywords.some((keyword) => tech.includes(keyword)))

export function deriveCategory(technologies: string[]): TorCategory {
  const normalized = technologies.map((tech) => tech.toLowerCase())

  if (matchesAny(normalized, MOBILE_APP_KEYWORDS)) {
    return 'mobile_app'
  }

  const hasWebKeyword = matchesAny(normalized, WEB_APPLICATION_KEYWORDS)
  if (matchesAny(normalized, DATA_BI_KEYWORDS) && !hasWebKeyword) {
    return 'data_bi'
  }

  if (hasWebKeyword) {
    return 'web_application'
  }

  return 'enterprise_system'
}

// ---------------------------------------------------------------------------
// Interest scoring (pure, no DB) — used by getRecommendationsHandler below
// ---------------------------------------------------------------------------

const SCORE_MIN = 50
const SCORE_RANGE = 46 // 50..95 inclusive

export interface UserInterestProfile {
  userId: string
  // TODO: preferredCategories, preferredTechnologies, viewedTorIds later
}

export function calculateInterestScore(
  tor: { _id: unknown },
  profile: UserInterestProfile,
): number {
  void profile // unused until real per-user matching lands; kept for a stable call site

  const hash = createHash('md5').update(String(tor._id)).digest('hex')
  const hashInt = parseInt(hash.slice(0, 8), 16)

  return SCORE_MIN + (hashInt % SCORE_RANGE)
}

// ---------------------------------------------------------------------------
// Shared response shape
// ---------------------------------------------------------------------------

interface TorLeanFields {
  _id: unknown
  externalId: string
  sourceAdapter: string
  projectTitle: string
  agencyName?: string | null
  budgetBaht?: number | null
  submissionDeadline?: string | null
  technologies?: string[]
  createdAt: Date
}

export function toTorListItem(tor: TorLeanFields) {
  return {
    id: String(tor._id),
    externalId: tor.externalId,
    sourceAdapter: tor.sourceAdapter,
    projectTitle: tor.projectTitle,
    agencyName: tor.agencyName ?? null,
    budgetBaht: tor.budgetBaht ?? null,
    submissionDeadline: tor.submissionDeadline ?? null,
    technologies: tor.technologies ?? [],
    createdAt: tor.createdAt,
    category: deriveCategory(tor.technologies ?? []),
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/tors/filter-options
// ---------------------------------------------------------------------------

export async function getFilterOptionsHandler(_req: Request, res: Response): Promise<void> {
  const [yearRows, technologies] = await Promise.all([
    TorModel.aggregate<{ _id: number }>([
      { $group: { _id: { $year: '$updatedAt' } } },
      { $sort: { _id: -1 } },
    ]),
    TorModel.distinct('technologies'),
  ])

  res.json({
    years: yearRows.map((row) => row._id),
    technologies: (technologies as string[])
      .filter((technology) => technology.trim() !== '')
      .sort((a, b) => a.localeCompare(b)),
  })
}

// ---------------------------------------------------------------------------
// GET /api/v1/tors
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function parseNumberParam(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseStringParam(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

export async function listTorsHandler(req: Request, res: Response): Promise<void> {
  const q = parseStringParam(req.query.q)
  const budgetMin = parseNumberParam(req.query.budget_min)
  const budgetMax = parseNumberParam(req.query.budget_max)
  const year = parseNumberParam(req.query.year)
  const technology = parseStringParam(req.query.technologies)
  const page = Math.max(1, parseNumberParam(req.query.page) ?? 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseNumberParam(req.query.limit) ?? DEFAULT_LIMIT))

  const query: Record<string, unknown> = {}
  if (q) query.projectTitle = { $regex: escapeRegex(q), $options: 'i' }
  if (technology && technology !== 'all') query.technologies = technology
  if (budgetMin !== undefined || budgetMax !== undefined) {
    const budgetBaht: Record<string, number> = {}
    if (budgetMin !== undefined) budgetBaht.$gte = budgetMin
    if (budgetMax !== undefined) budgetBaht.$lte = budgetMax
    query.budgetBaht = budgetBaht
  }
  if (year !== undefined) {
    query.$expr = { $eq: [{ $year: '$updatedAt' }, year] }
  }

  const items = (await TorModel.find(query).sort({ createdAt: -1 }).lean()).map(toTorListItem)

  const total = items.length
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)
  const paged = items.slice((page - 1) * limit, (page - 1) * limit + limit)

  res.json({ items: paged, total, page, totalPages })
}

// ---------------------------------------------------------------------------
// GET /api/v1/tors/recommendations (auth required)
// ---------------------------------------------------------------------------

const CANDIDATE_POOL_SIZE = 50
const RECOMMENDATION_COUNT = 5

export async function getRecommendationsHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const profile: UserInterestProfile = { userId: req.user._id.toString() }
  const candidates = await TorModel.find().sort({ createdAt: -1 }).limit(CANDIDATE_POOL_SIZE).lean()

  const items = candidates
    .map((tor) => ({
      ...toTorListItem(tor),
      score: calculateInterestScore(tor, profile),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, RECOMMENDATION_COUNT)

  res.json({ items })
}
