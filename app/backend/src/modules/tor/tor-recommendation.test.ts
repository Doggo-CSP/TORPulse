import assert from 'node:assert/strict'
import test from 'node:test'

import {
  matchesInterest,
  rankRecommendations,
  recommendationScore,
  type RecommendationMatch,
} from './tor-recommendation.js'

const day = (n: number) => new Date(Date.UTC(2026, 10, n))
const tor = (id: string, category: string, createdAt = day(1)) => ({
  _id: id,
  category,
  categories: [category],
  createdAt,
})

test('the score weighs the qualification match 70% and the interest 30%', () => {
  assert.equal(recommendationScore(90, true), 93)
  assert.equal(recommendationScore(100, false), 70)
  assert.equal(recommendationScore(60, true), 72)
  assert.equal(recommendationScore(0, false), 0)
})

test('a TOR is in an interest when its primary or any category is', () => {
  const interests = new Set(['ai_ml'])
  assert.equal(matchesInterest(tor('t', 'ai_ml'), interests), true)
  assert.equal(
    matchesInterest({ _id: 't', category: 'web_application', categories: ['web_application', 'ai_ml'], createdAt: day(1) }, interests),
    true,
  )
  assert.equal(matchesInterest(tor('t', 'web_application'), interests), false)
  assert.equal(matchesInterest(tor('t', 'ai_ml'), new Set()), false)
})

test('ranks scored TORs, then those missing a mandatory requirement, then unscored ones', () => {
  const interests = new Set(['web_application'])
  const tors = [
    tor('unscored-old', 'data_bi', day(1)),
    tor('unscored-interest', 'web_application', day(2)),
    tor('unscored-new', 'data_bi', day(3)),
    tor('mandatory-missed', 'web_application'),
    tor('full-other-category', 'data_bi'),
    tor('high-interest', 'web_application'),
  ]
  const matches = new Map<string, RecommendationMatch>([
    ['mandatory-missed', { percentage: 95, allMandatoryMet: false }],
    ['full-other-category', { percentage: 100, allMandatoryMet: true }],
    ['high-interest', { percentage: 90, allMandatoryMet: true }],
    // The AI found no requirements: treated as not scored
    ['unscored-new', { percentage: null, allMandatoryMet: true }],
  ])

  const ranked = rankRecommendations(tors, matches, interests)

  assert.deepEqual(
    ranked.map(({ tor }) => tor._id),
    [
      'high-interest', // 93
      'full-other-category', // 70
      'mandatory-missed', // 97, but a mandatory requirement is not met
      'unscored-interest',
      'unscored-new',
      'unscored-old',
    ],
  )
  assert.deepEqual(ranked[2]!.recommendation, {
    score: 97,
    qualificationPercentage: 95,
    allMandatoryMet: false,
    matchesInterest: true,
  })
  assert.deepEqual(ranked[4]!.recommendation, {
    score: null,
    qualificationPercentage: null,
    allMandatoryMet: null,
    matchesInterest: false,
  })
})
