import assert from 'node:assert/strict'
import test from 'node:test'

import { CATEGORY_SEED } from '../../category/category.constants.js'
import { analyzeTorWithGemini } from './gemini-tor-extractor.js'

test('sends Gemini a JSON request and parses its response', async () => {
  const analysis = await analyzeTorWithGemini(
    '# TOR',
    { externalId: '1', title: 'Test', detailUrl: 'https://example.com' },
    CATEGORY_SEED,
    {
      models: {
        async generateContent(request) {
          assert.equal(request.config.responseMimeType, 'application/json')
          assert.match(request.contents, /<tor_document>\n# TOR/)
          assert.match(
            request.config.systemInstruction,
            /"cybersecurity": งานความมั่นคงปลอดภัยไซเบอร์/,
          )

          return {
            text: JSON.stringify({
              isSoftwareRelated: true,
              classificationReason: 'Software development is required.',
              primaryCategory: 'web_application',
              categories: ['web_application', 'cloud_infrastructure'],
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
  assert.equal(analysis.primaryCategory, 'web_application')
  assert.deepEqual(analysis.categories, ['web_application', 'cloud_infrastructure'])
})
