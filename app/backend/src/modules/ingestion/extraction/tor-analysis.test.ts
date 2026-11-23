import assert from 'node:assert/strict'
import test from 'node:test'

import { CATEGORY_SEED } from '../../category/category.constants.js'
import { buildSystemPrompt, parseTorAnalysis } from './tor-analysis.js'

test('parses bidder qualifications and defaults missing lists to empty arrays', () => {
  const analysis = parseTorAnalysis(
    JSON.stringify({
      isSoftwareRelated: true,
      classificationReason: 'Requires software development.',
      projectTitle: null,
      agencyName: null,
      summary: null,
      objectives: null,
      requirements: null,
      bidderQualifications: ['จดทะเบียนเป็นนิติบุคคล', 'มีผลงานที่เกี่ยวข้อง'],
      technologies: null,
      budgetBaht: null,
      submissionDeadline: null,
      contactInformation: null,
      classificationConfidence: 1,
      readabilityConfidence: 1,
    }),
  )

  assert.deepEqual(analysis.bidderQualifications, [
    'จดทะเบียนเป็นนิติบุคคล',
    'มีผลงานที่เกี่ยวข้อง',
  ])
  assert.deepEqual(analysis.objectives, [])
  assert.deepEqual(analysis.requirements, [])
})

test('defaults a null bidder qualification list to empty', () => {
  const analysis = parseTorAnalysis(
    JSON.stringify({
      isSoftwareRelated: false,
      classificationReason: 'Not software related.',
      projectTitle: null,
      agencyName: null,
      summary: null,
      objectives: [],
      requirements: [],
      bidderQualifications: null,
      technologies: [],
      budgetBaht: null,
      submissionDeadline: null,
      contactInformation: [],
      classificationConfidence: 1,
      readabilityConfidence: 1,
    }),
  )

  assert.deepEqual(analysis.bidderQualifications, [])
})

test('defaults missing category fields to null and an empty list', () => {
  const analysis = parseTorAnalysis(
    JSON.stringify({
      isSoftwareRelated: true,
      classificationReason: 'Software.',
      projectTitle: null,
      agencyName: null,
      summary: null,
      objectives: [],
      requirements: [],
      bidderQualifications: [],
      technologies: [],
      budgetBaht: null,
      submissionDeadline: null,
      contactInformation: [],
      classificationConfidence: 1,
      readabilityConfidence: 1,
    }),
  )

  assert.equal(analysis.primaryCategory, null)
  assert.deepEqual(analysis.categories, [])
})

test('lists every category from the database in the system prompt', () => {
  const prompt = buildSystemPrompt([
    ...CATEGORY_SEED,
    { key: 'gov_cloud', name: 'Gov Cloud', description: 'คลาวด์ภาครัฐ', aiHint: null },
  ])

  for (const { key } of CATEGORY_SEED) {
    assert.ok(prompt.includes(`"${key}":`), `missing ${key}`)
  }
  assert.match(prompt, /"gov_cloud": Gov Cloud \(คลาวด์ภาครัฐ\)\./)
  assert.match(prompt, /"primaryCategory"/)
})

function rawAnalysis(overrides: Record<string, unknown>): string {
  return JSON.stringify({
    isSoftwareRelated: true,
    classificationReason: 'Requires software development.',
    projectTitle: null,
    agencyName: null,
    summary: null,
    objectives: [],
    requirements: [],
    bidderQualifications: [],
    technologies: [],
    budgetBaht: null,
    submissionDeadline: null,
    contactInformation: [],
    classificationConfidence: 1,
    readabilityConfidence: 1,
    ...overrides,
  })
}

test('computes confidence from model judgment and extracted field coverage', () => {
  const full = parseTorAnalysis(
    rawAnalysis({
      projectTitle: 'จ้างพัฒนาระบบ',
      agencyName: 'กรมตัวอย่าง',
      budgetBaht: 1_000_000,
      submissionDeadline: '2026-12-01',
      requirements: ['พัฒนาระบบ'],
      bidderQualifications: ['เป็นนิติบุคคล'],
    }),
  )
  assert.equal(full.confidence, 1)

  // 3 of 6 fields: 0.4 × 0.7 + 0.4 × 0.5 + 0.2 × 0.4 = 0.56
  const partial = parseTorAnalysis(
    rawAnalysis({
      projectTitle: 'จ้างพัฒนาระบบ',
      budgetBaht: 500_000,
      requirements: ['พัฒนาระบบ'],
      classificationConfidence: 0.7,
      readabilityConfidence: 0.4,
    }),
  )
  assert.equal(partial.confidence, 0.56)
})

test('ignores a self-reported confidence and does not count blank titles', () => {
  const analysis = parseTorAnalysis(rawAnalysis({ confidence: 0.99, projectTitle: '   ' }))

  // No fields found: 0.4 × 1 + 0.4 × 0 + 0.2 × 1
  assert.equal(analysis.confidence, 0.6)
})

test('rejects analysis without the confidence judgment parts', () => {
  assert.throws(
    () => parseTorAnalysis(rawAnalysis({ classificationConfidence: undefined })),
    /invalid shape/,
  )
})

test('asks for rubric judgment scores instead of a placeholder confidence', () => {
  const prompt = buildSystemPrompt(CATEGORY_SEED)

  assert.doesNotMatch(prompt, /"confidence"/)
  assert.match(prompt, /"classificationConfidence"/)
  assert.match(prompt, /"readabilityConfidence"/)
  assert.match(prompt, /Never copy an example value/)
})
