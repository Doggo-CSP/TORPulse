import { InferSchemaType, Schema, model } from 'mongoose'

// Categories used to classify TORs and as user interests. `key` is what TORs (`category`) and
// users (`interests`) store, so it can never change after creation.
const categorySchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    keywords: {
      type: [String],
      required: true,
      default: [],
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    sortOrder: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'categories',
  },
)

categorySchema.index({ sortOrder: 1, name: 1 })

export type Category = InferSchemaType<typeof categorySchema>

export const CategoryModel = model('Category', categorySchema)
