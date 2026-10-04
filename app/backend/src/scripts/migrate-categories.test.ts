import assert from 'node:assert/strict'
import test from 'node:test'

import { LEGACY_INTEREST_IDS } from '../modules/category/category.constants.js'
import {
  deriveOldCategory,
  mapInterests,
  mapLegacyTorCategories,
  planTorCategory,
} from './migrate-categories.js'

const KEYS = new Set(Object.values(LEGACY_INTEREST_IDS))

test('deriveOldCategory keeps the pre-change 5-category rules', () => {
  assert.equal(deriveOldCategory(['Machine Learning']), 'data_bi')
  assert.equal(deriveOldCategory(['AWS']), 'enterprise_system')
  assert.equal(deriveOldCategory(['React']), 'web_application')
})

test('planTorCategory skips TORs an admin edited, verified, or overrode', () => {
  assert.deepEqual(planTorCategory({ categoryOverridden: true, technologies: ['AWS'] }), {
    type: 'skip',
    reason: 'overridden',
  })
  assert.deepEqual(planTorCategory({ lastEditedAt: new Date(), technologies: ['AWS'] }), {
    type: 'skip',
    reason: 'edited',
  })
  assert.deepEqual(planTorCategory({ reviewStatus: 'verified', technologies: ['AWS'] }), {
    type: 'skip',
    reason: 'verified',
  })
})

test('planTorCategory reports old -> new moves using the old rules when nothing is stored', () => {
  assert.deepEqual(planTorCategory({ category: null, technologies: ['Machine Learning'] }), {
    type: 'update',
    from: 'data_bi',
    to: 'ai_ml',
  })
  assert.deepEqual(planTorCategory({ technologies: ['AWS'] }), {
    type: 'update',
    from: 'enterprise_system',
    to: 'cloud_infrastructure',
  })
})

test('planTorCategory stores a missing category even when it does not move', () => {
  assert.deepEqual(planTorCategory({ technologies: ['React'] }), {
    type: 'update',
    from: 'web_application',
    to: 'web_application',
  })
  assert.deepEqual(planTorCategory({ category: 'web_application', technologies: ['React'] }), {
    type: 'unchanged',
    category: 'web_application',
  })
})

test('mapInterests maps legacy profile ids to category keys and de-duplicates', () => {
  assert.deepEqual(mapInterests(['web', 'ai', 'web_application'], KEYS), {
    mapped: ['web_application', 'ai_ml'],
    unmapped: [],
    changed: true,
  })
  assert.deepEqual(mapInterests(['data_bi'], KEYS), {
    mapped: ['data_bi'],
    unmapped: [],
    changed: false,
  })
})

test('mapInterests reports unknown values instead of dropping them', () => {
  const result = mapInterests(['web', 'blockchain'], KEYS)

  assert.deepEqual(result.unmapped, ['blockchain'])
  assert.equal(result.changed, false)
})

test('mapLegacyTorCategories renames legacy TOR keys and keeps the AI choice', () => {
  assert.deepEqual(mapLegacyTorCategories({ category: 'ai', categories: ['ai', 'cloud', 'web'] }), {
    category: 'ai_ml',
    categories: ['ai_ml', 'cloud_infrastructure', 'web_application'],
  })
  assert.deepEqual(mapLegacyTorCategories({ category: 'cybersecurity', categories: ['data'] }), {
    category: 'cybersecurity',
    categories: ['data_bi'],
  })
  assert.equal(
    mapLegacyTorCategories({ category: 'web_application', categories: ['web_application'] }),
    null,
  )
  assert.equal(mapLegacyTorCategories({ category: null, categories: [] }), null)
})
