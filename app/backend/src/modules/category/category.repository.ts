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
