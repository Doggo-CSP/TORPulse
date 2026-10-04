import type { ClientSession } from 'mongoose'

import { AuditLogModel } from './audit-log.model.js'
import type { ActivityGroup, CreateAuditLogInput } from './admin.types.js'

export async function createAuditLog(input: CreateAuditLogInput, session?: ClientSession) {
  const [log] = await AuditLogModel.create(
    [
      {
        actorType: input.actorType ?? 'user',
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        before: input.before ?? null,
        after: input.after ?? null,
        actorName: input.actorName ?? null,
        targetLabel: input.targetLabel ?? null,
        metadata: input.metadata ?? null,
      },
    ],
    { session },
  )
  return log
}

// The feed group is the action prefix: user.* -> users, settings.* and category.* -> system,
// and so on.
const GROUP_ACTION_PATTERNS: Record<ActivityGroup, RegExp> = {
  users: /^user\./,
  ingestion: /^ingestion\./,
  tor: /^tor\./,
  system: /^(settings|category)\./,
}

export function activityGroupOf(action: string): ActivityGroup | null {
  const match = (Object.entries(GROUP_ACTION_PATTERNS) as [ActivityGroup, RegExp][]).find(
    ([, pattern]) => pattern.test(action),
  )
  return match ? match[0] : null
}

// Audit logs grow without bound, so this pages in the database rather than in memory.
export async function listAuditLogs(options: {
  group?: ActivityGroup
  page: number
  limit: number
}) {
  const filter = options.group ? { action: { $regex: GROUP_ACTION_PATTERNS[options.group] } } : {}

  const [items, total] = await Promise.all([
    AuditLogModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .lean(),
    AuditLogModel.countDocuments(filter),
  ])

  return { items, total }
}
