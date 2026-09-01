import { Types } from 'mongoose'

import { env } from '../../config/env.js'
import { upsertTor } from '../tor/tor.repository.js'
import type { IngestionJob } from './ingestion-job.model.js'
import type { ProcurementSourceAdapter } from './adapters/procurement-source.adapter.js'
import { CentralEgpAdapter } from './adapters/central-egp.adapters.js'
import {
  analyzeTorWithDeepSeek,
  TOR_ANALYSIS_VERSION,
} from './extraction/deepseek-tor-extractor.js'
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
  job: IngestionJob & { _id: Types.ObjectId },
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
  const tor = await upsertTor({
    dataSourceId: job.dataSourceId,
    ingestionJobId: job._id,
    externalId: job.externalId,
    sourceVersion: job.sourceVersion,
    sourceAdapter: job.sourceAdapter,
    detailUrl: project.detailUrl,
    projectTitle: nonBlankOrFallback(extractedTor.projectTitle, project.title),
    agencyName: nonBlankOrFallback(extractedTor.agencyName, project.agencyName ?? null),
    summary: extractedTor.summary,
    objectives: extractedTor.objectives,
    requirements: extractedTor.requirements,
    technologies: extractedTor.technologies,
    budgetBaht: extractedTor.budgetBaht,
    submissionDeadline: extractedTor.submissionDeadline,
    contactInformation: extractedTor.contactInformation,
    classificationReason: extractedTor.classificationReason,
    confidence: extractedTor.confidence,
    analysisModel: env.DEEPSEEK_MODEL,
    analysisVersion: TOR_ANALYSIS_VERSION,
    analyzedAt: new Date(),
    documents: documents.map((document) => ({
      fileName: document.fileName,
      mimeType: document.mimeType,
      sourceUrl: document.sourceUrl,
    })),
  })

  if (!tor) {
    throw new Error(`TOR upsert returned no record for job ${job._id}`)
  }

  return {
    type: 'completed',
    torId: tor._id,
  }
}

function nonBlankOrFallback(value: string | null, fallback: string): string
function nonBlankOrFallback(value: string | null, fallback: string | null): string | null
function nonBlankOrFallback(value: string | null, fallback: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : fallback
}
