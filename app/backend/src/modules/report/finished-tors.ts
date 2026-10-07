import mongoose from 'mongoose'

import { resolveTorCategory } from '../tor/tor.controller.js'

// Finished projects (contract signed, mid and awarded prices known) are not in `tors`, which
// holds the TORs still open for bidding. They live in dated snapshot collections named
// `tors_bk_YYYYMMDD`. Reports, homepage price charts and "similar past projects" read the
// newest snapshot.
//
// The snapshots are read-only: this module only lists collections and runs find(). Never add a
// write here.

export const FINISHED_SNAPSHOT_PATTERN = /^tors_bk_(\d{4})(\d{2})(\d{2})$/

// The data is a periodic snapshot used for trends, so a short in-process cache is enough.
const CACHE_TTL_MS = 30 * 60 * 1000

export interface FinishedTor {
  externalId: string
  projectTitle: string
  agencyName: string | null
  departmentName: string | null
  // Resolved category key (stored category, else the keyword fallback)
  category: string
  categories: string[]
  technologies: string[]
  requirements: string[]
  summary: string | null
  budgetBaht: number | null
  midPriceBaht: number
  awardedPriceBaht: number
  announceDate: Date | null
  analyzedAt: Date | null
  detailUrl: string | null
}

export interface FinishedTorSnapshot {
  collection: string
  // YYYY-MM-DD from the collection name
  snapshotDate: string
  items: FinishedTor[]
}

// Newest `tors_bk_YYYYMMDD` name, or null. The undated `tors_bk` is an old export and is skipped.
export function pickLatestSnapshot(
  collectionNames: string[],
): { collection: string; snapshotDate: string } | null {
  const dated = collectionNames
    .map((name) => ({ name, match: FINISHED_SNAPSHOT_PATTERN.exec(name) }))
    .filter((entry): entry is { name: string; match: RegExpExecArray } => entry.match !== null)
    .sort((a, b) => b.name.localeCompare(a.name))

  const latest = dated[0]
  if (!latest) return null
  const [, year, month, day] = latest.match
  return { collection: latest.name, snapshotDate: `${year}-${month}-${day}` }
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

// A snapshot document becomes a FinishedTor only when both prices are known; projects still
// open for bidding in a snapshot have no awarded price and are left out.
export function toFinishedTor(doc: Record<string, unknown>): FinishedTor | null {
  const midPriceBaht = asPositiveNumber(doc.midPriceBaht)
  const awardedPriceBaht = asPositiveNumber(doc.awardedPriceBaht)
  const externalId = asString(doc.externalId)
  if (midPriceBaht === null || awardedPriceBaht === null || externalId === null) return null

  const technologies = asStringArray(doc.technologies)
  const category = resolveTorCategory({ category: asString(doc.category), technologies })
  const categories = asStringArray(doc.categories)

  return {
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
    announceDate: asDate(doc.announceDate),
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
  announceDate: 1,
  analyzedAt: 1,
  detailUrl: 1,
} as const

let cache: { snapshot: FinishedTorSnapshot | null; expiresAt: number } | null = null
let pending: Promise<FinishedTorSnapshot | null> | null = null

async function loadSnapshot(): Promise<FinishedTorSnapshot | null> {
  const db = mongoose.connection.db
  if (!db) throw new Error('MongoDB is not connected')

  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name)
  const latest = pickLatestSnapshot(names)
  if (!latest) return null

  const docs = await db
    .collection(latest.collection)
    .find({ midPriceBaht: { $gt: 0 }, awardedPriceBaht: { $gt: 0 } }, { projection: PROJECTION })
    .toArray()

  const items = docs
    .map((doc) => toFinishedTor(doc as Record<string, unknown>))
    .filter((item): item is FinishedTor => item !== null)

  return { ...latest, items }
}

// The newest snapshot of finished projects, or null when the database has none.
export async function getFinishedTorSnapshot(): Promise<FinishedTorSnapshot | null> {
  if (cache && cache.expiresAt > Date.now()) return cache.snapshot
  if (!pending) {
    pending = loadSnapshot()
      .then((snapshot) => {
        cache = { snapshot, expiresAt: Date.now() + CACHE_TTL_MS }
        return snapshot
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

// Summary of where report numbers come from, sent with every report response.
export function snapshotSource(snapshot: FinishedTorSnapshot | null) {
  return snapshot
    ? {
        collection: snapshot.collection,
        snapshot_date: snapshot.snapshotDate,
        project_count: snapshot.items.length,
      }
    : null
}
