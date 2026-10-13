// Shared vocabulary for matching a company profile against a TOR's bidder qualifications.
// The LLM extractor maps TOR text onto these keys; users pick the same keys on their profile.
export const CERTIFICATION_KEYS = [
  'iso9001',
  'iso27001',
  'iso20000',
  'cmmi_level3',
  'cmmi_level5',
  'depa_ts', // depa Thailand Trust Mark / software registration
  'sipa_registered',
  'egp_registered',
] as const
export type CertificationKey = (typeof CERTIFICATION_KEYS)[number]

export interface CompanyQualification {
  registeredCapitalBaht: number | null
  yearsInBusiness: number | null
  // Largest single contract of similar work the company has delivered
  maxPastContractValueBaht: number | null
  certifications: string[]
  isThaiJuristicPerson: boolean | null
  isSme: boolean | null
}

export interface TorEligibility {
  minRegisteredCapitalBaht: number | null
  minYearsInBusiness: number | null
  minPastContractValueBaht: number | null
  requiredCertifications: string[]
  requiresThaiJuristicPerson: boolean | null
  smeOnly: boolean | null
  // Bidder qualifications the LLM could not map onto a field above
  unmappedQualifications: string[]
}

export const EMPTY_QUALIFICATION: CompanyQualification = {
  registeredCapitalBaht: null,
  yearsInBusiness: null,
  maxPastContractValueBaht: null,
  certifications: [],
  isThaiJuristicPerson: null,
  isSme: null,
}
