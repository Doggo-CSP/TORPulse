import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import { isFullyQualified } from '../notification/eligibility.js'
import type { PastProjectRecord, PersonRecord } from './bidder-profile.model.js'
import {
  activeCertificationNames,
  deriveQualification,
  profileCompleteness,
  yearsBetween,
  type BidderProfileInput,
} from './bidder-profile.qualification.js'

const NOW = new Date('2026-10-22T00:00:00Z')

const person = (overrides: Partial<PersonRecord> = {}): PersonRecord => ({
  _id: new Types.ObjectId(),
  fullName: '',
  positionTitle: '',
  roles: [],
  yearsExperience: null,
  employmentType: null,
  joinedAt: null,
  education: [],
  certifications: [],
  skills: [],
  ...overrides,
})

const project = (overrides: Partial<PastProjectRecord> = {}): PastProjectRecord => ({
  _id: new Types.ObjectId(),
  name: 'Project',
  clientName: '',
  clientType: null,
  contractValueBaht: null,
  startDate: null,
  endDate: null,
  role: null,
  categories: [],
  technologies: [],
  description: '',
  hasCompletionCertificate: false,
  memberIds: [],
  ...overrides,
})

const emptyProfile = (): BidderProfileInput => ({
  organization: {
    juristicType: null,
    registeredDate: null,
    registeredCapitalBaht: null,
    isSme: null,
    hasPositiveNetWorth: null,
    hasBangkokOffice: null,
    certifications: [],
  },
  self: null,
  team: [],
  projects: [],
})

const companyProfile = (): BidderProfileInput => ({
  ...emptyProfile(),
  organization: {
    juristicType: 'company_limited',
    registeredDate: new Date('2020-10-22'),
    registeredCapitalBaht: 5_000_000,
    isSme: true,
    hasPositiveNetWorth: true,
    hasBangkokOffice: false,
    certifications: [
      { name: 'ISO/IEC 27001', issuer: '', issuedAt: null, expiresAt: new Date('2027-01-01') },
      { name: 'ISO 9001', issuer: '', issuedAt: null, expiresAt: new Date('2025-01-01') },
      { name: 'Local award', issuer: '', issuedAt: null, expiresAt: null },
    ],
  },
  team: [
    person({ roles: ['project_manager', 'developer'] }),
    person({ roles: ['developer', 'system_analyst'] }),
  ],
  projects: [
    project({ contractValueBaht: 1_000_000, endDate: new Date('2025-10-22') }),
    project({ contractValueBaht: 3_000_000, endDate: new Date('2024-10-22') }),
    project({ contractValueBaht: null }),
  ],
})

test('yearsBetween counts calendar years, rounds down and never goes negative', () => {
  assert.equal(yearsBetween(new Date('2023-10-22'), NOW), 3)
  assert.equal(yearsBetween(new Date('2020-10-22'), NOW), 6) // spans a leap day
  assert.equal(yearsBetween(new Date('2023-10-23'), NOW), 2.99)
  assert.equal(yearsBetween(new Date('2025-04-22'), NOW), 1.5)
  assert.equal(yearsBetween(new Date('2027-01-01'), NOW), 0)
})

test('activeCertificationNames drops expired and duplicate certifications', () => {
  const certs = companyProfile().organization.certifications
  assert.deepEqual(activeCertificationNames([...certs, ...certs], NOW), [
    'ISO/IEC 27001',
    'Local award',
  ])
})

test('deriveQualification summarizes a company profile', () => {
  const qualification = deriveQualification({ accountType: 'company' }, companyProfile(), NOW)

  assert.deepEqual(qualification, {
    registeredCapitalBaht: 5_000_000,
    yearsInBusiness: 6,
    maxPastContractValueBaht: 3_000_000,
    pastContractAgeYears: 2,
    certifications: ['ISO/IEC 27001', 'Local award'],
    isThaiJuristicPerson: true,
    isSme: true,
    hasPositiveNetWorth: true,
    hasBangkokOffice: false,
    // In STAFF_ROLE_KEYS order, no duplicates
    staffRoles: ['project_manager', 'system_analyst', 'developer'],
  })
})

test('deriveQualification counts a running project as current work', () => {
  const profile = { ...emptyProfile(), projects: [project({ contractValueBaht: 500_000 })] }
  const qualification = deriveQualification({ accountType: 'company' }, profile, NOW)

  assert.equal(qualification.maxPastContractValueBaht, 500_000)
  assert.equal(qualification.pastContractAgeYears, 0)
})

test('deriveQualification for an individual uses only their own roles and no company fields', () => {
  const profile = {
    ...companyProfile(),
    self: person({ roles: ['security_specialist'] }),
  }
  const qualification = deriveQualification({ accountType: 'personal' }, profile, NOW)

  assert.equal(qualification.isThaiJuristicPerson, false)
  assert.equal(qualification.registeredCapitalBaht, null)
  assert.equal(qualification.yearsInBusiness, null)
  assert.equal(qualification.isSme, null)
  assert.deepEqual(qualification.certifications, [])
  assert.deepEqual(qualification.staffRoles, ['security_specialist'])
  // Past work belongs to the bidder either way
  assert.equal(qualification.maxPastContractValueBaht, 3_000_000)
})

test('the derived qualification plugs straight into isFullyQualified', () => {
  const user = {
    status: 'active',
    accountType: 'company',
    interests: ['web_application'],
    qualification: deriveQualification({ accountType: 'company' }, companyProfile(), NOW),
  }
  const tor = {
    categories: ['web_application'],
    eligibility: {
      minRegisteredCapitalBaht: 1_000_000,
      minYearsInBusiness: 3,
      minPastContractValueBaht: 2_000_000,
      // Certifications are names now, so the key matcher cannot check them (the AI matcher does)
      requiredCertifications: [],
      requiresThaiJuristicPerson: true,
      maxPastWorkAgeYears: 3,
      requiredStaffRoles: ['project_manager'],
      unmappedQualifications: [],
    },
  }

  assert.deepEqual(isFullyQualified(user, tor), { qualified: true, reasons: [] })
})

test('profileCompleteness lists what a company still has to fill in', () => {
  const result = profileCompleteness({ accountType: 'company', companyName: 'Acme' }, null)

  assert.equal(result.isComplete, false)
  assert.deepEqual(result.missing, [
    'businessType',
    'organization.registeredCapitalBaht',
    'projects',
  ])
  assert.equal(result.percentage, 25)
})

test('profileCompleteness is complete for a company with capital, business type and priced work', () => {
  const user = { accountType: 'company', companyName: 'Acme', businessType: 'Software house' }
  const result = profileCompleteness(user, { ...companyProfile(), team: [] })

  assert.deepEqual(result, { isComplete: true, missing: [], percentage: 100 })
})

test('profileCompleteness needs a priced project, not just any project', () => {
  const user = { accountType: 'company', companyName: 'Acme', businessType: 'Software house' }
  const profile = { ...companyProfile(), projects: [project({ contractValueBaht: null })] }

  assert.deepEqual(profileCompleteness(user, profile).missing, ['projects'])
})

test('profileCompleteness checks an individual on name and contact', () => {
  assert.deepEqual(profileCompleteness({ accountType: 'personal', firstName: 'A' }, null).missing, [
    'name',
    'contact',
    'projects',
  ])

  const filled = { accountType: 'personal', firstName: 'A', lastName: 'B', phone: '0812345678' }
  const profile = { ...emptyProfile(), projects: [project({ contractValueBaht: 100_000 })] }
  assert.deepEqual(profileCompleteness(filled, profile).missing, [])
})

test('profileCompleteness flags an account without a bidder type', () => {
  assert.deepEqual(profileCompleteness({ accountType: null }, null).missing, [
    'accountType',
    'projects',
  ])
})
