import { InferSchemaType, Schema, model } from 'mongoose'

const auditLogSchema = new Schema(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    targetType: {
      type: String,
      required: true,
      trim: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    before: {
      type: Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'audit_logs',
  },
)

auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 })

export type AuditLog = InferSchemaType<typeof auditLogSchema>

export const AuditLogModel = model('AuditLog', auditLogSchema)
