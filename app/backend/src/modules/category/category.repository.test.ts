import assert from 'node:assert/strict'
import test from 'node:test'

import { CATEGORY_SEED } from './category.constants.js'
import { CategoryModel } from './category.model.js'
import {
  clearCategoryCatalogCache,
  getCategoryCatalog,
  normalizeCategories,
} from './category.repository.js'

const KEYS = CATEGORY_SEED.map(({ key }) => key)

test('caches the active category catalog', async (context) => {
  clearCategoryCatalogCache()
  const find = context.mock.method(CategoryModel, 'find', () => ({
    sort: () => ({
      lean: async () => [{ ...CATEGORY_SEED[0], isActive: true, sortOrder: 1 }],
    }),
  }))

  const first = await getCategoryCatalog(1_000)
  const second = await getCategoryCatalog(2_000)
  await getCategoryCatalog(1_000 + 61_000)

  assert.equal(first[0]?.key, 'web_application')
  assert.equal(first[0]?.aiHint, CATEGORY_SEED[0]?.aiHint)
  assert.equal(second, first)
  assert.equal(find.mock.callCount(), 2)
  clearCategoryCatalogCache()
})

test('normalizes classifier categories to known keys with the primary first', () => {
  assert.deepEqual(
    normalizeCategories(
      {
        primaryCategory: 'Cloud_Infrastructure',
        categories: ['web_application', 'unknown', 'cloud_infrastructure', 'web_application'],
      },
      KEYS,
    ),
    { category: 'cloud_infrastructure', categories: ['cloud_infrastructure', 'web_application'] },
  )
  assert.deepEqual(
    normalizeCategories(
      { primaryCategory: 'blockchain', categories: ['unknown', 'data_bi'] },
      KEYS,
    ),
    { category: 'data_bi', categories: ['data_bi'] },
  )
  assert.deepEqual(normalizeCategories({ primaryCategory: null, categories: [] }, KEYS), {
    category: null,
    categories: [],
  })
})
