// Controlled vocabulary for the bidder profile. Certifications are not listed here: they are
// stored by name and judged by the AI matcher (modules/qualification), so any name works.
// Staff roles reuse the keys in notification/qualification.ts.
export { STAFF_ROLE_KEYS } from '../notification/qualification.js'

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
