import { Types } from 'mongoose'

export interface CreateAuditLogInput {
  actorId: Types.ObjectId
  action: string
  targetType: string
  targetId: Types.ObjectId
  before?: unknown
  after?: unknown
}

export type UserChangeOutcome = 'updated' | 'not_found' | 'self' | 'last_admin' | 'unchanged'

export type TorChangeOutcome = 'updated' | 'not_found' | 'deleted' | 'invalid_transition'
