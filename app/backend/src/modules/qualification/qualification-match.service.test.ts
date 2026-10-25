import assert from 'node:assert/strict'
import test from 'node:test'

import { Types } from 'mongoose'

import type { PersonRecord } from '../user/bidder-profile.model.js'
import type { RequirementResultRecord } from './qualification-match.model.js'
import {
  buildBidderSnapshot,
  buildMatchPrompt,
  buildMatchUserMessage,
  buildTorSnapshot,
  evaluateQualification,
  hasRequirementText,
  matchAi,
  matchInputVersion,
  parseMatchResponse,
  scoreRequirements,
  type MatchProfile,
  type MatchTor,
} from './qualification-match.service.js'

const NOW = new Date('2026-10-25T00:00:00Z')

const memberId = new Types.ObjectId()

const pm: PersonRecord = {
  _id: memberId,
  fullName: 'สมชาย ใจดี',
  positionTitle: 'Project Manager',
  roles: ['project_manager'],
  yearsExperience: 10,
  employmentType: 'permanent',
  joinedAt: new Date('2021-10-25'),
  education: [
    { level: 'master', field: 'Computer Science', institution: 'X', graduatedYear: 2012 },
  ],
  certifications: [
    { name: 'PMP', issuer: 'PMI', issuedAt: new Date('2019-10-25'), expiresAt: null },
    { name: 'ITIL v3', issuer: '', issuedAt: null, expiresAt: new Date('2020-01-01') },
  ],
  skills: ['Scrum'],
}

const profile: MatchProfile = {
  organization: {
    juristicType: 'company_limited',
    registeredDate: new Date('2016-10-25'),
    registeredCapitalBaht: 5_000_000,
    isSme: true,
    hasPositiveNetWorth: true,
    hasBangkokOffice: true,
    certifications: [
      { name: 'ISO/IEC 27001:2022', issuer: 'BSI', issuedAt: null, expiresAt: null },
    ],
  },
  self: null,
  team: [pm],
  projects: [
    {
      _id: new Types.ObjectId(),
      name: 'ระบบบริหารงานบุคคล',
      clientName: 'กรมบัญชีกลาง',
      clientType: 'government',
      contractValueBaht: 4_000_000,
      startDate: new Date('2023-01-01'),
      endDate: new Date('2024-10-25'),
      role: 'prime',
      categories: ['web_application'],
      technologies: ['React'],
      description: '',
      hasCompletionCertificate: true,
      memberIds: [memberId],
    },
  ],
  updatedAt: new Date('2026-10-20'),
}

const user = {
  _id: new Types.ObjectId(),
  accountType: 'company',
  companyName: 'Doggo Co., Ltd.',
  businessType: 'Software house',
  updatedAt: new Date('2026-10-19'),
}

const tor: MatchTor = {
  _id: new Types.ObjectId(),
  projectTitle: 'จ้างพัฒนาระบบสารสนเทศ',
  budgetBaht: 5_000_000,
  scope: 'x'.repeat(5_000),
  bidderQualifications: ['ทุนจดทะเบียนไม่น้อยกว่า 2 ล้านบาท', 'มีผลงานภาครัฐไม่น้อยกว่า 3 ล้านบาท'],
  requirements: ['ผู้จัดการโครงการต้องมี PMP'],
  evaluationCriteria: [],
  technologies: [],
  updatedAt: new Date('2026-10-01'),
}

const requirement = (overrides: Partial<RequirementResultRecord>): RequirementResultRecord => ({
  requirement: 'r',
  category: 'other',
  mandatory: true,
  status: 'met',
  reason: '',
  suggestion: '',
  ...overrides,
})

test('buildBidderSnapshot sends durations and labels, never people names', () => {
  const snapshot = buildBidderSnapshot(user, profile, NOW)

  assert.equal(snapshot.bidderType, 'juristic_person')
  assert.equal(snapshot.company?.yearsInBusiness, 10)
  assert.equal(snapshot.people[0]?.label, 'คนที่ 1')
  assert.equal(snapshot.people[0]?.yearsAtCompany, 5)
  assert.deepEqual(
    snapshot.people[0]?.certifications.map((cert) => [cert.name, cert.yearsHeld, cert.isExpired]),
    [
      ['PMP', 7, false],
      ['ITIL v3', null, true],
    ],
  )
  assert.equal(snapshot.pastProjects[0]?.yearsSinceDelivery, 2)
  assert.deepEqual(snapshot.pastProjects[0]?.people, ['คนที่ 1'])
  assert.doesNotMatch(JSON.stringify(snapshot), /สมชาย/)
})

test('buildBidderSnapshot for an individual has no company block and uses self', () => {
  const snapshot = buildBidderSnapshot(
    { _id: 'u', accountType: 'personal' },
    { ...profile, self: pm },
    NOW,
  )

  assert.equal(snapshot.bidderType, 'individual')
  assert.equal('company' in snapshot, false)
  assert.equal(snapshot.people.length, 1)
})

test('buildTorSnapshot truncates long text', () => {
  const snapshot = buildTorSnapshot(tor)
  assert.equal(snapshot.scope?.length, 2_001)
})

test('hasRequirementText ignores blank lists', () => {
  assert.equal(hasRequirementText(tor), true)
  assert.equal(
    hasRequirementText({
      ...tor,
      bidderQualifications: [' '],
      requirements: [],
      evaluationCriteria: null,
    }),
    false,
  )
})

test('prompt and message wrap the data and name the allowed values', () => {
  const prompt = buildMatchPrompt()
  assert.match(prompt, /untrusted/)
  assert.match(prompt, /not_met/)
  assert.match(prompt, /certification/)
  assert.match(prompt, /ไม่เป็นผู้ทิ้งงาน/)

  const message = buildMatchUserMessage(tor, buildBidderSnapshot(user, profile, NOW))
  assert.match(message, /^<tor>/)
  assert.match(message, /<bidder>[\s\S]*<\/bidder>$/)
})

test('parseMatchResponse keeps good items, repairs odd values and drops broken ones', () => {
  const parsed = parseMatchResponse(
    JSON.stringify({
      requirements: [
        {
          requirement: 'ทุน 2 ล้าน',
          category: 'financial',
          mandatory: true,
          status: 'met',
          reason: 'ทุน 5 ล้าน',
        },
        { requirement: 'มี PMP', category: 'made_up', status: 'probably' },
        { requirement: '', status: 'met' },
        'not an object',
      ],
      summary: ' ผ่านเกือบทั้งหมด ',
    }),
  )

  assert.deepEqual(parsed, {
    requirements: [
      {
        requirement: 'ทุน 2 ล้าน',
        category: 'financial',
        mandatory: true,
        status: 'met',
        reason: 'ทุน 5 ล้าน',
        suggestion: '',
      },
      {
        requirement: 'มี PMP',
        category: 'other',
        mandatory: true,
        status: 'unknown',
        reason: '',
        suggestion: '',
      },
    ],
    summary: 'ผ่านเกือบทั้งหมด',
  })
})

test('parseMatchResponse rejects invalid JSON and a missing requirements list', () => {
  assert.throws(() => parseMatchResponse('not json'), /invalid JSON/)
  assert.throws(() => parseMatchResponse('{"summary":"x"}'), /invalid shape/)
})

test('scoreRequirements gives half for partial and nothing for unknown', () => {
  const score = scoreRequirements([
    requirement({ status: 'met' }),
    requirement({ status: 'partial' }),
    requirement({ status: 'not_met', mandatory: false }),
    requirement({ status: 'unknown', mandatory: false }),
  ])

  assert.deepEqual(score, {
    percentage: 38,
    allMandatoryMet: false,
    counts: { met: 1, partial: 1, not_met: 1, unknown: 1 },
  })
})

test('scoreRequirements: all mandatory met even with a missed optional point', () => {
  const score = scoreRequirements([
    requirement({ status: 'met' }),
    requirement({ status: 'not_met', mandatory: false }),
  ])
  assert.equal(score.percentage, 50)
  assert.equal(score.allMandatoryMet, true)
})

test('scoreRequirements returns null when there is nothing to judge', () => {
  assert.equal(scoreRequirements([]).percentage, null)
})

test('matchInputVersion changes when the profile, user or TOR changes', () => {
  const base = matchInputVersion(user, profile, tor)
  assert.equal(matchInputVersion(user, profile, tor), base)
  assert.notEqual(
    matchInputVersion(user, { ...profile, updatedAt: new Date('2026-10-21') }, tor),
    base,
  )
  assert.notEqual(matchInputVersion({ ...user, updatedAt: new Date() }, profile, tor), base)
  assert.notEqual(matchInputVersion(user, profile, { ...tor, updatedAt: new Date() }), base)
})

test('evaluateQualification sends the prompt to the AI and scores the answer', async (context) => {
  let sentMessage = ''
  context.mock.method(matchAi, 'judge', async (_system: string, message: string) => {
    sentMessage = message
    return JSON.stringify({
      requirements: [
        {
          requirement: 'ทุน 2 ล้าน',
          category: 'financial',
          mandatory: true,
          status: 'met',
          reason: '',
          suggestion: '',
        },
        {
          requirement: 'PM มี PMP',
          category: 'personnel',
          mandatory: true,
          status: 'met',
          reason: '',
          suggestion: '',
        },
      ],
      summary: 'ผ่าน',
    })
  })

  const result = await evaluateQualification(user, profile, tor, NOW)

  assert.match(sentMessage, /PMP/)
  assert.equal(result.percentage, 100)
  assert.equal(result.allMandatoryMet, true)
  assert.equal(result.summary, 'ผ่าน')
})
