import {
  DownloadDocument,
  ProcurementProject,
  ProcurementSourceAdapter,
} from './procurement-source.adapter.js'

export class CentralEgpAdapter implements ProcurementSourceAdapter {
  public async getProject(externalId: string): Promise<ProcurementProject> {
    // TODO: search central eGP and retrieve project details.

    throw new Error(`Central eGP getProject is not implemented: ${externalId}`)
  }

  public async downloadDocuments(project: ProcurementProject): Promise<DownloadDocument[]> {
    // TODO: locate, download, and safely extract the ZIP.

    throw new Error(`Central eGP downloadDocuments is not implemented: ${project.externalId}`)
  }
}
