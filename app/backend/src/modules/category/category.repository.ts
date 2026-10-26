import { randomBytes } from 'node:crypto'

import type { ClientSession } from 'mongoose'

import { User } from '../auth/user.model.js'
import { CategoryModel } from './category.model.js'

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Trims each keyword, drops blanks, and removes duplicates case-insensitively (first spelling wins).
export function normalizeKeywords(keywords: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of keywords) {
    const keyword = raw.trim().replace(/\s+/g, ' ')
    const folded = keyword.toLowerCase()
    if (!keyword || seen.has(folded)) continue
    seen.add(folded)
    result.push(keyword)
  }
  return result
}

// snake_case from an English name ("Data Science" -> "data_science"); any name with non-English
// characters (Thai, even mixed with English) gets "category_" plus a short random code, so the
// key never keeps only part of the name.
export function keyCandidateFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const englishOnly = /^[\x20-\x7e]*$/.test(name) && /[a-z]/.test(slug)
  return englishOnly ? slug : `category_${randomBytes(3).toString('hex')}`
}

export async function generateCategoryKey(name: string, session?: ClientSession): Promise<string> {
  let candidate = keyCandidateFromName(name)
  while (await CategoryModel.exists({ key: candidate }).session(session ?? null)) {
    candidate = `category_${randomBytes(3).toString('hex')}`
  }
  return candidate
}

export async function listCategories(options: { search?: string; activeOnly?: boolean } = {}) {
  const filter: Record<string, unknown> = {}
  if (options.activeOnly) filter.isActive = true
  if (options.search?.trim()) {
    const regex = new RegExp(escapeRegex(options.search.trim()), 'i')
    filter.$or = [{ name: regex }, { description: regex }, { keywords: regex }]
  }
  return CategoryModel.find(filter).sort({ sortOrder: 1, name: 1 }).lean()
}

// key -> name for every category, hidden ones included, so existing TORs keep their label.
export async function getCategoryNameMap(): Promise<Map<string, string>> {
  const categories = await CategoryModel.find({}, { key: 1, name: 1 }).lean()
  return new Map(categories.map((category) => [category.key, category.name]))
}

// key -> name for active categories only. Use this for anything users see: a hidden category
// is a soft delete for them (admin pages keep using getCategoryNameMap).
export async function getVisibleCategoryNameMap(): Promise<Map<string, string>> {
  const categories = await CategoryModel.find({ isActive: true }, { key: 1, name: 1 }).lean()
  return new Map(categories.map((category) => [category.key, category.name]))
}

export async function getActiveCategoryKeys(): Promise<Set<string>> {
  const categories = await CategoryModel.find({ isActive: true }, { key: 1 }).lean()
  return new Set(categories.map((category) => category.key))
}

// key -> number of users who picked that category as an interest.
export async function countUsersByCategory(): Promise<Map<string, number>> {
  const rows = await User.aggregate<{ _id: string; count: number }>([
    { $unwind: '$interests' },
    { $group: { _id: '$interests', count: { $sum: 1 } } },
  ])
  return new Map(rows.map((row) => [row._id, row.count]))
}

export async function nextCategorySortOrder(session?: ClientSession): Promise<number> {
  const last = await CategoryModel.findOne({}, { sortOrder: 1 })
    .sort({ sortOrder: -1 })
    .session(session ?? null)
    .lean()
  return (last?.sortOrder ?? 0) + 1
}

// ---------------------------------------------------------------------------
// AI classifier catalog
// ---------------------------------------------------------------------------

export interface CategoryItem {
  key: string
  name: string
  description: string
  aiHint: string | null
  sortOrder: number
}

const CATALOG_CACHE_TTL_MS = 60_000

let catalogCache: { items: CategoryItem[]; expiresAt: number } | null = null

/**
 * Active categories with a short in-process cache. Used on hot paths
 * (every ingestion job).
 */
export async function getCategoryCatalog(now = Date.now()): Promise<CategoryItem[]> {
  if (catalogCache && catalogCache.expiresAt > now) {
    return catalogCache.items
  }

  const rows = await listCategories({ activeOnly: true })
  const items = rows.map((row) => ({
    key: row.key,
    name: row.name,
    description: row.description ?? '',
    aiHint: row.aiHint ?? null,
    sortOrder: row.sortOrder,
  }))
  catalogCache = { items, expiresAt: now + CATALOG_CACHE_TTL_MS }
  return items
}

export function clearCategoryCatalogCache(): void {
  catalogCache = null
}

/**
 * Keep only known category keys from the classifier output. The primary
 * falls back to the first valid key and is always first in `categories`.
 */
export function normalizeCategories(
  result: { primaryCategory: string | null; categories: string[] },
  validKeys: Iterable<string>,
): { category: string | null; categories: string[] } {
  const known = new Set(validKeys)
  const clean = (value: string | null | undefined) => value?.trim().toLowerCase() ?? ''

  const categories = [...new Set(result.categories.map(clean))].filter((key) => known.has(key))
  const primary = clean(result.primaryCategory)
  const category = known.has(primary) ? primary : (categories[0] ?? null)

  if (category === null) {
    return { category: null, categories: [] }
  }

  return { category, categories: [category, ...categories.filter((key) => key !== category)] }
}
