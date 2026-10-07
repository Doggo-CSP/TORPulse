import { Types } from 'mongoose'

export interface CreateAuditLogInput {
  // Omit actorId and set actorType 'system' for automatic actions
  actorType?: 'user' | 'system'
  actorId?: Types.ObjectId | null
  action: string
  targetType: string
  targetId: Types.ObjectId
  before?: unknown
  after?: unknown
  actorName?: string | null
  targetLabel?: string | null
  metadata?: Record<string, unknown> | null
}

export const ACTIVITY_GROUPS = ['users', 'ingestion', 'tor', 'system'] as const
export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number]

export interface SystemSettings {
  ingestionEnabled: boolean
  senderEmail: string | null
}

export type UpdateSettingsInput = Partial<SystemSettings>

export type UserChangeOutcome = 'updated' | 'not_found' | 'self' | 'last_admin' | 'unchanged'

export type TorChangeOutcome = 'updated' | 'not_found' | 'deleted' | 'invalid_transition'

export type CategoryChangeOutcome =
  | 'updated'
  | 'not_found'
  | 'unchanged'
  | 'duplicate_name'
  | 'duplicate_key'
  | 'in_use'
  | 'default_category'
