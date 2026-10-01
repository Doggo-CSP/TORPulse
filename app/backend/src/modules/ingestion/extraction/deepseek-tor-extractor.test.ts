import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_CATEGORIES } from '../../category/category.defaults.js'
import { buildSystemPrompt, parseTorAnalysis } from './deepseek-tor-extractor.js'

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
      confidence: 0.9,
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
      confidence: 0.8,
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
      confidence: 0.8,
    }),
  )

  assert.equal(analysis.primaryCategory, null)
  assert.deepEqual(analysis.categories, [])
})

test('lists every category from the database in the system prompt', () => {
  const prompt = buildSystemPrompt([
    ...DEFAULT_CATEGORIES,
    { key: 'gov_cloud', name: 'Gov Cloud', description: 'คลาวด์ภาครัฐ', aiHint: null },
  ])

  for (const { key } of DEFAULT_CATEGORIES) {
    assert.ok(prompt.includes(`"${key}":`), `missing ${key}`)
  }
  assert.match(prompt, /"gov_cloud": Gov Cloud \(คลาวด์ภาครัฐ\)\./)
  assert.match(prompt, /"primaryCategory"/)
})
