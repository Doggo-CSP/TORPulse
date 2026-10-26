import { InferSchemaType, Schema, model } from 'mongoose'

const auditLogSchema = new Schema(
  {
    // 'system' is used for automatic actions (auto-approval, scheduled ingestion runs)
    actorType: {
      type: String,
      required: true,
      enum: ['user', 'system'],
      default: 'user',
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      required: function (this: { actorType?: string }) {
        return this.actorType !== 'system'
      },
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
    // Snapshots taken when the log is written, so the feed needs no joins and still shows
    // the name at the time even if the user or TOR is renamed later.
    actorName: {
      type: String,
      default: null,
    },
    targetLabel: {
      type: String,
      default: null,
    },
    // Extra details for the feed text (e.g. ingestion counts, auto-approval reason)
    metadata: {
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
auditLogSchema.index({ createdAt: -1 })

export type AuditLog = InferSchemaType<typeof auditLogSchema>

export const AuditLogModel = model('AuditLog', auditLogSchema)
