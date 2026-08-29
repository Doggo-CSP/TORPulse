export interface ProcurementProject {
  externalId: string
  title: string
  detailUrl: string
  agencyName?: string
}

export interface DownloadDocument {
  fileName: string
  mimeType: string
  content: Buffer
  sourceUrl: string
}

export interface ProcurementSourceAdapter {
  getProject(externalId: string): Promise<ProcurementProject>

  downloadDocuments(project: ProcurementProject): Promise<DownloadDocument[]>
}
