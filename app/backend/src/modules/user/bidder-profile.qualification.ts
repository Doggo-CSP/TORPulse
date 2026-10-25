import {
  EMPTY_QUALIFICATION,
  STAFF_ROLE_KEYS,
  type CompanyQualification,
} from '../notification/qualification.js'
import type {
  BidderProfileRecord,
  CertificationRecord,
  PastProjectRecord,
  PersonRecord,
} from './bidder-profile.model.js'

// Only the fields these helpers read, so they work with lean documents and test fixtures.
export interface BidderUser {
  accountType?: string | null
  displayName?: string | null
  firstName?: string | null
  lastName?: string | null
  contactEmail?: string | null
  phone?: string | null
  companyName?: string | null
  businessType?: string | null
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

export function isCertificationValidOn(cert: CertificationRecord, now: Date): boolean {
  return !cert.expiresAt || cert.expiresAt.getTime() >= now.getTime()
}

// Names of the certifications that count today (not expired).
export function activeCertificationNames(certs: CertificationRecord[], now: Date): string[] {
  return [...new Set(certs.filter((cert) => isCertificationValidOn(cert, now)).map((c) => c.name))]
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
    // Names, not the notification keys: the key matcher no longer recognizes them (see docs §9)
    certifications: isCompany ? activeCertificationNames(organization.certifications, now) : [],
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

const filled = (value: string | null | undefined) => Boolean(value?.trim())

// Fields still needed before qualification matching can give a full result (UC-07, UC-08).
// The profile can always be saved; this only reports what is missing. The required fields
// follow the agreed profile spec; the team and everything else stay optional.
export function profileCompleteness(
  user: BidderUser,
  profile: BidderProfileInput | null,
): ProfileCompleteness {
  const checks: [string, boolean][] = []

  if (user.accountType === 'company') {
    checks.push(
      ['companyName', filled(user.companyName)],
      ['businessType', filled(user.businessType)],
      ['organization.registeredCapitalBaht', profile?.organization.registeredCapitalBaht != null],
    )
  } else if (user.accountType === 'personal') {
    checks.push(
      ['name', filled(user.displayName) || (filled(user.firstName) && filled(user.lastName))],
      ['contact', filled(user.contactEmail) || filled(user.phone)],
    )
  } else {
    // Agencies publish TORs rather than bid on them
    checks.push(['accountType', false])
  }

  // Past work needs at least a name and a contract value to be compared with a TOR
  checks.push([
    'projects',
    Boolean(profile?.projects.some((project) => project.contractValueBaht != null)),
  ])

  const missing = checks.filter(([, done]) => !done).map(([field]) => field)
  const percentage = Math.round(((checks.length - missing.length) / checks.length) * 100)

  return { isComplete: missing.length === 0, missing, percentage }
}
