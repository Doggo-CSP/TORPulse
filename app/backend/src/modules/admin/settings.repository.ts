import type { ClientSession } from 'mongoose'

import { SETTINGS_KEY, SettingsModel } from './settings.model.js'
import type { SystemSettings, UpdateSettingsInput } from './admin.types.js'

const DEFAULT_SETTINGS: SystemSettings = {
  ingestionEnabled: true,
  senderEmail: null,
}

export async function getSettings(session?: ClientSession): Promise<SystemSettings> {
  const doc = await SettingsModel.findOne({ key: SETTINGS_KEY })
    .session(session ?? null)
    .lean()

  return {
    ingestionEnabled: doc?.ingestionEnabled ?? DEFAULT_SETTINGS.ingestionEnabled,
    senderEmail: doc?.senderEmail ?? DEFAULT_SETTINGS.senderEmail,
  }
}

// When the settings document last changed; null while it has never been saved
export async function getSettingsUpdatedAt(): Promise<Date | null> {
  const doc = await SettingsModel.findOne({ key: SETTINGS_KEY }).select({ updatedAt: 1 }).lean()
  return (doc?.updatedAt as Date | undefined) ?? null
}

export async function updateSettings(changes: UpdateSettingsInput, session?: ClientSession) {
  return SettingsModel.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $set: changes },
    {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
      setDefaultsOnInsert: true,
      session,
    },
  ).lean()
}
