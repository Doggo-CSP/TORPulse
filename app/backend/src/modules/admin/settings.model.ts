import { InferSchemaType, Schema, model } from 'mongoose'

export const SETTINGS_KEY = 'global'

// A single document (key = 'global') holds the system settings edited on the admin
// settings page. When it does not exist yet, settings.repository.ts returns the defaults.
const settingsSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: SETTINGS_KEY,
    },
    ingestionEnabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    // TODO(QUESTION-10): default for auto-approval is a guess; see QUESTIONS.md
    autoApproveGovEmails: {
      type: Boolean,
      required: true,
      default: false,
    },
    // Stored for future email sending; there is no UI and nothing sends email yet.
    senderEmail: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'settings',
  },
)

export type Settings = InferSchemaType<typeof settingsSchema>

export const SettingsModel = model('Settings', settingsSchema)
