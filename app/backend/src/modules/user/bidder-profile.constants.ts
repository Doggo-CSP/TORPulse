// Controlled vocabulary for the bidder profile. Users pick these keys instead of typing free
// text, so qualification matching can compare them directly against keys mapped from TORs.
// Company certifications and staff roles reuse the keys in notification/qualification.ts.
export {
  CERTIFICATION_KEYS as ORG_CERTIFICATION_KEYS,
  STAFF_ROLE_KEYS,
} from '../notification/qualification.js'

export const PERSON_CERTIFICATION_KEYS = [
  'pmp',
  'prince2',
  'itil',
  'scrum_master',
  'togaf',
  'cissp',
  'cisa',
  'cism',
  'ceh',
  'oscp',
  'comptia_security_plus',
  'iso27001_lead_auditor',
  'aws_certified',
  'azure_certified',
  'gcp_certified',
  'ccna',
  'ccnp',
  'oracle_certified',
] as const
export type PersonCertificationKey = (typeof PERSON_CERTIFICATION_KEYS)[number]

// A certification outside the lists above; its name is then required.
export const OTHER_CERTIFICATION_KEY = 'other'

// Ordered lowest to highest, so "at least a bachelor's degree" is an index comparison.
export const EDUCATION_LEVELS = [
  'vocational',
  'high_vocational',
  'bachelor',
  'master',
  'doctorate',
] as const
export type EducationLevel = (typeof EDUCATION_LEVELS)[number]

export const EMPLOYMENT_TYPES = ['permanent', 'contract'] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export const JURISTIC_TYPES = [
  'company_limited', // บริษัทจำกัด
  'public_company_limited', // บริษัทมหาชนจำกัด
  'limited_partnership', // ห้างหุ้นส่วนจำกัด
  'registered_partnership', // ห้างหุ้นส่วนสามัญนิติบุคคล
  'other',
] as const
export type JuristicType = (typeof JURISTIC_TYPES)[number]

export const PROJECT_CLIENT_TYPES = ['government', 'state_enterprise', 'private'] as const
export type ProjectClientType = (typeof PROJECT_CLIENT_TYPES)[number]

export const PROJECT_ROLES = ['prime', 'consortium', 'subcontractor'] as const
export type ProjectRole = (typeof PROJECT_ROLES)[number]

export const MAX_TEAM_MEMBERS = 100
export const MAX_PROJECTS = 100
