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
