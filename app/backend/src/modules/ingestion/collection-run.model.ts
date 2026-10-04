import { InferSchemaType, Schema, model } from 'mongoose'

// One document per e-GP sync run, scheduled (queue-producer) or started from the admin panel.
const collectionRunSchema = new Schema(
  {
    trigger: {
      type: String,
      required: true,
      enum: ['scheduled', 'manual'],
    },
    triggeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ['running', 'success', 'failed'],
      default: 'running',
    },
    startedAt: {
      type: Date,
      required: true,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
    fetchedCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    createdCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    // Projects found again that were already known (queued or processed earlier)
    existingCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'collection_runs',
  },
)

collectionRunSchema.index({ startedAt: -1 })
collectionRunSchema.index({ status: 1 })

export type CollectionRun = InferSchemaType<typeof collectionRunSchema>

export const CollectionRunModel = model('CollectionRun', collectionRunSchema)
