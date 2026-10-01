import { InferSchemaType, Schema, model } from 'mongoose'

// TOR categories are data, not code: the classifier prompt, the TOR list,
// the homepage and the reports all read them from this collection.
const categorySchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_-]+$/,
      immutable: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    // Extra guidance for the AI classifier (examples, boundaries).
    aiHint: {
      type: String,
      trim: true,
      default: null,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
    active: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'tor_categories',
  },
)

categorySchema.index({ active: 1, order: 1 })

export type Category = InferSchemaType<typeof categorySchema>

export const CategoryModel = model('Category', categorySchema)
