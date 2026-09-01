import { TorModel } from './tor.model.js'
import type { UpsertTorInput } from './tor.types.js'

export async function upsertTor(input: UpsertTorInput) {
  return TorModel.findOneAndUpdate(
    {
      dataSourceId: input.dataSourceId,
      externalId: input.externalId,
      sourceVersion: input.sourceVersion,
    },
    {
      $set: input,
    },
    {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).exec()
}
