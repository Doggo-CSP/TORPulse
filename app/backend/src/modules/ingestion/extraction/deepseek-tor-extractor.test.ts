import assert from 'node:assert/strict'
import test from 'node:test'

import { parseTorAnalysis } from './deepseek-tor-extractor.js'

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
