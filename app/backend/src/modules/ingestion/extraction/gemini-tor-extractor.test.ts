import assert from 'node:assert/strict'
import test from 'node:test'

import { analyzeTorWithGemini } from './gemini-tor-extractor.js'

test('sends Gemini a JSON request and parses its response', async () => {
  const analysis = await analyzeTorWithGemini(
    '# TOR',
    { externalId: '1', title: 'Test', detailUrl: 'https://example.com' },
    {
      models: {
        async generateContent(request) {
          assert.equal(request.config.responseMimeType, 'application/json')
          assert.match(request.contents, /<tor_document>\n# TOR/)

          return {
            text: JSON.stringify({
                      isSoftwareRelated: true,
                      classificationReason: 'Software development is required.',
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
})
