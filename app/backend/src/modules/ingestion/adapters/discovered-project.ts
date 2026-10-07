// Project metadata a discovery adapter reports, refreshed on every producer sync.
export interface ProjectSourceMetadata {
  title: string
  departmentName: string | null
  departmentSubName: string | null
  projectStatus: string | null
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
