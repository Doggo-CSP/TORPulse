import { Types } from 'mongoose'

import { DataSourceModel } from './data-source.model.js'

const GOVSPENDING_SOURCE_KEY = 'govspending-egp'
const PRODUCER_LEASE_MS = 15 * 60_000

export async function ensureGovSpendingDataSource() {
  try {
    return await DataSourceModel.findOneAndUpdate(
      { key: GOVSPENDING_SOURCE_KEY },
      {
        $setOnInsert: {
          name: 'GovSpending e-GP discovery',
          enabled: true,
          lockedBy: null,
          lockedUntil: null,
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).exec()
  } catch (error) {
    // Two new producer instances can race while creating the singleton source.
    if (isDuplicateKeyError(error)) {
      return DataSourceModel.findOne({ key: GOVSPENDING_SOURCE_KEY }).exec()
    }

    throw error
  }
}

export async function claimProducerLease(
  dataSourceId: Types.ObjectId,
  producerId: string,
): Promise<boolean> {
  const now = new Date()
  const result = await DataSourceModel.updateOne(
    {
      _id: dataSourceId,
      enabled: true,
      $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
    },
    {
      $set: {
        lockedBy: producerId,
        lockedUntil: new Date(now.getTime() + PRODUCER_LEASE_MS),
        lastStartedAt: now,
      },
    },
  )

  return result.modifiedCount === 1
}

export async function renewProducerLease(
  dataSourceId: Types.ObjectId,
  producerId: string,
): Promise<boolean> {
  const result = await DataSourceModel.updateOne(
    { _id: dataSourceId, lockedBy: producerId },
    { $set: { lockedUntil: new Date(Date.now() + PRODUCER_LEASE_MS) } },
  )

  return result.modifiedCount === 1
}

export async function releaseProducerLease(
  dataSourceId: Types.ObjectId,
  producerId: string,
  error?: unknown,
): Promise<void> {
  const now = new Date()
  const message = error instanceof Error ? error.message : error ? 'Unknown producer error' : null

  await DataSourceModel.updateOne(
    { _id: dataSourceId, lockedBy: producerId },
    message
      ? {
          $set: {
            lockedBy: null,
            lockedUntil: null,
            lastError: { message, occurredAt: now },
          },
        }
      : {
          $set: {
            lockedBy: null,
            lockedUntil: null,
            lastSucceededAt: now,
          },
          $unset: { lastError: 1 },
        },
  )
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11_000
}
