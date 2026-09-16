import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import { enrichCentralEgpTorRecords } from './central-egp-details-backfill.js'

test('backfills central eGP TORs sequentially and continues after failures', async () => {
  const firstId = new Types.ObjectId()
  const failedId = new Types.ObjectId()
  const ignoredId = new Types.ObjectId()
  const calls: string[] = []
  const updated: string[] = []
  const errors: string[] = []

  const result = await enrichCentralEgpTorRecords(
    [
      { _id: firstId, externalId: '67119538991', sourceAdapter: 'central_egp' },
      { _id: ignoredId, externalId: '67119538992', sourceAdapter: 'bma_egp' },
      { _id: failedId, externalId: '67119538993', sourceAdapter: 'central_egp' },
    ],
    async (externalId) => {
      calls.push(externalId)
      if (externalId === '67119538993') throw new Error('unavailable')
      return {
        departmentName: 'Department',
        departmentSubName: 'Sub-department',
        projectStatus: 'Published',
        midPriceBaht: 100,
        awardedPriceBaht: null,
      }
    },
    async (id) => {
      updated.push(id.toString())
    },
    (externalId) => errors.push(externalId),
  )

  assert.deepEqual(calls, ['67119538991', '67119538993'])
  assert.deepEqual(updated, [firstId.toString()])
  assert.deepEqual(errors, ['67119538993'])
  assert.deepEqual(result, { updated: 1, failed: 1 })
})
