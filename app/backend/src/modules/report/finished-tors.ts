import { createHash } from 'node:crypto'

import { resolveTorCategory } from '../tor/tor.controller.js'
import { PUBLIC_TOR_FILTER, TorModel } from '../tor/tor.model.js'

// Price reports, the homepage price chart and "similar projects" (UC-05) need a mid price and a
// winning (awarded) price. Both come from `tors`, the same collection as the rest of the app.
//
// Ingestion does not store awarded prices yet, so until it does, a TOR whose bidding has closed
// gets a MOCK awarded price, computed here at read time and never written to the database:
// - only TORs with a mid price whose submission day (Bangkok time) is over,
// - never a cancelled project (contractStatusCode S5), which has no winner,
// - never a TOR still open for bids: its winning price does not exist yet.
// A real awardedPriceBaht always wins over the mock. Every item says which one it carries
// (awardedIsMock) so the pages can label mock numbers.

export const CANCELLED_CONTRACT_STATUS_CODES = ['S5']

// Data changes with every ingestion run; a short cache is enough for report traffic.
const CACHE_TTL_MS = 60 * 1000

export interface FinishedTor {
  // Mongo id of the TOR, for links to /tor/:id
  id: string
  externalId: string
  projectTitle: string
  agencyName: string | null
  departmentName: string | null
  // Resolved category key (stored category, else the keyword fallback). null after
  // withVisibleCategories() when that category is hidden.
  category: string | null
  categories: string[]
  technologies: string[]
  requirements: string[]
  summary: string | null
  budgetBaht: number | null
  midPriceBaht: number
  awardedPriceBaht: number
  // true when awardedPriceBaht is the mock below, false when it came from the source
  awardedIsMock: boolean
  announceDate: Date | null
  submissionDeadlineAt: Date | null
  analyzedAt: Date | null
  detailUrl: string | null
}

export interface FinishedTorSet {
  // When the set was read from the database
  asOf: Date
  items: FinishedTor[]
}

const bangkokDay = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(date)

// Bidding is closed once the submission day (Bangkok calendar day) is over. A TOR whose
// deadline is today, or that has no deadline, still counts as open.
export function isBiddingClosed(submissionDeadlineAt: Date | null, now: Date): boolean {
  return submissionDeadlineAt !== null && bangkokDay(submissionDeadlineAt) < bangkokDay(now)
}

// Share of projects per savings band, taken from 563 real finished software projects (e-GP
// snapshot of 2026-10-04): savings % = (mid - awarded) / mid.
const MOCK_SAVINGS_BANDS: { share: number; min: number; max: number }[] = [
  { share: 0.01, min: -3, max: 0 }, // winning bid above the mid price
  { share: 0.59, min: 0, max: 5 },
  { share: 0.12, min: 5, max: 10 },
  { share: 0.07, min: 10, max: 15 },
  { share: 0.21, min: 15, max: 30 },
]

// Maps u in [0, 1] to a savings % that follows the bands above.
export function mockSavingsPct(u: number): number {
  let start = 0
  for (const band of MOCK_SAVINGS_BANDS) {
    if (u < start + band.share) {
      return band.min + ((u - start) / band.share) * (band.max - band.min)
    }
    start += band.share
  }
  return MOCK_SAVINGS_BANDS[MOCK_SAVINGS_BANDS.length - 1]!.max
}

// Deterministic mock: the same TOR always gets the same price (hash of its externalId),
// rounded to 100 baht.
export function mockAwardedPrice(externalId: string, midPriceBaht: number): number {
  const hash = createHash('md5').update(externalId).digest()
  const u = hash.readUInt32BE(0) / 0x1_0000_0000
  return Math.round((midPriceBaht * (1 - mockSavingsPct(u) / 100)) / 100) * 100
}

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : []

const asPositiveNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null

const asDate = (value: unknown): Date | null =>
  value instanceof Date && !Number.isNaN(value.getTime()) ? value : null

// A TOR becomes a FinishedTor when it has a mid price and either a real awarded price or a
// closed, not-cancelled bidding (mock awarded price). Everything else returns null.
export function toFinishedTor(doc: Record<string, unknown>, now: Date): FinishedTor | null {
  const midPriceBaht = asPositiveNumber(doc.midPriceBaht)
  const externalId = asString(doc.externalId)
  if (midPriceBaht === null || externalId === null) return null

  const submissionDeadlineAt = asDate(doc.submissionDeadlineAt)
  const realAwarded = asPositiveNumber(doc.awardedPriceBaht)
  let awardedPriceBaht: number
  let awardedIsMock: boolean
  if (realAwarded !== null) {
    awardedPriceBaht = realAwarded
    awardedIsMock = false
  } else {
    const cancelled = CANCELLED_CONTRACT_STATUS_CODES.includes(
      asString(doc.contractStatusCode) ?? '',
    )
    if (cancelled || !isBiddingClosed(submissionDeadlineAt, now)) return null
    awardedPriceBaht = mockAwardedPrice(externalId, midPriceBaht)
    awardedIsMock = true
  }

  const technologies = asStringArray(doc.technologies)
  const category = resolveTorCategory({ category: asString(doc.category), technologies })
  const categories = asStringArray(doc.categories)

  return {
    id: String(doc._id),
    externalId,
    projectTitle: asString(doc.projectTitle) ?? externalId,
    agencyName: asString(doc.agencyName),
    departmentName: asString(doc.departmentName),
    category,
    categories: categories.length > 0 ? categories : [category],
    technologies,
    requirements: asStringArray(doc.requirements),
    summary: asString(doc.summary),
    budgetBaht: asPositiveNumber(doc.budgetBaht),
    midPriceBaht,
    awardedPriceBaht,
    awardedIsMock,
    announceDate: asDate(doc.announceDate),
    submissionDeadlineAt,
    analyzedAt: asDate(doc.analyzedAt),
    detailUrl: asString(doc.detailUrl),
  }
}

const PROJECTION = {
  externalId: 1,
  projectTitle: 1,
  agencyName: 1,
  departmentName: 1,
  category: 1,
  categories: 1,
  technologies: 1,
  requirements: 1,
  summary: 1,
  budgetBaht: 1,
  midPriceBaht: 1,
  awardedPriceBaht: 1,
  contractStatusCode: 1,
  announceDate: 1,
  submissionDeadlineAt: 1,
  analyzedAt: 1,
  detailUrl: 1,
} as const

let cache: { set: FinishedTorSet; expiresAt: number } | null = null
let pending: Promise<FinishedTorSet> | null = null

async function loadFinishedTors(): Promise<FinishedTorSet> {
  const now = new Date()
  const docs = await TorModel.find(
    { ...PUBLIC_TOR_FILTER, midPriceBaht: { $gt: 0 } },
    PROJECTION,
  ).lean()
  const items = docs
    .map((doc) => toFinishedTor(doc as unknown as Record<string, unknown>, now))
    .filter((item): item is FinishedTor => item !== null)
  return { asOf: now, items }
}

// TORs with a mid and an awarded price (real or mock), read from `tors`.
export async function getFinishedTors(): Promise<FinishedTorSet> {
  if (cache && cache.expiresAt > Date.now()) return cache.set
  if (!pending) {
    pending = loadFinishedTors()
      .then((set) => {
        cache = { set, expiresAt: Date.now() + CACHE_TTL_MS }
        return set
      })
      .finally(() => {
        pending = null
      })
  }
  return pending
}

export function clearFinishedTorCache(): void {
  cache = null
}

// Where report numbers come from, sent with every report response.
export function reportSource(set: FinishedTorSet) {
  const mockCount = set.items.filter((tor) => tor.awardedIsMock).length
  return {
    collection: 'tors',
    as_of: set.asOf.toISOString(),
    project_count: set.items.length,
    mock_awarded_count: mockCount,
  }
}
