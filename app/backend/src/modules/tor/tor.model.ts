import { InferSchemaType, Schema, model } from 'mongoose'

export const TOR_REVIEW_STATUSES = ['unverified', 'verified', 'archived', 'deleted'] as const
export type TorReviewStatus = (typeof TOR_REVIEW_STATUSES)[number]

// Archived and soft-deleted TORs stay in the database but are hidden from public endpoints.
// Records created before reviewStatus existed have no value and stay visible.
export const HIDDEN_TOR_REVIEW_STATUSES: TorReviewStatus[] = ['archived', 'deleted']
export const PUBLIC_TOR_FILTER = { reviewStatus: { $nin: HIDDEN_TOR_REVIEW_STATUSES } }

const sourceDocumentSchema = new Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    sourceUrl: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
)

const torSchema = new Schema(
  {
    dataSourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'DataSource',
    },
    ingestionJobId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'IngestionJob',
      index: true,
    },
    externalId: {
      type: String,
      required: true,
      trim: true,
    },
    sourceVersion: {
      type: String,
      required: true,
      trim: true,
    },
    sourceAdapter: {
      type: String,
      required: true,
      enum: ['gov_spending', 'central_egp', 'bma_egp'],
    },
    detailUrl: {
      type: String,
      required: true,
      trim: true,
    },
    projectTitle: {
      type: String,
      required: true,
      trim: true,
    },
    agencyName: {
      type: String,
      default: null,
    },
    departmentName: {
      type: String,
      default: null,
    },
    departmentSubName: {
      type: String,
      default: null,
    },
    projectStatus: {
      type: String,
      default: null,
    },
    fiscalYear: {
      type: Number,
      default: null,
    },
    biddingMethod: {
      type: String,
      default: null,
    },
    announceDate: {
      type: Date,
      default: null,
    },
    summary: {
      type: String,
      default: null,
    },
    objectives: {
      type: [String],
      required: true,
      default: [],
    },
    requirements: {
      type: [String],
      required: true,
      default: [],
    },
    bidderQualifications: {
      type: [String],
      required: true,
      default: [],
    },
    technologies: {
      type: [String],
      required: true,
      default: [],
    },
    // Keys of the categories collection, set by the AI classifier or an admin override. Checked
    // by the admin API, not by an enum, because admins can add categories.
    category: {
      type: String,
      default: null,
      index: true,
    },
    categories: {
      type: [String],
      required: true,
      default: [],
      index: true,
    },
    budgetBaht: {
      type: Number,
      min: 0,
      default: null,
    },
    midPriceBaht: {
      type: Number,
      min: 0,
      default: null,
      alias: 'referencePriceBaht',
    },
    awardedPriceBaht: {
      type: Number,
      min: 0,
      default: null,
      alias: 'winningPriceBaht',
    },
    // Raw deadline text from the TOR, as the AI returned it.
    submissionDeadline: {
      type: String,
      default: null,
    },
    // submissionDeadline parsed to a date (midnight UTC); null when no exact day.
    submissionDeadlineAt: {
      type: Date,
      default: null,
    },
    scope: {
      type: String,
      default: null,
    },
    deliverables: {
      type: [String],
      required: true,
      default: [],
    },
    timeline: {
      type: [String],
      required: true,
      default: [],
    },
    evaluationCriteria: {
      type: [String],
      required: true,
      default: [],
    },
    reviewStatus: {
      type: String,
      required: true,
      enum: TOR_REVIEW_STATUSES,
      default: 'unverified',
    },
    categoryOverridden: {
      type: Boolean,
      required: true,
      default: false,
    },
    lastEditedAt: {
      type: Date,
      default: null,
    },
    // Last time ingestion saw this project at the source
    lastSeenAt: {
      type: Date,
      default: null,
    },
    contactInformation: {
      type: [String],
      required: true,
      default: [],
    },
    classificationReason: {
      type: String,
      required: true,
      trim: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    analysisModel: {
      type: String,
      required: true,
      trim: true,
    },
    analysisVersion: {
      type: String,
      required: true,
      trim: true,
    },
    analyzedAt: {
      type: Date,
      required: true,
    },
    documents: {
      type: [sourceDocumentSchema],
      required: true,
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'tors',
  },
)

torSchema.index(
  {
    dataSourceId: 1,
    externalId: 1,
    sourceVersion: 1,
  },
  { unique: true },
)

torSchema.index({ awardedPriceBaht: 1, analyzedAt: -1 })
torSchema.index({ awardedPriceBaht: 1, agencyName: 1 })

export type Tor = InferSchemaType<typeof torSchema>

export const TorModel = model('Tor', torSchema)
