import assert from 'node:assert/strict'
import test from 'node:test'

import type { BidderProfileInput } from '../user/bidder-profile.qualification.js'
import {
  canReceiveNotification,
  isFullyQualified,
  isNotifiableMatch,
  isTorRelevant,
  missingNotificationFields,
  type NotificationTor,
  type NotificationUser,
} from './eligibility.js'

const readyUser: NotificationUser = {
  status: 'active',
  accountType: 'company',
  companyName: 'Doggo Co., Ltd.',
  registrationNumber: '0105560000000',
  interests: ['web_application'],
  qualification: {
    registeredCapitalBaht: 10_000_000,
    yearsInBusiness: 5,
    maxPastContractValueBaht: 3_000_000,
    certifications: ['iso27001'],
    isThaiJuristicPerson: true,
    isSme: true,
    hasPositiveNetWorth: true,
    pastContractAgeYears: 2,
    hasBangkokOffice: true,
    staffRoles: ['project_manager', 'developer'],
  },
  notificationPrefs: { emailEnabled: true },
}

const qualifyingTor: NotificationTor = {
  reviewStatus: 'unverified',
  submissionDeadlineAt: new Date('2099-01-01'),
  categories: ['web_application'],
  eligibility: {
    minRegisteredCapitalBaht: 5_000_000,
    minYearsInBusiness: 3,
    minPastContractValueBaht: 2_000_000,
    requiredCertifications: ['iso27001'],
    requiresThaiJuristicPerson: true,
    smeOnly: null,
    requiresPositiveNetWorth: true,
    maxPastWorkAgeYears: 3,
    requiresBangkokOffice: true,
    requiredStaffRoles: ['project_manager'],
    unmappedQualifications: [],
  },
}

test('qualifies when every requirement is met', () => {
  assert.deepEqual(isFullyQualified(readyUser, qualifyingTor), { qualified: true, reasons: [] })
})

test('does not qualify on a single partial miss', () => {
  const result = isFullyQualified(readyUser, {
    ...qualifyingTor,
    eligibility: { ...qualifyingTor.eligibility, minYearsInBusiness: 10 },
  })

  assert.equal(result.qualified, false)
  assert.deepEqual(result.reasons, ['years in business below 10'])
})

test('does not qualify when a certification is missing', () => {
  const result = isFullyQualified(readyUser, {
    ...qualifyingTor,
    eligibility: { ...qualifyingTor.eligibility, requiredCertifications: ['cmmi_level3'] },
  })

  assert.equal(result.qualified, false)
})

test('does not qualify a TOR without extracted eligibility', () => {
  assert.equal(isFullyQualified(readyUser, { ...qualifyingTor, eligibility: null }).qualified, false)
})

test('does not qualify when the TOR has unmapped qualifications', () => {
  const result = isFullyQualified(readyUser, {
    ...qualifyingTor,
    eligibility: { ...qualifyingTor.eligibility, unmappedQualifications: ['มีศูนย์บริการในจังหวัด'] },
  })

  assert.equal(result.qualified, false)
})

test('does not qualify when the TOR category is outside the user interests', () => {
  const result = isFullyQualified(readyUser, { ...qualifyingTor, categories: ['data_platform'] })

  assert.equal(result.qualified, false)
})

test('treats a missing profile value as not meeting a stated minimum', () => {
  const user = {
    ...readyUser,
    qualification: { ...readyUser.qualification, registeredCapitalBaht: null },
  }

  assert.equal(isFullyQualified(user, qualifyingTor).qualified, false)
})

test('checks net worth, Bangkok office, past work age and staff roles', () => {
  const failing = (qualification: Record<string, unknown>) =>
    isFullyQualified({ ...readyUser, qualification: { ...readyUser.qualification, ...qualification } }, qualifyingTor)

  assert.deepEqual(failing({ hasPositiveNetWorth: false }).reasons, ['net worth not positive'])
  assert.deepEqual(failing({ hasBangkokOffice: false }).reasons, ['no Bangkok office'])
  assert.deepEqual(failing({ pastContractAgeYears: 4 }).reasons, ['past work older than 3 years'])
  assert.deepEqual(failing({ pastContractAgeYears: null }).reasons, ['past work older than 3 years'])
  assert.deepEqual(failing({ staffRoles: ['developer'] }).reasons, [
    'missing staff role project_manager',
  ])
})

test('needs the same complete profile as the AI score, and email turned on', () => {
  const user = { ...readyUser, businessType: 'Software house' }
  const profile = {
    organization: { registeredCapitalBaht: 10_000_000 },
    projects: [{ contractValueBaht: 3_000_000 }],
  } as unknown as BidderProfileInput

  assert.equal(canReceiveNotification(user, profile), true)
  assert.equal(canReceiveNotification({ ...user, notificationPrefs: { emailEnabled: false } }, profile), false)
  assert.equal(canReceiveNotification({ ...user, status: 'suspended' }, profile), false)
  assert.equal(canReceiveNotification(user, null), false)
  assert.deepEqual(missingNotificationFields({ ...user, businessType: '' }, profile), ['businessType'])
  // Individuals can be notified too
  assert.equal(
    canReceiveNotification(
      { status: 'active', accountType: 'personal', displayName: 'Dao', phone: '0800000000' },
      profile,
    ),
    true,
  )
})

test('only a full score is worth an email', () => {
  assert.equal(isNotifiableMatch({ percentage: 100 }), true)
  assert.equal(isNotifiableMatch({ percentage: 99 }), false)
  assert.equal(isNotifiableMatch({ percentage: null }), false)
})

test('ignores hidden and closed TORs', () => {
  const now = new Date('2026-10-13')

  assert.equal(isTorRelevant(qualifyingTor, now), true)
  assert.equal(isTorRelevant({ ...qualifyingTor, reviewStatus: 'archived' }, now), false)
  assert.equal(
    isTorRelevant({ ...qualifyingTor, submissionDeadlineAt: new Date('2026-10-01') }, now),
    false,
  )
  assert.equal(isTorRelevant({ ...qualifyingTor, submissionDeadlineAt: null }, now), true)
})
