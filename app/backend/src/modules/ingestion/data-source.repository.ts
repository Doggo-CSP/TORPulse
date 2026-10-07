import type { ClientSession, Types } from 'mongoose'

import { DataSourceModel } from './data-source.model.js'

// Legacy key from the removed GovSpending source, kept so existing jobs and TORs stay linked.
export const CENTRAL_EGP_SOURCE_KEY = 'govspending-egp'
export const BMA_SOURCE_KEY = 'bma-egp'
export const PRODUCER_LEASE_MS = 15 * 60_000

// Thai names for the admin panel; the stored `name` is an English label kept for logs
export const DATA_SOURCE_LABELS: Record<string, string> = {
  [BMA_SOURCE_KEY]: 'e-GP กรุงเทพมหานคร (BMA)',
  [CENTRAL_EGP_SOURCE_KEY]: 'e-GP กรมบัญชีกลาง (เลิกใช้แล้ว)',
}

// Sources the producer still discovers from. The legacy central source only links old TORs.
export const ACTIVE_SOURCE_KEYS = [BMA_SOURCE_KEY]

export function ensureCentralEgpDataSource() {
  return ensureDataSource(CENTRAL_EGP_SOURCE_KEY, 'Central e-GP discovery')
}

export function ensureBmaDataSource() {
  return ensureDataSource(BMA_SOURCE_KEY, 'BMA e-GP discovery')
}

async function ensureDataSource(key: string, name: string) {
  try {
    return await DataSourceModel.findOneAndUpdate(
      { key },
      {
        $setOnInsert: {
          name,
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
      return DataSourceModel.findOne({ key }).exec()
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

export function listActiveDataSources() {
  return DataSourceModel.find({ key: { $in: ACTIVE_SOURCE_KEYS } })
    .sort({ key: 1 })
    .lean()
}

export function findDataSourceByKey(key: string, session?: ClientSession) {
  return DataSourceModel.findOne({ key })
    .session(session ?? null)
    .lean()
}

// The producer only claims a lease on an enabled source, so this pauses both the scheduled
// sync and "sync now". A sync already running finishes its current run.
export function setDataSourceEnabled(key: string, enabled: boolean, session?: ClientSession) {
  return DataSourceModel.findOneAndUpdate(
    { key },
    { $set: { enabled, enabledChangedAt: new Date() } },
    { returnDocument: 'after', session },
  ).lean()
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11_000
}
