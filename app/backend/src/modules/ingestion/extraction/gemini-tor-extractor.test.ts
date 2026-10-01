import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_CATEGORIES } from '../../category/category.defaults.js'
import { analyzeTorWithGemini } from './gemini-tor-extractor.js'

test('sends Gemini a JSON request and parses its response', async () => {
  const analysis = await analyzeTorWithGemini(
    '# TOR',
    { externalId: '1', title: 'Test', detailUrl: 'https://example.com' },
    DEFAULT_CATEGORIES,
    {
      models: {
        async generateContent(request) {
          assert.equal(request.config.responseMimeType, 'application/json')
          assert.match(request.contents, /<tor_document>\n# TOR/)
          assert.match(request.config.systemInstruction, /"cybersecurity": Cybersecurity/)

          return {
            text: JSON.stringify({
              isSoftwareRelated: true,
              classificationReason: 'Software development is required.',
              primaryCategory: 'web',
              categories: ['web', 'cloud'],
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
              confidence: 0.9,
            }),
          }
        },
      },
    },
  )

  assert.equal(analysis.isSoftwareRelated, true)
  assert.equal(analysis.primaryCategory, 'web')
  assert.deepEqual(analysis.categories, ['web', 'cloud'])
})
