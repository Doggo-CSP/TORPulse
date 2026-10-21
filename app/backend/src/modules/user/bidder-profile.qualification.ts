import {
  EMPTY_QUALIFICATION,
  STAFF_ROLE_KEYS,
  type CompanyQualification,
} from '../notification/qualification.js'
import { OTHER_CERTIFICATION_KEY } from './bidder-profile.constants.js'
import type {
  BidderProfileRecord,
  CertificationRecord,
  PastProjectRecord,
  PersonRecord,
} from './bidder-profile.model.js'

// Only the fields these helpers read, so they work with lean documents and test fixtures.
export interface BidderUser {
  accountType?: string | null
  companyName?: string | null
  registrationNumber?: string | null
  interests?: string[] | null
}

export type BidderProfileInput = Pick<
  BidderProfileRecord,
  'organization' | 'self' | 'team' | 'projects'
>

const addYears = (date: Date, years: number) => {
  const result = new Date(date)
  result.setUTCFullYear(result.getUTCFullYear() + years)
  return result
}

// Calendar years between two dates, rounded down to 2 decimals: exactly 3 years after
// registration is 3, the day before is 2.99.
export function yearsBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0

  let whole = to.getUTCFullYear() - from.getUTCFullYear()
  if (addYears(from, whole).getTime() > to.getTime()) whole -= 1

  const anniversary = addYears(from, whole)
  const nextAnniversary = addYears(from, whole + 1)
  const fraction =
    (to.getTime() - anniversary.getTime()) / (nextAnniversary.getTime() - anniversary.getTime())

  return Math.floor((whole + fraction) * 100) / 100
}

function isValidOn(cert: CertificationRecord, now: Date): boolean {
  return !cert.expiresAt || cert.expiresAt.getTime() >= now.getTime()
}

// Certifications that count today: not expired, and from the known list (not "other").
export function activeCertificationKeys(certs: CertificationRecord[], now: Date): string[] {
  const keys = certs
    .filter((cert) => cert.key !== OTHER_CERTIFICATION_KEY && isValidOn(cert, now))
    .map((cert) => cert.key)
  return [...new Set(keys)]
}

// The people who count for this bidder: the team of a company, or the individual themself.
export function bidderPersons(user: BidderUser, profile: BidderProfileInput): PersonRecord[] {
  if (user.accountType === 'company') return profile.team
  return profile.self ? [profile.self] : []
}

function largestProject(projects: PastProjectRecord[]): PastProjectRecord | null {
  let largest: PastProjectRecord | null = null
  for (const project of projects) {
    if (project.contractValueBaht === null) continue
    if (!largest || project.contractValueBaht > (largest.contractValueBaht ?? 0)) largest = project
  }
  return largest
}

// Summarizes the detailed profile into the flat qualification that notification/eligibility.ts
// matches against TOR eligibility. Written to users.qualification whenever the profile changes.
export function deriveQualification(
  user: BidderUser,
  profile: BidderProfileInput,
  now: Date = new Date(),
): CompanyQualification {
  const isCompany = user.accountType === 'company'
  const organization = profile.organization
  const largest = largestProject(profile.projects)

  const roles = new Set(bidderPersons(user, profile).flatMap((person) => person.roles))

  return {
    ...EMPTY_QUALIFICATION,
    registeredCapitalBaht: isCompany ? organization.registeredCapitalBaht : null,
    yearsInBusiness:
      isCompany && organization.registeredDate
        ? yearsBetween(organization.registeredDate, now)
        : null,
    maxPastContractValueBaht: largest?.contractValueBaht ?? null,
    // A project still running counts as current work
    pastContractAgeYears: largest
      ? largest.endDate
        ? yearsBetween(largest.endDate, now)
        : 0
      : null,
    certifications: isCompany ? activeCertificationKeys(organization.certifications, now) : [],
    isThaiJuristicPerson: isCompany ? true : user.accountType === 'personal' ? false : null,
    isSme: isCompany ? organization.isSme : null,
    hasPositiveNetWorth: isCompany ? organization.hasPositiveNetWorth : null,
    hasBangkokOffice: isCompany ? organization.hasBangkokOffice : null,
    staffRoles: STAFF_ROLE_KEYS.filter((key) => roles.has(key)),
  }
}

export interface ProfileCompleteness {
  isComplete: boolean
  missing: string[]
  percentage: number
}

// Fields still needed before qualification matching can give a full result (UC-07, UC-08).
// The profile can always be saved; this only reports what is missing.
export function profileCompleteness(
  user: BidderUser,
  profile: BidderProfileInput | null,
): ProfileCompleteness {
  const checks: [string, boolean][] = [['interests', Boolean(user.interests?.length)]]

  if (user.accountType === 'company') {
    const organization = profile?.organization
    checks.push(
      ['companyName', Boolean(user.companyName?.trim())],
      ['registrationNumber', Boolean(user.registrationNumber?.trim())],
      ['organization.juristicType', Boolean(organization?.juristicType)],
      ['organization.registeredDate', Boolean(organization?.registeredDate)],
      ['organization.registeredCapitalBaht', organization?.registeredCapitalBaht != null],
      ['organization.isSme', organization?.isSme != null],
      ['organization.hasPositiveNetWorth', organization?.hasPositiveNetWorth != null],
      ['organization.hasBangkokOffice', organization?.hasBangkokOffice != null],
    )
  } else if (user.accountType === 'personal') {
    const self = profile?.self
    checks.push(
      ['self.roles', Boolean(self?.roles.length)],
      ['self.yearsExperience', self?.yearsExperience != null],
      ['self.education', Boolean(self?.education.length)],
    )
  } else {
    // Agencies publish TORs rather than bid on them
    checks.push(['accountType', false])
  }

  checks.push(['projects', Boolean(profile?.projects.length)])

  const missing = checks.filter(([, done]) => !done).map(([field]) => field)
  const percentage = Math.round(((checks.length - missing.length) / checks.length) * 100)

  return { isComplete: missing.length === 0, missing, percentage }
}
