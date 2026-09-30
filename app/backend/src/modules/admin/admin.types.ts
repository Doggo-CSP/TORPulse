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
}

export interface SystemSettings {
  ingestionEnabled: boolean
  autoApproveGovEmails: boolean
  senderEmail: string | null
}

export type UpdateSettingsInput = Partial<SystemSettings>

export type UserChangeOutcome = 'updated' | 'not_found' | 'self' | 'last_admin' | 'unchanged'

export type TorChangeOutcome = 'updated' | 'not_found' | 'deleted' | 'invalid_transition'
