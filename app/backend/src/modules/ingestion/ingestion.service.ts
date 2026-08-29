import { Types } from 'mongoose'

import type { IngestionJob } from './ingestion-job.model.js'
import type { ProcurementSourceAdapter } from './adapters/procurement-source.adapter.js'
import { CentralEgpAdapter } from './adapters/central-egp.adapters.js'
import { title } from 'node:process'

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
      reason: `Unknow source adapter: ${job.sourceAdapter}`,
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

  // TODO: Implement PDF => TEXT Servince
  const extractedText = ''

  await updateStage('classifying')

  // TODO: Implement classifier
  const isSoftwareRelated: boolean = containsSoftwareKeywords(`${project.title}\n${extractedText}`)

  if (!isSoftwareRelated) {
    return {
      type: 'rejected',
      reason: 'Document is not software-related',
    }
  }

  await updateStage('extracting_fields')

  // TODO: extract data from text to field

  const extractedTor = {
    externalId: project.externalId,
    title: project.title,
    detailUrl: project.detailUrl,
  }

  await updateStage('storing')

  // TODO: Make Tor upsert
  const torId = new Types.ObjectId()

  console.log('TOR ready to save', extractedTor)

  return {
    type: 'completed',
    torId,
  }
}

function containsSoftwareKeywords(text: string): boolean {
  const normalizedText = text.toLowerCase()

  const keywords = [
    'ซอฟต์แวร์',
    'พัฒนาระบบ',
    'ระบบสารสนเทศ',
    'แอปพลิเคชัน',
    'ฐานข้อมูล',
    'software',
    'application',
    'database',
    'cloud',
    'cybersecurity',
  ]

  return keywords.some((keyword) => normalizedText.includes(keyword))
}
