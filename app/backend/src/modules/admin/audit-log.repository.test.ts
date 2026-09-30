import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import { AuditLogModel } from './audit-log.model.js'
import { createAuditLog } from './audit-log.repository.js'

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
      action: 'user.role.update',
      targetType: 'user',
      targetId,
      before: { role: 'user' },
      after: { role: 'editor' },
    },
    session,
  )

  assert.deepEqual(capturedDocs, [
    {
      actorId,
      action: 'user.role.update',
      targetType: 'user',
      targetId,
      before: { role: 'user' },
      after: { role: 'editor' },
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
    action: 'tor.delete',
    targetType: 'tor',
    targetId: new Types.ObjectId(),
  })

  assert.equal(capturedDoc?.before, null)
  assert.equal(capturedDoc?.after, null)
})

test('AuditLogModel rejects a record without an actor', async () => {
  const doc = new AuditLogModel({
    action: 'user.status.update',
    targetType: 'user',
    targetId: new Types.ObjectId(),
  })

  const error = doc.validateSync()

  assert.ok(error?.errors.actorId)
})
