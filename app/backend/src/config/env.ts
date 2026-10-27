import 'dotenv/config'
const port = Number(process.env.PORT ?? 8000)
const mongodbUri = process.env.MONGODB_URI
const mongodbDatabase = process.env.MONGODB_DATABASE
const geminiModel = process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview'
const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT
const googleCloudLocation = process.env.GOOGLE_CLOUD_LOCATION ?? 'global'
const googleApiKey = process.env.GOOGLE_API_KEY
const discoverySyncIntervalMs = Number(process.env.DISCOVERY_SYNC_INTERVAL_MS ?? 600_000)
const bmaSyncEnabled = (process.env.BMA_SYNC_ENABLED ?? 'true').trim().toLowerCase() !== 'false'
// Comma-separated, e.g. "2570,2569". Every listed year is synced.
const bmaBudgetYears = process.env.BMA_BUDGET_YEAR
  ? process.env.BMA_BUDGET_YEAR.split(',')
      .map((year) => year.trim())
      .filter(Boolean)
      .map(Number)
  : undefined
const bmaKeywords = (
  process.env.BMA_KEYWORDS ??
  'ซอฟต์แวร์,ระบบสารสนเทศ,พัฒนาระบบ,โปรแกรมคอมพิวเตอร์,แอปพลิเคชัน,เว็บไซต์,software,application,website'
)
  .split(',')
  .map((keyword) => keyword.trim())
  .filter(Boolean)
const nodeEnv = process.env.NODE_ENV ?? 'development'
const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const smtpHost = process.env.SMTP_HOST?.trim() || undefined
const smtpPort = Number(process.env.SMTP_PORT ?? 587)
const smtpSecure = (process.env.SMTP_SECURE ?? 'false').trim().toLowerCase() === 'true'
const smtpUser = process.env.SMTP_USER?.trim() || undefined
const smtpPass = process.env.SMTP_PASS || undefined
// Used when the admin has not set a sender email in system settings.
const notificationFromFallback = process.env.NOTIFICATION_FROM?.trim() || undefined
const notificationPollIntervalMs = Number(process.env.NOTIFICATION_POLL_INTERVAL_MS ?? 60_000)
const qualificationPollIntervalMs = Number(process.env.QUALIFICATION_POLL_INTERVAL_MS ?? 10_000)
const qualificationSweepIntervalMs = Number(
  process.env.QUALIFICATION_SWEEP_INTERVAL_MS ?? 10 * 60_000,
)
// Wait after a profile edit, so filling in a form field by field costs one AI call per TOR
const qualificationProfileDelayMs = Number(process.env.QUALIFICATION_PROFILE_DELAY_MS ?? 5 * 60_000)
// AI calls the precompute worker may make in any 24 hours
const qualificationDailyCallLimit = Number(process.env.QUALIFICATION_DAILY_CALL_LIMIT ?? 200)
// Testing only: treat the N latest TORs as open for bids, so closed TORs can be precomputed
const qualificationTestLatestTors = process.env.QUALIFICATION_TEST_LATEST_TORS?.trim()
  ? Number(process.env.QUALIFICATION_TEST_LATEST_TORS)
  : undefined

if (Number.isNaN(port)) {
  throw new Error('PORT must be a valid number')
}

if (!mongodbUri) {
  throw new Error('MONGODB_URI is required')
}

if (!mongodbDatabase) {
  throw new Error('MONGODB_DATABASE is required')
}

if (!Number.isFinite(discoverySyncIntervalMs) || discoverySyncIntervalMs <= 0) {
  throw new Error('DISCOVERY_SYNC_INTERVAL_MS must be a positive number')
}

if (!Number.isInteger(smtpPort) || smtpPort <= 0) {
  throw new Error('SMTP_PORT must be a positive integer')
}

if (!Number.isFinite(notificationPollIntervalMs) || notificationPollIntervalMs <= 0) {
  throw new Error('NOTIFICATION_POLL_INTERVAL_MS must be a positive number')
}

for (const [name, value] of [
  ['QUALIFICATION_POLL_INTERVAL_MS', qualificationPollIntervalMs],
  ['QUALIFICATION_SWEEP_INTERVAL_MS', qualificationSweepIntervalMs],
] as const) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`)
  }
}

if (!Number.isFinite(qualificationProfileDelayMs) || qualificationProfileDelayMs < 0) {
  throw new Error('QUALIFICATION_PROFILE_DELAY_MS must be zero or a positive number')
}

if (!Number.isInteger(qualificationDailyCallLimit) || qualificationDailyCallLimit < 0) {
  throw new Error('QUALIFICATION_DAILY_CALL_LIMIT must be zero or a positive integer')
}

if (
  qualificationTestLatestTors !== undefined &&
  (!Number.isInteger(qualificationTestLatestTors) || qualificationTestLatestTors <= 0)
) {
  throw new Error('QUALIFICATION_TEST_LATEST_TORS must be a positive integer when set')
}

if (
  bmaBudgetYears !== undefined &&
  (bmaBudgetYears.length === 0 ||
    bmaBudgetYears.some((year) => !Number.isInteger(year) || year < 2500))
) {
  throw new Error('BMA_BUDGET_YEAR must be a comma-separated list of valid Thai fiscal years')
}

export const env = {
  PORT: port,
  NODE_ENV: nodeEnv,
  MONGODB_URI: mongodbUri,
  MONGODB_DATABASE: mongodbDatabase,
  GEMINI_MODEL: geminiModel,
  GOOGLE_CLOUD_PROJECT: googleCloudProject,
  GOOGLE_CLOUD_LOCATION: googleCloudLocation,
  GOOGLE_API_KEY: googleApiKey,
  DISCOVERY_SYNC_INTERVAL_MS: discoverySyncIntervalMs,
  BMA_SYNC_ENABLED: bmaSyncEnabled,
  BMA_BUDGET_YEARS: bmaBudgetYears,
  BMA_KEYWORDS: bmaKeywords,
  FRONTEND_URL: frontendUrl,
  SMTP_HOST: smtpHost,
  SMTP_PORT: smtpPort,
  SMTP_SECURE: smtpSecure,
  SMTP_USER: smtpUser,
  SMTP_PASS: smtpPass,
  NOTIFICATION_FROM: notificationFromFallback,
  NOTIFICATION_POLL_INTERVAL_MS: notificationPollIntervalMs,
  QUALIFICATION_POLL_INTERVAL_MS: qualificationPollIntervalMs,
  QUALIFICATION_SWEEP_INTERVAL_MS: qualificationSweepIntervalMs,
  QUALIFICATION_PROFILE_DELAY_MS: qualificationProfileDelayMs,
  QUALIFICATION_DAILY_CALL_LIMIT: qualificationDailyCallLimit,
  QUALIFICATION_TEST_LATEST_TORS: qualificationTestLatestTors,
}
