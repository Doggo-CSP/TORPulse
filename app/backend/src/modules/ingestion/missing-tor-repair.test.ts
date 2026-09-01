import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import { selectMissingTorJobIds } from './missing-tor-repair.js'

test('selects only completed references whose TOR is absent', () => {
  const existingTorId = new Types.ObjectId()
  const missingTorId = new Types.ObjectId()
  const validJobId = new Types.ObjectId()
  const missingJobId = new Types.ObjectId()
  const emptyJobId = new Types.ObjectId()

  const result = selectMissingTorJobIds(
    [
      { _id: validJobId, torId: existingTorId },
      { _id: missingJobId, torId: missingTorId },
      { _id: emptyJobId },
    ],
    [existingTorId],
  )

  assert.deepEqual(result, [missingJobId, emptyJobId])
})
