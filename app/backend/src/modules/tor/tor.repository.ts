import { Types } from 'mongoose'

import type { ProjectSourceMetadata } from '../ingestion/adapters/discovered-project.js'
import { TorModel } from './tor.model.js'
import type { UpsertTorInput } from './tor.types.js'

// A TOR an admin edited, verified or re-categorised keeps its AI-extracted fields when the
// same project is ingested again; only collection metadata from the source is refreshed.
const isProtected = (tor: {
  lastEditedAt?: Date | null
  reviewStatus?: string | null
  categoryOverridden?: boolean | null
}): boolean =>
  Boolean(tor.lastEditedAt) || tor.reviewStatus === 'verified' || tor.categoryOverridden === true

// Fields that come from the procurement source itself rather than from AI extraction
const pickSourceFields = (input: UpsertTorInput) => ({
  ingestionJobId: input.ingestionJobId,
  sourceAdapter: input.sourceAdapter,
  detailUrl: input.detailUrl,
  documents: input.documents,
  departmentName: input.departmentName,
  departmentSubName: input.departmentSubName,
  projectStatus: input.projectStatus,
  sourceProjectId: input.sourceProjectId,
  contractStatus: input.contractStatus,
  contractStatusCode: input.contractStatusCode,
  midPriceBaht: input.midPriceBaht,
  awardedPriceBaht: input.awardedPriceBaht,
})

export async function upsertTor(input: UpsertTorInput) {
  const identity = {
    dataSourceId: input.dataSourceId,
    externalId: input.externalId,
    sourceVersion: input.sourceVersion,
  }
  const lastSeenAt = new Date()

  const existing = await TorModel.findOne(identity, {
    lastEditedAt: 1,
    reviewStatus: 1,
    categoryOverridden: 1,
  }).lean()

  if (existing && isProtected(existing)) {
    return TorModel.findOneAndUpdate(
      identity,
      { $set: { ...pickSourceFields(input), lastSeenAt } },
      { returnDocument: 'after', runValidators: true },
    ).exec()
  }

  return TorModel.findOneAndUpdate(
    identity,
    {
      $set: { ...input, lastSeenAt },
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
  | 'sourceProjectId'
  | 'contractStatus'
  | 'contractStatusCode'
  | 'fiscalYear'
  | 'announceDate'
  | 'budgetBaht'
  | 'midPriceBaht'
  | 'awardedPriceBaht'
>

/**
 * TOR fields owned by the discovery source. Null values are left out so a gap in
 * one sync never erases a value already stored on the TOR.
 */
export function torFieldsFromSourceMetadata(
  metadata:
    { [K in keyof ProjectSourceMetadata]?: ProjectSourceMetadata[K] | null } | null | undefined,
): Partial<TorSourceFields> {
  if (!metadata) {
    return {}
  }

  const fields: Partial<TorSourceFields> = {
    departmentName: metadata.departmentName,
    departmentSubName: metadata.departmentSubName,
    projectStatus: metadata.projectStatus,
    sourceProjectId: metadata.sourceProjectId,
    contractStatus: metadata.contractStatus,
    contractStatusCode: metadata.contractStatusCode,
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
 * Refresh source-owned fields on TORs that already exist. Does not
 * create TORs; those are only created by the ingestion worker.
 */
export async function updateTorSourceMetadata(
  dataSourceId: Types.ObjectId,
  projects: Array<{ externalId: string; metadata: ProjectSourceMetadata }>,
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
