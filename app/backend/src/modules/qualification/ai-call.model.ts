import { Schema, model, type Types } from 'mongoose'

import { RETENTION_SECONDS } from '../../config/retention.js'

// One document per Gemini call made for qualification matching (threat T17).
// The daily AI quota counts these rows, not qualification_matches: a match document is
// overwritten on every re-evaluation, so counting matches missed repeated runs on one TOR.
export const AI_CALL_SOURCES = ['api', 'worker'] as const
export type AiCallSource = (typeof AI_CALL_SOURCES)[number]

export interface AiCallRecord {
  userId: Types.ObjectId
  torId: Types.ObjectId
  // api: the user pressed evaluate; worker: precomputed in the background
  source: AiCallSource
  calledAt: Date
}

const aiCallSchema = new Schema<AiCallRecord>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    torId: { type: Schema.Types.ObjectId, required: true },
    source: { type: String, enum: AI_CALL_SOURCES, required: true },
    calledAt: { type: Date, required: true },
  },
  { collection: 'qualification_ai_calls', versionKey: false },
)

// Per-user count of on-demand calls in the last 24 hours
aiCallSchema.index({ userId: 1, source: 1, calledAt: 1 })
// Retention: only the last 24 hours are ever counted (src/config/retention.ts)
aiCallSchema.index(
  { calledAt: 1 },
  { expireAfterSeconds: RETENTION_SECONDS.qualificationAiCalls, name: 'retention_calledAt' },
)

export const AiCallModel = model<AiCallRecord>('QualificationAiCall', aiCallSchema)
