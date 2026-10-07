import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import { enrichBmaTorRecords } from './bma-details-backfill.js'

const details = {
  sourceProjectId: 'c41de67f-393f-4238-8cd3-430e2c1d9cdd',
  midPriceBaht: 2370000,
  contractStatus: 'ระหว่างดำเนินการ',
  contractStatusCode: 'S1',
}

test('backfills BMA TORs and counts missing and failed projects', async () => {
  const foundId = new Types.ObjectId()
  const calls: string[] = []
  const updated: string[] = []
  const errors: string[] = []

  const result = await enrichBmaTorRecords(
    [
      { _id: foundId, externalId: '69099318566', sourceAdapter: 'bma_egp' },
      { _id: new Types.ObjectId(), externalId: '67119538992', sourceAdapter: 'central_egp' },
      { _id: new Types.ObjectId(), externalId: '69099318567', sourceAdapter: 'bma_egp' },
      { _id: new Types.ObjectId(), externalId: '69099318568', sourceAdapter: 'bma_egp' },
    ],
    async (externalId) => {
      calls.push(externalId)
      if (externalId === '69099318567') return null
      if (externalId === '69099318568') throw new Error('unavailable')
      return details
    },
    async (record, loaded) => {
      assert.deepEqual(loaded, details)
      updated.push(record._id.toString())
    },
    (externalId) => errors.push(externalId),
  )

  assert.deepEqual(calls, ['69099318566', '69099318567', '69099318568'])
  assert.deepEqual(updated, [foundId.toString()])
  assert.deepEqual(errors, ['69099318568'])
  assert.deepEqual(result, { updated: 1, notFound: 1, failed: 1 })
})
