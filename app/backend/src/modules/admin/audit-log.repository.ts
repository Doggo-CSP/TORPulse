import type { ClientSession } from 'mongoose'

import { AuditLogModel } from './audit-log.model.js'
import type { CreateAuditLogInput } from './admin.types.js'

export async function createAuditLog(input: CreateAuditLogInput, session?: ClientSession) {
  const [log] = await AuditLogModel.create(
    [
      {
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        before: input.before ?? null,
        after: input.after ?? null,
      },
    ],
    { session },
  )
  return log
}

export async function listRecentAuditLogs(limit: number) {
  return AuditLogModel.find().sort({ createdAt: -1 }).limit(limit).lean()
}
