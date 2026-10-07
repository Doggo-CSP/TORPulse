import { setTimeout as delay } from 'node:timers/promises'

import { Types } from 'mongoose'

import { TorModel } from '../tor/tor.model.js'
import { torFieldsFromSourceMetadata } from '../tor/tor.repository.js'
import { BmaDiscoveryAdapter, type BmaProjectDetails } from './adapters/bma-discovery.adapter.js'
import { IngestionJobModel } from './ingestion-job.model.js'

// Pause between projects so a full backfill stays polite to the BMA API.
const REQUEST_GAP_MS = 200

interface BackfillTor {
  _id: Types.ObjectId
  externalId: string
  sourceAdapter: string
  ingestionJobId?: Types.ObjectId | null
}

export interface BmaBackfillResult {
  updated: number
  notFound: number
  failed: number
}

export async function enrichBmaTorRecords(
  records: Iterable<BackfillTor> | AsyncIterable<BackfillTor>,
  loadDetails: (externalId: string) => Promise<BmaProjectDetails | null>,
  updateRecord: (record: BackfillTor, details: BmaProjectDetails) => Promise<void>,
  onError: (externalId: string, error: unknown) => void = (externalId, error) =>
    console.error(`Failed to enrich BMA TOR ${externalId}:`, error),
): Promise<BmaBackfillResult> {
  const result: BmaBackfillResult = { updated: 0, notFound: 0, failed: 0 }

  for await (const record of records) {
    if (record.sourceAdapter !== 'bma_egp') continue

    try {
      const details = await loadDetails(record.externalId)
      if (!details) {
        result.notFound += 1
        continue
      }
      await updateRecord(record, details)
      result.updated += 1
    } catch (error) {
      result.failed += 1
      onError(record.externalId, error)
    }
  }

  return result
}

/**
 * Fills BMA project id, middle price and contract status on existing BMA TORs and their
 * ingestion jobs. By default only TORs without a middle price are visited.
 */
export async function backfillBmaTorDetails(
  options: { dryRun?: boolean; onlyMissing?: boolean } = {},
): Promise<BmaBackfillResult> {
  const { dryRun = false, onlyMissing = true } = options
  const adapter = new BmaDiscoveryAdapter()
  const records = TorModel.find({
    sourceAdapter: 'bma_egp',
    ...(onlyMissing ? { midPriceBaht: null } : {}),
  })
    .select({ _id: 1, externalId: 1, sourceAdapter: 1, ingestionJobId: 1 })
    .lean<BackfillTor>()
    .cursor()

  return enrichBmaTorRecords(
    records,
    async (externalId) => {
      const details = await adapter.findProjectDetails(externalId)
      await delay(REQUEST_GAP_MS)
      return details
    },
    async (record, details) => {
      // Null detail fields are dropped so a partial BMA response never erases stored values.
      const fields = torFieldsFromSourceMetadata(details)
      if (dryRun) {
        console.log(`[dry-run] ${record.externalId}`, fields)
        return
      }

      await TorModel.updateOne({ _id: record._id }, { $set: fields }, { runValidators: true }).exec()
      if (record.ingestionJobId) {
        await IngestionJobModel.updateOne(
          { _id: record.ingestionJobId },
          {
            $set: Object.fromEntries(
              Object.entries(fields).map(([key, value]) => [`sourceMetadata.${key}`, value]),
            ),
          },
        ).exec()
      }
    },
  )
}
