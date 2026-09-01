import { Types } from 'mongoose'

export interface TorSourceDocumentInput {
  fileName: string
  mimeType: string
  sourceUrl: string
}

export interface UpsertTorInput {
  dataSourceId: Types.ObjectId
  ingestionJobId: Types.ObjectId
  externalId: string
  sourceVersion: string
  sourceAdapter: 'gov_spending' | 'central_egp' | 'bma_egp'
  detailUrl: string
  projectTitle: string
  agencyName: string | null
  summary: string | null
  objectives: string[]
  requirements: string[]
  technologies: string[]
  budgetBaht: number | null
  submissionDeadline: string | null
  contactInformation: string[]
  classificationReason: string
  confidence: number
  analysisModel: string
  analysisVersion: string
  analyzedAt: Date
  documents: TorSourceDocumentInput[]
}
