import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canReceiveNotification,
  isFullyQualified,
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

test('excludes incomplete profiles and users who turned notifications off', () => {
  assert.equal(canReceiveNotification(readyUser), true)
  assert.equal(canReceiveNotification({ ...readyUser, notificationPrefs: { emailEnabled: false } }), false)
  assert.equal(canReceiveNotification({ ...readyUser, status: 'suspended' }), false)
  assert.deepEqual(missingNotificationFields({ ...readyUser, accountType: 'personal' }), [
    'accountType',
  ])
  assert.equal(canReceiveNotification({ ...readyUser, qualification: {} }), false)
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
