import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import { AuditLogModel } from './audit-log.model.js'
import { activityGroupOf, createAuditLog } from './audit-log.repository.js'

test('createAuditLog stores actor, action, target, and before/after snapshots', async (context) => {
  const actorId = new Types.ObjectId()
  const targetId = new Types.ObjectId()
  let capturedDocs: unknown
  let capturedOptions: unknown

  context.mock.method(AuditLogModel, 'create', async (docs: unknown[], options: unknown) => {
    capturedDocs = docs
    capturedOptions = options
    return docs
  })

  const session = { id: 'fake-session' } as never

  await createAuditLog(
    {
      actorId,
      action: 'user.role_changed',
      targetType: 'user',
      targetId,
      before: { role: 'user' },
      after: { role: 'admin' },
    },
    session,
  )

  assert.deepEqual(capturedDocs, [
    {
      actorType: 'user',
      actorId,
      action: 'user.role_changed',
      targetType: 'user',
      targetId,
      before: { role: 'user' },
      after: { role: 'admin' },
      actorName: null,
      targetLabel: null,
      metadata: null,
    },
  ])
  assert.deepEqual(capturedOptions, { session })
})

test('createAuditLog defaults missing before/after to null', async (context) => {
  let capturedDoc: Record<string, unknown> | undefined

  context.mock.method(AuditLogModel, 'create', async (docs: Record<string, unknown>[]) => {
    capturedDoc = docs[0]
    return docs
  })

  await createAuditLog({
    actorId: new Types.ObjectId(),
    action: 'tor.deleted',
    targetType: 'tor',
    targetId: new Types.ObjectId(),
  })

  assert.equal(capturedDoc?.before, null)
  assert.equal(capturedDoc?.after, null)
})

test('AuditLogModel rejects a record without an actor', async () => {
  const doc = new AuditLogModel({
    action: 'user.suspended',
    targetType: 'user',
    targetId: new Types.ObjectId(),
  })

  const error = doc.validateSync()

  assert.ok(error?.errors.actorId)
})

test('AuditLogModel accepts a system record without an actor', async () => {
  const doc = new AuditLogModel({
    actorType: 'system',
    action: 'ingestion.completed',
    targetType: 'user',
    targetId: new Types.ObjectId(),
  })

  assert.equal(doc.validateSync(), undefined)
})

test('activityGroupOf maps action prefixes to feed groups', () => {
  assert.equal(activityGroupOf('user.suspended'), 'users')
  assert.equal(activityGroupOf('ingestion.failed'), 'ingestion')
  assert.equal(activityGroupOf('tor.updated'), 'tor')
  assert.equal(activityGroupOf('settings.updated'), 'system')
  assert.equal(activityGroupOf('something.else'), null)
})
