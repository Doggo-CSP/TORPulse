import { CategoryModel } from './category.model.js'
import { DEFAULT_CATEGORIES } from './category.defaults.js'

export interface CategoryItem {
  key: string
  name: string
  description: string
  aiHint: string | null
  order: number
}

const CATALOG_CACHE_TTL_MS = 60_000

let catalogCache: { items: CategoryItem[]; expiresAt: number } | null = null

/**
 * Insert the default categories that do not exist yet. Existing rows are
 * never touched, so edits made from the manage menu survive restarts.
 */
export async function ensureDefaultCategories(): Promise<{ inserted: number }> {
  const result = await CategoryModel.bulkWrite(
    DEFAULT_CATEGORIES.map((category) => ({
      updateOne: {
        filter: { key: category.key },
        update: { $setOnInsert: { ...category, active: true } },
        upsert: true,
      },
    })),
    { ordered: false },
  )

  if (result.upsertedCount > 0) {
    clearCategoryCatalogCache()
  }

  return { inserted: result.upsertedCount }
}

export async function listCategories(
  options: { activeOnly?: boolean } = {},
): Promise<CategoryItem[]> {
  const filter = options.activeOnly === false ? {} : { active: true }
  const rows = await CategoryModel.find(filter)
    .select({ key: 1, name: 1, description: 1, aiHint: 1, order: 1 })
    .sort({ order: 1, key: 1 })
    .lean()
    .exec()

  return rows.map((row) => ({
    key: row.key,
    name: row.name,
    description: row.description,
    aiHint: row.aiHint ?? null,
    order: row.order,
  }))
}

/**
 * Active categories with a short in-process cache. Used on hot paths
 * (every ingestion job, every report request).
 */
export async function getCategoryCatalog(now = Date.now()): Promise<CategoryItem[]> {
  if (catalogCache && catalogCache.expiresAt > now) {
    return catalogCache.items
  }

  const items = await listCategories({ activeOnly: true })
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
