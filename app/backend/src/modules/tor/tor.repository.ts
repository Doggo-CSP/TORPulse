import { Types } from 'mongoose'

import type { GovSpendingProjectMetadata } from '../ingestion/adapters/govspending-discovery.adapter.js'
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

export type TorSourceFields = Pick<
  UpsertTorInput,
  | 'departmentName'
  | 'departmentSubName'
  | 'projectStatus'
  | 'fiscalYear'
  | 'announceDate'
  | 'budgetBaht'
  | 'midPriceBaht'
  | 'awardedPriceBaht'
>

/**
 * TOR fields owned by GovSpending. Null values are left out so a gap in
 * one GovSpending sync never erases a value already stored on the TOR.
 */
export function torFieldsFromSourceMetadata(
  metadata:
    | { [K in keyof GovSpendingProjectMetadata]?: GovSpendingProjectMetadata[K] | null }
    | null
    | undefined,
): Partial<TorSourceFields> {
  if (!metadata) {
    return {}
  }

  const fields: Partial<TorSourceFields> = {
    departmentName: metadata.departmentName,
    departmentSubName: metadata.departmentSubName,
    projectStatus: metadata.projectStatus,
    fiscalYear: metadata.fiscalYear,
    announceDate: metadata.announceDate,
    budgetBaht: metadata.budgetBaht,
    midPriceBaht: metadata.midPriceBaht,
    awardedPriceBaht: metadata.awardedPriceBaht,
  }

  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== null && value !== undefined),
  ) as Partial<TorSourceFields>
}

/**
 * Refresh GovSpending-owned fields on TORs that already exist. Does not
 * create TORs; those are only created by the ingestion worker.
 */
export async function updateTorSourceMetadata(
  dataSourceId: Types.ObjectId,
  projects: Array<{ externalId: string; metadata: GovSpendingProjectMetadata }>,
): Promise<number> {
  const operations = projects
    .map((project) => ({ project, fields: torFieldsFromSourceMetadata(project.metadata) }))
    .filter(({ fields }) => Object.keys(fields).length > 0)
    .map(({ project, fields }) => ({
      updateOne: {
        filter: { dataSourceId, externalId: project.externalId, sourceVersion: 'initial' },
        update: { $set: fields },
      },
    }))

  if (operations.length === 0) {
    return 0
  }

  const result = await TorModel.bulkWrite(operations, { ordered: false })
  return result.modifiedCount
}
