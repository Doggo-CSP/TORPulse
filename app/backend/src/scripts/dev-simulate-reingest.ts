import { pathToFileURL } from 'node:url'

import { isObjectIdOrHexString } from 'mongoose'

import { database } from '../config/mongoose.js'
import { TorModel } from '../modules/tor/tor.model.js'
import { upsertTor } from '../modules/tor/tor.repository.js'
import type { UpsertTorInput } from '../modules/tor/tor.types.js'
import { assertNotProduction } from './dev-session-token.js'

// DEV ONLY: pretends the ingestion worker extracted the same project again with different AI
// results, through the same upsertTor the worker uses. Lets a tester see that a TOR an admin
// edited, verified or re-categorised keeps its fields, while an untouched TOR is overwritten.
//   npm run dev:simulate-reingest -- <torId>
// Refuses to run when NODE_ENV=production.

async function simulateReingest(torId: string): Promise<void> {
  assertNotProduction()
  await database.connect()

  try {
    const tor = await TorModel.findById(torId).lean()
    if (!tor) {
      console.error(`No TOR with id ${torId}`)
      process.exitCode = 1
      return
    }

    const input: UpsertTorInput = {
      dataSourceId: tor.dataSourceId,
      ingestionJobId: tor.ingestionJobId,
      externalId: tor.externalId,
      sourceVersion: tor.sourceVersion,
      sourceAdapter: tor.sourceAdapter,
      detailUrl: tor.detailUrl,
      projectTitle: `${tor.projectTitle} (AI re-extracted)`,
      agencyName: tor.agencyName ?? null,
      departmentName: tor.departmentName ?? null,
      departmentSubName: tor.departmentSubName ?? null,
      projectStatus: tor.projectStatus ?? null,
      summary: 'AI re-extracted summary',
      objectives: tor.objectives ?? [],
      requirements: tor.requirements ?? [],
      bidderQualifications: tor.bidderQualifications ?? [],
      technologies: ['Re-extracted Technology'],
      category: 'enterprise_system',
      budgetBaht: 1,
      midPriceBaht: tor.midPriceBaht ?? null,
      awardedPriceBaht: tor.awardedPriceBaht ?? null,
      submissionDeadline: tor.submissionDeadline ?? null,
      contactInformation: tor.contactInformation ?? [],
      classificationReason: tor.classificationReason,
      confidence: tor.confidence,
      analysisModel: tor.analysisModel,
      analysisVersion: tor.analysisVersion,
      analyzedAt: new Date(),
      documents: tor.documents ?? [],
    }

    const protectedTor = Boolean(
      tor.lastEditedAt || tor.reviewStatus === 'verified' || tor.categoryOverridden,
    )
    await upsertTor(input)
    const after = await TorModel.findById(torId).lean()

    console.log(`TOR ${tor.externalId} protected=${protectedTor}`)
    console.log(`  projectTitle: ${tor.projectTitle} -> ${after?.projectTitle}`)
    console.log(`  budgetBaht:   ${tor.budgetBaht} -> ${after?.budgetBaht}`)
    console.log(`  summary:      ${tor.summary} -> ${after?.summary}`)
    console.log(
      `  lastSeenAt:   ${tor.lastSeenAt?.toISOString() ?? null} -> ${after?.lastSeenAt?.toISOString()}`,
    )
    console.log(
      protectedTor
        ? 'Expected: the AI fields above did NOT change; only lastSeenAt moved.'
        : 'Expected: the AI fields above changed to the re-extracted values.',
    )
  } finally {
    await database.disconnect()
  }
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  const torId = process.argv[2]
  if (!torId || !isObjectIdOrHexString(torId)) {
    console.error('Usage: npm run dev:simulate-reingest -- <torId>')
    process.exitCode = 1
  } else {
    simulateReingest(torId).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
  }
}
