import { HIDDEN_TOR_REVIEW_STATUSES, type TorReviewStatus } from '../tor/tor.model.js'
import type { CompanyQualification, TorEligibility } from './qualification.js'

// Only the fields the matcher reads, so it works with lean documents and test fixtures.
export interface NotificationUser {
  status?: string | null
  accountType?: string | null
  companyName?: string | null
  registrationNumber?: string | null
  interests?: string[] | null
  qualification?: Partial<CompanyQualification> | null
  notificationPrefs?: { emailEnabled?: boolean | null } | null
}

export interface NotificationTor {
  reviewStatus?: string | null
  submissionDeadlineAt?: Date | null
  category?: string | null
  categories?: string[] | null
  eligibility?: Partial<TorEligibility> | null
}

const SCALAR_QUALIFICATION_FIELDS = [
  'registeredCapitalBaht',
  'yearsInBusiness',
  'maxPastContractValueBaht',
  'isThaiJuristicPerson',
  'isSme',
  'hasPositiveNetWorth',
  'hasBangkokOffice',
] as const

// Profile fields still missing before the user can receive qualifying-TOR emails.
export function missingNotificationFields(user: NotificationUser): string[] {
  const missing: string[] = []

  if (user.accountType !== 'company') missing.push('accountType')
  if (!user.companyName?.trim()) missing.push('companyName')
  if (!user.registrationNumber?.trim()) missing.push('registrationNumber')
  if (!user.interests?.length) missing.push('interests')

  for (const field of SCALAR_QUALIFICATION_FIELDS) {
    const value = user.qualification?.[field]
    if (value === null || value === undefined) missing.push(`qualification.${field}`)
  }

  return missing
}

export function isProfileReadyForNotification(user: NotificationUser): boolean {
  return missingNotificationFields(user).length === 0
}

export function canReceiveNotification(user: NotificationUser): boolean {
  return (
    user.status !== 'suspended' &&
    user.notificationPrefs?.emailEnabled !== false &&
    isProfileReadyForNotification(user)
  )
}

// A TOR is worth notifying about while it is public and still open for bids.
export function isTorRelevant(tor: NotificationTor, now: Date = new Date()): boolean {
  if (HIDDEN_TOR_REVIEW_STATUSES.includes(tor.reviewStatus as TorReviewStatus)) return false
  if (tor.submissionDeadlineAt && tor.submissionDeadlineAt.getTime() <= now.getTime()) return false
  return true
}

export interface QualificationResult {
  qualified: boolean
  reasons: string[]
}

// Full qualification only: every stated requirement must be met. A requirement that cannot be
// checked (no structured eligibility, or text the extractor could not map) counts as not met.
export function isFullyQualified(user: NotificationUser, tor: NotificationTor): QualificationResult {
  const reasons: string[] = []
  const eligibility = tor.eligibility
  const profile = user.qualification ?? {}

  const torCategories = new Set([...(tor.categories ?? []), ...(tor.category ? [tor.category] : [])])
  if (!(user.interests ?? []).some((key) => torCategories.has(key))) {
    reasons.push('category not in interests')
  }

  if (!eligibility) {
    reasons.push('eligibility not extracted')
    return { qualified: false, reasons }
  }

  if ((eligibility.unmappedQualifications ?? []).length > 0) {
    reasons.push('unverifiable qualifications')
  }

  checkMinimum(
    reasons,
    'registered capital',
    profile.registeredCapitalBaht,
    eligibility.minRegisteredCapitalBaht,
  )
  checkMinimum(reasons, 'years in business', profile.yearsInBusiness, eligibility.minYearsInBusiness)
  checkMinimum(
    reasons,
    'past contract value',
    profile.maxPastContractValueBaht,
    eligibility.minPastContractValueBaht,
  )

  const certifications = new Set(profile.certifications ?? [])
  for (const key of eligibility.requiredCertifications ?? []) {
    if (!certifications.has(key)) reasons.push(`missing certification ${key}`)
  }

  if (eligibility.requiresThaiJuristicPerson && profile.isThaiJuristicPerson !== true) {
    reasons.push('not a Thai juristic person')
  }
  if (eligibility.smeOnly && profile.isSme !== true) {
    reasons.push('not an SME')
  }
  if (eligibility.requiresPositiveNetWorth && profile.hasPositiveNetWorth !== true) {
    reasons.push('net worth not positive')
  }
  if (eligibility.requiresBangkokOffice && profile.hasBangkokOffice !== true) {
    reasons.push('no Bangkok office')
  }

  const maxAge = eligibility.maxPastWorkAgeYears
  if (maxAge !== null && maxAge !== undefined) {
    const age = profile.pastContractAgeYears
    if (age === null || age === undefined || age > maxAge) {
      reasons.push(`past work older than ${maxAge} years`)
    }
  }

  const staffRoles = new Set(profile.staffRoles ?? [])
  for (const role of eligibility.requiredStaffRoles ?? []) {
    if (!staffRoles.has(role)) reasons.push(`missing staff role ${role}`)
  }

  return { qualified: reasons.length === 0, reasons }
}

function checkMinimum(
  reasons: string[],
  label: string,
  value: number | null | undefined,
  minimum: number | null | undefined,
): void {
  if (minimum === null || minimum === undefined) return
  if (value === null || value === undefined || value < minimum) {
    reasons.push(`${label} below ${minimum}`)
  }
}
