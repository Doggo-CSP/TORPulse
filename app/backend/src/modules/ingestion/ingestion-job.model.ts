import { InferSchemaType, Schema, model } from 'mongoose'

// Project metadata from GovSpending, refreshed on every producer sync.
const sourceMetadataSchema = new Schema(
  {
    title: { type: String, default: null },
    departmentName: { type: String, default: null },
    departmentSubName: { type: String, default: null },
    projectStatus: { type: String, default: null },
    fiscalYear: { type: Number, default: null },
    announceDate: { type: Date, default: null },
    budgetBaht: { type: Number, min: 0, default: null },
    midPriceBaht: { type: Number, min: 0, default: null },
    awardedPriceBaht: { type: Number, min: 0, default: null },
    biddingMethod: { type: String, default: null },
  },
  { _id: false },
)

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
      enum: [
        'queued',
        'processing',
        'completed',
        'failed',
        'rejected',
        'review_required',
        'skipped',
      ],
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

    sourceMetadata: {
      type: sourceMetadataSchema,
      default: null,
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
