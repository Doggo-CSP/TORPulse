import assert from 'node:assert/strict'
import test from 'node:test'

import { getThaiFiscalYear } from '../../modules/ingestion/adapters/govspending-discovery.adapter.js'

test('calculates the Thai fiscal year across the October boundary', () => {
  assert.equal(getThaiFiscalYear(new Date('2026-09-30T23:59:59Z')), 2569)
  assert.equal(getThaiFiscalYear(new Date('2026-10-01T00:00:00Z')), 2570)
})
