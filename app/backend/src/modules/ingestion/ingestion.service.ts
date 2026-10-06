import { Types } from 'mongoose'

import { env } from '../../config/env.js'
import { torFieldsFromSourceMetadata, upsertTor } from '../tor/tor.repository.js'
import { getCategoryCatalog, normalizeCategories } from '../category/category.repository.js'
import { cleanDateText, parseThaiDate } from './thai-date.js'
import { extractBiddingMethod } from './bidding-method.js'
import type { IngestionJob } from './ingestion-job.model.js'
import type {
  DownloadDocument,
  ProcurementProject,
  ProcurementSourceAdapter,
} from './adapters/procurement-source.adapter.js'
import { CentralEgpAdapter, NoTorDocumentsError } from './adapters/central-egp.adapters.js'
import {
  analyzeTorWithDeepSeek,
  TOR_ANALYSIS_VERSION,
} from './extraction/deepseek-tor-extractor.js'
import { analyzeTorWithGemini } from './extraction/gemini-tor-extractor.js'
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
  | { type: 'skipped'; reason: string }

const centralEgpAdapter = new CentralEgpAdapter()

const adapters: Record<string, ProcurementSourceAdapter> = {
  central_egp: centralEgpAdapter,
  // BMA projects are published on Central eGP under the same project id.
  bma_egp: centralEgpAdapter,
}

const torAnalyzers = {
  deepseek: analyzeTorWithDeepSeek,
  gemini: analyzeTorWithGemini,
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

  let project: ProcurementProject
  let documents: DownloadDocument[]

  try {
    await updateStage('fetching_details')
    project = await adapter.getProject(job.externalId)

    await updateStage('downloading')
    documents = await adapter.downloadDocuments(project)
  } catch (error) {
    if (error instanceof NoTorDocumentsError) {
      return { type: 'skipped', reason: error.message }
    }

    throw error
  }

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
  const categoryCatalog = await getCategoryCatalog()
  const extractedTor = await torAnalyzers[env.AI_PROVIDER](extractedText, project, categoryCatalog)

  if (!extractedTor.isSoftwareRelated) {
    return {
      type: 'rejected',
      reason: extractedTor.classificationReason,
    }
  }

  await updateStage('extracting_fields')

  const { category, categories } = normalizeCategories(
    extractedTor,
    categoryCatalog.map(({ key }) => key),
  )

  // The announcement PDF states the exact bidding window; prefer it over the LLM's reading.
  const announcement =
    adapter instanceof CentralEgpAdapter ? await adapter.getAnnouncementInfo(job.externalId) : null
  const announcementDeadline = announcement?.deadline
  const deadline = announcementDeadline?.date
    ? { text: announcementDeadline.text, date: announcementDeadline.date }
    : {
        text: cleanDateText(extractedTor.submissionDeadline),
        date: parseThaiDate(extractedTor.submissionDeadline),
      }

  await updateStage('storing')
  const sourceMetadata = job.sourceMetadata ?? null
  const projectTitle = nonBlankOrFallback(
    extractedTor.projectTitle,
    sourceMetadata?.title ?? project.title,
  )
  const tor = await upsertTor({
    dataSourceId: job.dataSourceId,
    ingestionJobId: job._id,
    externalId: job.externalId,
    sourceVersion: job.sourceVersion,
    sourceAdapter: job.sourceAdapter,
    detailUrl: project.detailUrl,
    projectTitle,
    agencyName: nonBlankOrFallback(extractedTor.agencyName, project.agencyName ?? null),
    departmentName: null,
    departmentSubName: null,
    projectStatus: null,
    fiscalYear: null,
    announceDate: null,
    midPriceBaht: null,
    awardedPriceBaht: null,
    summary: extractedTor.summary,
    objectives: extractedTor.objectives,
    requirements: extractedTor.requirements,
    bidderQualifications: extractedTor.bidderQualifications,
    technologies: extractedTor.technologies,
    category,
    categories,
    budgetBaht: extractedTor.budgetBaht,
    // GovSpending owns department, status, year, announce date and prices,
    // and its project budget wins over the LLM-extracted one.
    ...torFieldsFromSourceMetadata(sourceMetadata),
    // The announcement PDF names the method; the title usually repeats it.
    biddingMethod:
      announcement?.biddingMethod ??
      extractBiddingMethod(projectTitle) ??
      sourceMetadata?.biddingMethod ??
      null,
    submissionDeadline: deadline.text,
    submissionDeadlineAt: deadline.date,
    contactInformation: extractedTor.contactInformation,
    classificationReason: extractedTor.classificationReason,
    confidence: extractedTor.confidence,
    analysisModel: env.AI_PROVIDER === 'gemini' ? env.GEMINI_MODEL : env.DEEPSEEK_MODEL,
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
