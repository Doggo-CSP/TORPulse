import { createHash } from 'node:crypto'

import type { Request, Response } from 'express'
import { isObjectIdOrHexString } from 'mongoose'

import { DEFAULT_CATEGORY_KEY } from '../category/category.constants.js'
import { getVisibleCategoryNameMap, listCategories } from '../category/category.repository.js'
import { cleanDateText, parseThaiDate, toIsoDateString } from '../ingestion/thai-date.js'
import { HIDDEN_TOR_REVIEW_STATUSES, PUBLIC_TOR_FILTER, TorModel } from './tor.model.js'

// ---------------------------------------------------------------------------
// Category resolution (pure, no DB) — shared with homepage and report
// ---------------------------------------------------------------------------

// A key of the categories collection (see modules/category).
export type TorCategory = string

const MOBILE_APP_KEYWORDS = ['flutter', 'react native', 'swift', 'kotlin', 'android', 'ios']
// Fallback keyword rules for TORs without a stored category (the AI classifier sets it at
// ingestion). They also seed each category's starting keywords.
const AI_ML_KEYWORDS = [
  'artificial intelligence',
  'machine learning',
  'deep learning',
  'neural network',
  'llm',
  'large language model',
  'generative ai',
  'natural language processing',
  'nlp',
  'computer vision',
  'ocr',
  'chatbot',
  'tensorflow',
  'pytorch',
]
// Short tokens would match inside unrelated words ("mail", "html", "social"), so they must be
// the whole technology name.
const AI_ML_EXACT_KEYWORDS = ['ai', 'ml']
const CYBERSECURITY_KEYWORDS = [
  'cybersecurity',
  'cyber security',
  'security operation',
  'siem',
  'pentest',
  'penetration test',
  'vulnerability assessment',
  'firewall',
  'iso 27001',
]
const CYBERSECURITY_EXACT_KEYWORDS = ['soc', 'security']
const DATA_BI_KEYWORDS = ['python', 'power bi', 'tableau', 'sql server', 'postgresql']
const WEB_APPLICATION_KEYWORDS = [
  'react',
  'next.js',
  'vue',
  'angular',
  'node.js',
  'express',
  'django',
]
const CONSULTING_ARCHITECTURE_KEYWORDS = [
  'consulting',
  'advisory',
  'enterprise architecture',
  'business analysis',
  'it strategy',
  'it governance',
  'togaf',
]
const CLOUD_INFRASTRUCTURE_KEYWORDS = [
  'cloud',
  'aws',
  'azure',
  'gcp',
  'kubernetes',
  'docker',
  'devops',
  'terraform',
  'vmware',
  'data center',
  'infrastructure',
  'server',
  'network',
]

// Keys the keyword rules below can return. Categories themselves live in the database; these
// rules only decide which key a TOR gets until categorisation moves to real data (next sprint).
type RuleCategoryKey =
  | 'web_application'
  | 'data_bi'
  | 'mobile_app'
  | 'enterprise_system'
  | 'consulting_architecture'
  | 'cybersecurity'
  | 'ai_ml'
  | 'cloud_infrastructure'

// Used by scripts/seed-categories.ts as each seeded category's starting keywords.
export const CATEGORY_RULE_KEYWORDS: Record<RuleCategoryKey, string[]> = {
  web_application: WEB_APPLICATION_KEYWORDS,
  data_bi: DATA_BI_KEYWORDS,
  mobile_app: MOBILE_APP_KEYWORDS,
  enterprise_system: [],
  consulting_architecture: CONSULTING_ARCHITECTURE_KEYWORDS,
  cybersecurity: [...CYBERSECURITY_KEYWORDS, ...CYBERSECURITY_EXACT_KEYWORDS],
  ai_ml: [...AI_ML_KEYWORDS, ...AI_ML_EXACT_KEYWORDS],
  cloud_infrastructure: CLOUD_INFRASTRUCTURE_KEYWORDS,
}

const matchesAny = (technologies: string[], keywords: string[]): boolean =>
  technologies.some((tech) => keywords.some((keyword) => tech.includes(keyword)))

const matchesExact = (technologies: string[], keywords: string[]): boolean =>
  technologies.some((tech) => keywords.includes(tech))

export function deriveCategory(technologies: string[]): RuleCategoryKey {
  const normalized = technologies.map((tech) => tech.trim().toLowerCase())

  if (matchesAny(normalized, MOBILE_APP_KEYWORDS)) {
    return 'mobile_app'
  }

  if (matchesAny(normalized, AI_ML_KEYWORDS) || matchesExact(normalized, AI_ML_EXACT_KEYWORDS)) {
    return 'ai_ml'
  }

  if (
    matchesAny(normalized, CYBERSECURITY_KEYWORDS) ||
    matchesExact(normalized, CYBERSECURITY_EXACT_KEYWORDS)
  ) {
    return 'cybersecurity'
  }

  const hasWebKeyword = matchesAny(normalized, WEB_APPLICATION_KEYWORDS)
  if (matchesAny(normalized, DATA_BI_KEYWORDS) && !hasWebKeyword) {
    return 'data_bi'
  }

  if (hasWebKeyword) {
    return 'web_application'
  }

  if (matchesAny(normalized, CLOUD_INFRASTRUCTURE_KEYWORDS)) {
    return 'cloud_infrastructure'
  }

  if (matchesAny(normalized, CONSULTING_ARCHITECTURE_KEYWORDS)) {
    return 'consulting_architecture'
  }

  return DEFAULT_CATEGORY_KEY
}

// A stored category (set by the AI classifier at ingestion, by an admin override, or by the
// category migration script) wins; records stored before categories were persisted fall back to
// the keyword rules above.
export function resolveTorCategory(tor: {
  category?: string | null
  technologies?: string[] | null
}): TorCategory {
  return tor.category || deriveCategory(tor.technologies ?? [])
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

// `submissionDeadline` in API responses is always YYYY-MM-DD or null, so
// clients can pass it to `new Date()`. The AI's raw text is returned as
// `submissionDeadlineText`. TORs stored before `submissionDeadlineAt`
// existed are parsed on the fly.
function deadlineFields(tor: {
  submissionDeadline?: string | null
  submissionDeadlineAt?: Date | null
}) {
  return {
    submissionDeadline: toIsoDateString(
      tor.submissionDeadlineAt ?? parseThaiDate(tor.submissionDeadline),
    ),
    submissionDeadlineText: cleanDateText(tor.submissionDeadline),
  }
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
  submissionDeadlineAt?: Date | null
  projectStatus?: string | null
  contractStatus?: string | null
  contractStatusCode?: string | null
  technologies?: string[]
  category?: string | null
  categories?: string[]
  createdAt: Date
}

// categoryNames maps active category keys to their names (getVisibleCategoryNameMap). A hidden
// category is a soft delete for users: it is left out of `categories`, and `category` /
// `categoryName` are null when the primary category is hidden.
export function toTorListItem(tor: TorLeanFields, categoryNames: Map<string, string>) {
  const resolved = resolveTorCategory(tor)
  const category = categoryNames.has(resolved) ? resolved : null
  return {
    id: String(tor._id),
    externalId: tor.externalId,
    sourceAdapter: tor.sourceAdapter,
    projectTitle: tor.projectTitle,
    agencyName: tor.agencyName ?? null,
    budgetBaht: tor.budgetBaht ?? null,
    ...deadlineFields(tor),
    projectStatus: tor.projectStatus ?? null,
    contractStatus: tor.contractStatus ?? null,
    contractStatusCode: tor.contractStatusCode ?? null,
    technologies: tor.technologies ?? [],
    createdAt: tor.createdAt,
    category,
    categories: (tor.categories?.length ? tor.categories : [resolved]).filter((key) =>
      categoryNames.has(key),
    ),
    categoryName: category ? (categoryNames.get(category) ?? null) : null,
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/tors/filter-options
// ---------------------------------------------------------------------------

const distinctStrings = (values: unknown[]): string[] => [
  ...new Set(
    values
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  ),
]

export async function getFilterOptionsHandler(_req: Request, res: Response): Promise<void> {
  const [years, departments, statuses, categoryKeys, primaryCategoryKeys, categories] =
    await Promise.all([
      TorModel.distinct('fiscalYear', PUBLIC_TOR_FILTER),
      TorModel.distinct('departmentName', PUBLIC_TOR_FILTER),
      TorModel.distinct('projectStatus', PUBLIC_TOR_FILTER),
      TorModel.distinct('categories', PUBLIC_TOR_FILTER),
      TorModel.distinct('category', PUBLIC_TOR_FILTER),
      listCategories({ activeOnly: true }),
    ])
  const usedCategoryKeys = new Set([...categoryKeys, ...primaryCategoryKeys])

  res.json({
    years: (years as unknown[])
      .filter((year): year is number => typeof year === 'number')
      .sort((a, b) => b - a),
    departments: distinctStrings(departments).sort((a, b) => a.localeCompare(b, 'th')),
    statuses: distinctStrings(statuses).sort((a, b) => a.localeCompare(b, 'th')),
    // Active categories in display order, limited to ones at least one TOR uses.
    categories: categories
      .filter((category) => usedCategoryKeys.has(category.key))
      .map((category) => ({ key: category.key, name: category.name })),
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

// Today's date (YYYY-MM-DD) in Thai time, comparable with `submissionDeadline`.
function todayInBangkok(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
}

// Project statuses meaning bidding is over, whatever the deadline says.
const BIDDING_CLOSED_STATUSES = ['ระหว่างดำเนินการ']

export function isBiddingClosedStatus(status: string | null | undefined): boolean {
  return !!status && BIDDING_CLOSED_STATUSES.includes(status.trim())
}

// Open TORs closing soonest first, then already-closed TORs (most recently
// closed first), then TORs with no known deadline. Ties keep newest-first order.
export function compareByDeadline(
  a: { submissionDeadline: string | null; projectStatus?: string | null },
  b: { submissionDeadline: string | null; projectStatus?: string | null },
  today: string,
): number {
  const rank = (t: { submissionDeadline: string | null; projectStatus?: string | null }) => {
    const d = t.submissionDeadline
    if (d === null) return 2
    return d >= today && !isBiddingClosedStatus(t.projectStatus) ? 0 : 1
  }
  const rankA = rank(a)
  const rankB = rank(b)
  if (rankA !== rankB) return rankA - rankB
  if (rankA === 2) return 0
  const cmp = a.submissionDeadline!.localeCompare(b.submissionDeadline!)
  return rankA === 0 ? cmp : -cmp
}

export async function listTorsHandler(req: Request, res: Response): Promise<void> {
  const q = parseStringParam(req.query.q)
  const budgetMin = parseNumberParam(req.query.budget_min)
  const budgetMax = parseNumberParam(req.query.budget_max)
  const year = parseNumberParam(req.query.year)
  const department = parseStringParam(req.query.department)
  const status = parseStringParam(req.query.status)
  const categoryParam = parseStringParam(req.query.categories)
  const page = Math.max(1, parseNumberParam(req.query.page) ?? 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseNumberParam(req.query.limit) ?? DEFAULT_LIMIT))
  const sort = parseStringParam(req.query.sort)

  const query: Record<string, unknown> = { ...PUBLIC_TOR_FILTER }
  if (q) query.projectTitle = { $regex: escapeRegex(q), $options: 'i' }
  if (categoryParam && categoryParam !== 'all') {
    const categoryKeys = categoryParam
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean)
    // TORs stored before `categories` existed only have the primary `category`.
    if (categoryKeys.length > 0) {
      query.$or = [{ categories: { $in: categoryKeys } }, { category: { $in: categoryKeys } }]
    }
  }
  if (budgetMin !== undefined || budgetMax !== undefined) {
    const budgetBaht: Record<string, number> = {}
    if (budgetMin !== undefined) budgetBaht.$gte = budgetMin
    if (budgetMax !== undefined) budgetBaht.$lte = budgetMax
    query.budgetBaht = budgetBaht
  }
  if (year !== undefined) query.fiscalYear = year
  // Options come trimmed from filter-options; stored values may carry stray whitespace.
  if (department) query.departmentName = { $regex: `^\\s*${escapeRegex(department.trim())}\\s*$` }
  if (status) query.projectStatus = { $regex: `^\\s*${escapeRegex(status.trim())}\\s*$` }

  const [docs, categoryNames] = await Promise.all([
    TorModel.find(query).sort({ createdAt: -1 }).lean(),
    getVisibleCategoryNameMap(),
  ])
  const items = docs.map((tor) => toTorListItem(tor, categoryNames))
  if (sort === 'deadline') {
    const today = todayInBangkok()
    items.sort((a, b) => compareByDeadline(a, b, today))
  }

  const total = items.length
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)
  const paged = items.slice((page - 1) * limit, (page - 1) * limit + limit)

  res.json({ items: paged, total, page, totalPages })
}

// ---------------------------------------------------------------------------
// GET /api/v1/tors/:id
// ---------------------------------------------------------------------------

export async function getTorByIdHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!isObjectIdOrHexString(id)) {
    res.status(400).json({ message: 'Invalid TOR id' })
    return
  }

  const tor = await TorModel.findById(id).lean()
  if (!tor || (tor.reviewStatus && HIDDEN_TOR_REVIEW_STATUSES.includes(tor.reviewStatus))) {
    res.status(404).json({ message: 'TOR not found' })
    return
  }

  res.json({
    id: String(tor._id),
    externalId: tor.externalId,
    sourceAdapter: tor.sourceAdapter,
    sourceVersion: tor.sourceVersion,
    detailUrl: tor.detailUrl,
    projectTitle: tor.projectTitle,
    agencyName: tor.agencyName ?? null,
    departmentName: tor.departmentName ?? null,
    departmentSubName: tor.departmentSubName ?? null,
    projectStatus: tor.projectStatus ?? null,
    contractStatus: tor.contractStatus ?? null,
    contractStatusCode: tor.contractStatusCode ?? null,
    summary: tor.summary ?? null,
    objectives: tor.objectives,
    requirements: tor.requirements,
    bidderQualifications: tor.bidderQualifications,
    technologies: tor.technologies,
    budgetBaht: tor.budgetBaht ?? null,
    midPriceBaht: tor.midPriceBaht ?? null,
    awardedPriceBaht: tor.awardedPriceBaht ?? null,
    ...deadlineFields(tor),
    contactInformation: tor.contactInformation,
    scope: tor.scope ?? null,
    deliverables: tor.deliverables ?? [],
    timeline: tor.timeline ?? [],
    evaluationCriteria: tor.evaluationCriteria ?? [],
    classificationReason: tor.classificationReason,
    confidence: tor.confidence,
    analyzedAt: tor.analyzedAt,
    documents: tor.documents,
    createdAt: tor.createdAt,
    updatedAt: tor.updatedAt,
  })
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
  const [candidates, categoryNames] = await Promise.all([
    TorModel.find(PUBLIC_TOR_FILTER).sort({ createdAt: -1 }).limit(CANDIDATE_POOL_SIZE).lean(),
    getVisibleCategoryNameMap(),
  ])

  const items = candidates
    .map((tor) => ({
      ...toTorListItem(tor, categoryNames),
      score: calculateInterestScore(tor, profile),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, RECOMMENDATION_COUNT)

  res.json({ items })
}
