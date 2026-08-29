import { Types } from 'mongoose'

import type { IngestionJob } from './ingestion-job.model.js'
import type { ProcurementSourceAdapter } from './adapters/procurement-source.adapter.js'
import { CentralEgpAdapter } from './adapters/central-egp.adapters.js'
import { analyzeTorWithDeepSeek } from './extraction/deepseek-tor-extractor.js'
import {
  extractDocumentsToMarkdown,
  OcrRequiredError,
} from './extraction/opendataloader-text-extractor.js'

export type IngestionResult =
  | {
      type: 'completed'
      torId: Types.ObjectId
    }
  | { type: 'rejected'; reason: string }
  | { type: 'review_required'; reason: string }

const adapters: Record<string, ProcurementSourceAdapter> = {
  central_egp: new CentralEgpAdapter(),
}

export async function processIngestionJob(
  job: IngestionJob,
  updateStage: (stage: string) => Promise<void>,
): Promise<IngestionResult> {
  const adapter = adapters[job.sourceAdapter]

  if (!adapter) {
    return {
      type: 'review_required',
      reason: `Unknown source adapter: ${job.sourceAdapter}`,
    }
  }

  await updateStage('fetching_details')
  const project = await adapter.getProject(job.externalId)

  await updateStage('downloading')
  const documents = await adapter.downloadDocuments(project)

  if (documents.length === 0) {
    return {
      type: 'review_required',
      reason: 'No downloadable documents found',
    }
  }

  await updateStage('extracting_text')
  let extractedText: string

  try {
    extractedText = await extractDocumentsToMarkdown(documents)
  } catch (error) {
    if (error instanceof OcrRequiredError) {
      return { type: 'review_required', reason: error.message }
    }

    throw error
  }

  await updateStage('classifying')
  const extractedTor = await analyzeTorWithDeepSeek(extractedText, project)

  if (!extractedTor.isSoftwareRelated) {
    return {
      type: 'rejected',
      reason: extractedTor.classificationReason,
    }
  }

  await updateStage('extracting_fields')

  await updateStage('storing')

  // TODO: Make Tor upsert
  const torId = new Types.ObjectId()

  console.log('TOR ready to save', {
    externalId: project.externalId,
    detailUrl: project.detailUrl,
    extractedTor,
  })

  return {
    type: 'completed',
    torId,
  }
}
