import assert from 'node:assert/strict'
import test from 'node:test'

import { CategoryModel } from './category.model.js'
import { DEFAULT_CATEGORIES } from './category.defaults.js'
import {
  clearCategoryCatalogCache,
  ensureDefaultCategories,
  getCategoryCatalog,
  normalizeCategories,
} from './category.repository.js'

const KEYS = DEFAULT_CATEGORIES.map(({ key }) => key)

test('seeds defaults without overwriting existing categories', async (context) => {
  let operations: Array<{ updateOne: { update: Record<string, unknown>; upsert: boolean } }> = []
  context.mock.method(CategoryModel, 'bulkWrite', async (ops: typeof operations) => {
    operations = ops
    return { upsertedCount: 0 }
  })

  await ensureDefaultCategories()

  assert.equal(operations.length, 8)
  for (const { updateOne } of operations) {
    assert.deepEqual(Object.keys(updateOne.update), ['$setOnInsert'])
    assert.equal(updateOne.upsert, true)
  }
})

test('caches the active category catalog', async (context) => {
  clearCategoryCatalogCache()
  const find = context.mock.method(CategoryModel, 'find', () => ({
    select: () => ({
      sort: () => ({
        lean: () => ({ exec: async () => [{ ...DEFAULT_CATEGORIES[0] }] }),
      }),
    }),
  }))

  const first = await getCategoryCatalog(1_000)
  const second = await getCategoryCatalog(2_000)
  await getCategoryCatalog(1_000 + 61_000)

  assert.equal(first[0]?.key, 'web')
  assert.equal(second, first)
  assert.equal(find.mock.callCount(), 2)
  clearCategoryCatalogCache()
})

test('normalizes classifier categories to known keys with the primary first', () => {
  assert.deepEqual(
    normalizeCategories(
      { primaryCategory: 'Cloud', categories: ['web', 'unknown', 'cloud', 'web'] },
      KEYS,
    ),
    { category: 'cloud', categories: ['cloud', 'web'] },
  )
  assert.deepEqual(
    normalizeCategories({ primaryCategory: 'blockchain', categories: ['unknown', 'data'] }, KEYS),
    { category: 'data', categories: ['data'] },
  )
  assert.deepEqual(normalizeCategories({ primaryCategory: null, categories: [] }, KEYS), {
    category: null,
    categories: [],
  })
})
