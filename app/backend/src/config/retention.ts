// Data retention schedule (ASVS V14.2.7). MongoDB TTL indexes delete these documents
// automatically once they are older than the period below (checked about once a minute).
// Account data (users, bidder profiles, bookmarks) is kept while the account exists and is
// deleted with it; login sessions expire with the idle/absolute timeout; logs are kept 90 days
// in Loki (deploy/logging/loki.yaml).
const DAY_S = 24 * 60 * 60

export const RETENTION_SECONDS = {
  // Admin actions: one year for investigations, then removed
  auditLogs: 365 * DAY_S,
  // AI match results are recomputed on demand; old ones are not needed
  qualificationMatches: 180 * DAY_S,
  // One row per AI call; the daily quota only looks at the last 24 hours
  qualificationAiCalls: 2 * DAY_S,
  // Finished AI jobs (done/skipped/failed); queued and running jobs are never removed
  finishedQualificationJobs: 30 * DAY_S,
  // Finished notification rows (sent/failed/skipped); pending ones are never removed
  finishedNotifications: 365 * DAY_S,
} as const
