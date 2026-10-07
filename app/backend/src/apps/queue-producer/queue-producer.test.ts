import assert from 'node:assert/strict'
import test from 'node:test'

import { SettingsModel } from '../../modules/admin/settings.model.js'
import { DataSourceModel } from '../../modules/ingestion/data-source.model.js'
import { ensureBmaDataSource } from '../../modules/ingestion/data-source.repository.js'
import { getThaiFiscalYear } from '../../modules/ingestion/thai-date.js'
import { runScheduledSync } from './queue-producer.js'

test('calculates the Thai fiscal year across the October boundary', () => {
  assert.equal(getThaiFiscalYear(new Date('2026-09-30T23:59:59Z')), 2569)
  assert.equal(getThaiFiscalYear(new Date('2026-10-01T00:00:00Z')), 2570)
})

test('a scheduled sync is skipped when automatic ingestion is turned off', async (context) => {
  context.mock.method(SettingsModel, 'findOne', () => ({
    session: () => ({ lean: async () => ({ ingestionEnabled: false }) }),
  }))
  const ensureDataSource = context.mock.method(DataSourceModel, 'findOneAndUpdate', () => {
    throw new Error('the lease must not be touched')
  })

  await runScheduledSync(
    {
      label: 'BMA',
      ensureDataSource: ensureBmaDataSource,
      sync: async () => {
        throw new Error('the sync must not run')
      },
    },
    'test-producer',
    new AbortController().signal,
  )

  assert.equal(ensureDataSource.mock.callCount(), 0)
})
