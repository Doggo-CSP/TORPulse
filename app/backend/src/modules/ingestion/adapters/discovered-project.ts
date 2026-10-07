// Project metadata a discovery adapter reports, refreshed on every producer sync.
export interface ProjectSourceMetadata {
  title: string
  departmentName: string | null
  departmentSubName: string | null
  projectStatus: string | null
  // Source system's own project id (BMA UUID), distinct from the eGP externalId.
  sourceProjectId: string | null
  // Whether the project is still active, e.g. ระหว่างดำเนินการ (code S1).
  contractStatus: string | null
  contractStatusCode: string | null
  fiscalYear: number
  announceDate: Date | null
  budgetBaht: number | null
  midPriceBaht: number | null
  awardedPriceBaht: number | null
}

export interface DiscoveredProcurementProject {
  externalId: string
  title: string
  fiscalYear: number
  metadata: ProjectSourceMetadata
}
