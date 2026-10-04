import assert from 'node:assert/strict'
import test from 'node:test'

import { planTorEditStamp, planUserFix } from './migrate-legacy-data.js'

test('planUserFix turns pending into active and editor into user', () => {
  assert.deepEqual(planUserFix({ status: 'pending', role: 'user' }), { status: 'active' })
  assert.deepEqual(planUserFix({ status: 'active', role: 'editor' }), { role: 'user' })
  assert.deepEqual(planUserFix({ status: 'pending', role: 'editor' }), {
    status: 'active',
    role: 'user',
  })
})

test('planUserFix leaves current values alone', () => {
  assert.equal(planUserFix({ status: 'active', role: 'admin' }), null)
  assert.equal(planUserFix({ status: 'suspended', role: 'user' }), null)
  assert.equal(planUserFix({}), null)
})

test('planTorEditStamp only stamps TORs without lastEditedAt', () => {
  const editedAt = new Date('2026-09-20T10:00:00Z')

  assert.equal(planTorEditStamp({ lastEditedAt: null }, editedAt), editedAt)
  assert.equal(planTorEditStamp({}, editedAt), editedAt)
  assert.equal(planTorEditStamp({ lastEditedAt: new Date() }, editedAt), null)
})
