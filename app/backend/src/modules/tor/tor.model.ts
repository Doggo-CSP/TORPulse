import { InferSchemaType, Schema, model } from 'mongoose'

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
    // Keys from the tor_categories collection, set by the AI classifier.
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
