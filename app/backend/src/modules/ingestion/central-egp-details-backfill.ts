import { Types } from 'mongoose'

import { TorModel } from '../tor/tor.model.js'
import {
  CentralEgpAdapter,
  type CentralEgpProjectDetails,
} from './adapters/central-egp.adapters.js'

interface BackfillTor {
  _id: Types.ObjectId
  externalId: string
  sourceAdapter: string
}

export async function enrichCentralEgpTorRecords(
  records: Iterable<BackfillTor> | AsyncIterable<BackfillTor>,
  loadDetails: (externalId: string) => Promise<CentralEgpProjectDetails>,
  updateRecord: (id: Types.ObjectId, details: CentralEgpProjectDetails) => Promise<void>,
  onError: (externalId: string, error: unknown) => void = (externalId, error) =>
    console.error(`Failed to enrich Central eGP TOR ${externalId}:`, error),
): Promise<{ updated: number; failed: number }> {
  let updated = 0
  let failed = 0

  for await (const record of records) {
    if (record.sourceAdapter !== 'central_egp') continue

    try {
      const details = await loadDetails(record.externalId)
      await updateRecord(record._id, details)
      updated += 1
    } catch (error) {
      failed += 1
      onError(record.externalId, error)
    }
  }

  return { updated, failed }
}

export async function backfillCentralEgpTorDetails(): Promise<{
  updated: number
  failed: number
}> {
  const adapter = new CentralEgpAdapter()
  const records = TorModel.find({ sourceAdapter: 'central_egp' })
    .select({ _id: 1, externalId: 1, sourceAdapter: 1 })
    .lean<BackfillTor>()
    .cursor()

  return enrichCentralEgpTorRecords(
    records,
    (externalId) => adapter.getProjectDetails(externalId),
    async (id, details) => {
      await TorModel.updateOne(
        { _id: id },
        { $set: { ...details, updatedAt: new Date() } },
        { runValidators: true },
      ).exec()
    },
  )
}
