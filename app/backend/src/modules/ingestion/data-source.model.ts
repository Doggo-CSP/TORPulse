import { InferSchemaType, Schema, model } from 'mongoose'

const dataSourceSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    enabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    lockedBy: {
      type: String,
      default: null,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    lastStartedAt: Date,
    lastSucceededAt: Date,
    lastError: {
      message: String,
      occurredAt: Date,
    },
  },
  {
    timestamps: true,
    collection: 'data_sources',
  },
)

export type DataSource = InferSchemaType<typeof dataSourceSchema>

export const DataSourceModel = model('DataSource', dataSourceSchema)
