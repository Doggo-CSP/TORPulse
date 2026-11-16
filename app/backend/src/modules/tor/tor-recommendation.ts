// Ranks TORs for GET /tors/recommendations (pure, no DB). The score mixes the user's AI
// qualification match (qualification_matches) with the categories they are interested in:
//   score = 70% × qualification percentage + 30% × (in an interest category ? 100 : 0)
// TORs are listed in three groups:
//   1. scored, every mandatory requirement met — by score
//   2. scored, a mandatory requirement not met — by score
//   3. no score yet (not computed, or the profile is incomplete) — interest category first,
//      then newest

export const QUALIFICATION_WEIGHT = 0.7
export const INTEREST_WEIGHT = 0.3

export interface RecommendationTor {
  _id: unknown
  category?: string | null
  categories?: string[] | null
  createdAt: Date
}

export interface RecommendationMatch {
  percentage: number | null
  allMandatoryMet: boolean
}

export interface Recommendation {
  score: number | null
  qualificationPercentage: number | null
  allMandatoryMet: boolean | null
  matchesInterest: boolean
}

export function matchesInterest(tor: RecommendationTor, interests: ReadonlySet<string>): boolean {
  if (interests.size === 0) return false
  return [...(tor.categories ?? []), ...(tor.category ? [tor.category] : [])].some((key) =>
    interests.has(key),
  )
}

export function recommendationScore(percentage: number, inInterest: boolean): number {
  return Math.round(QUALIFICATION_WEIGHT * percentage + INTEREST_WEIGHT * (inInterest ? 100 : 0))
}

export function recommendationFor(
  tor: RecommendationTor,
  match: RecommendationMatch | undefined,
  interests: ReadonlySet<string>,
): Recommendation {
  const inInterest = matchesInterest(tor, interests)
  // A match with no percentage (the AI found no requirements) counts as not scored
  if (!match || match.percentage === null) {
    return {
      score: null,
      qualificationPercentage: null,
      allMandatoryMet: null,
      matchesInterest: inInterest,
    }
  }
  return {
    score: recommendationScore(match.percentage, inInterest),
    qualificationPercentage: match.percentage,
    allMandatoryMet: match.allMandatoryMet,
    matchesInterest: inInterest,
  }
}

const groupOf = (r: Recommendation): number =>
  r.score === null ? 2 : r.allMandatoryMet ? 0 : 1

/** Orders TORs as described at the top of this file; returns each with its recommendation. */
export function rankRecommendations<T extends RecommendationTor>(
  tors: T[],
  matchesByTorId: ReadonlyMap<string, RecommendationMatch>,
  interests: ReadonlySet<string>,
): { tor: T; recommendation: Recommendation }[] {
  return tors
    .map((tor) => ({
      tor,
      recommendation: recommendationFor(tor, matchesByTorId.get(String(tor._id)), interests),
    }))
    .sort((a, b) => {
      const group = groupOf(a.recommendation) - groupOf(b.recommendation)
      if (group !== 0) return group
      if (a.recommendation.score !== null && b.recommendation.score !== null) {
        const byScore = b.recommendation.score - a.recommendation.score
        if (byScore !== 0) return byScore
      } else {
        const byInterest =
          Number(b.recommendation.matchesInterest) - Number(a.recommendation.matchesInterest)
        if (byInterest !== 0) return byInterest
      }
      return b.tor.createdAt.getTime() - a.tor.createdAt.getTime()
    })
}
