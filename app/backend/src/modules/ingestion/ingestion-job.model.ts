import { InferSchemaType, Schema, model } from 'mongoose'
import { number } from 'zod'

const ingestionJobSchema = new Schema(
  {
    dataSourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'DataSource',
    },

    sourceAdapter: {
      type: String,
      required: true,
      enum: ['gov_spending', 'central_egp', 'bma_egp'],
    },

    externalId: {
      type: String,
      required: true,
      trim: true,
    },

    sourceVersion: {
      type: String,
      required: true,
      default: 'latest',
    },

    status: {
      type: String,
      required: true,
      enum: ['queued', 'processing', 'completed', 'failed', 'rejected', 'review_requested'],
      default: 'queued',
    },

    currentStage: {
      type: String,
      required: true,
      enum: [
        'queued',
        'fetching_details',
        'downloading',
        'extracting_archive',
        'extracting_text',
        'classifying',
        'extracting_fields',
        'storing',
        'completed',
      ],
      default: 'queued',
    },

    attempCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    nextRetryAt: {
      type: Date,
      default: Date.now,
    },

    lockedBy: {
      type: String,
      default: null,
    },

    lockedUntil: {
      type: Date,
      default: null,
    },

    torId: {
      type: Schema.Types.ObjectId,
      ref: 'Tor',
    },

    lastError: {
      code: String,
      message: String,
      occurredAt: Date,
    },
  },
  {
    timestamps: true,
    collection: 'ingestion_jobs',
  },
)

// Set of Primary Key
ingestionJobSchema.index(
  {
    dataSourceId: 1,
    externalId: 1,
    sourceVersion: 1,
  },
  {
    unique: true,
  },
)

ingestionJobSchema.index({
  status: 1,
  nextRetryAt: 1,
  lockedUntil: 1,
})

export type IngestionJob = InferSchemaType<typeof ingestionJobSchema>

export const IngestionJobModel = model('IngestionJob', ingestionJobSchema)
