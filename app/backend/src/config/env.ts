import 'dotenv/config'
const port = Number(process.env.PORT ?? 8000)
const mongodbUri = process.env.MONGODB_URI
const mongodbDatabase = process.env.MONGODB_DATABASE
const deepseekApiKey = process.env.DEEPSEEK_API_KEY
const deepseekModel = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash'
const govSpendingApiKey = process.env.GOVSPENDING_API_KEY
const govSpendingSyncIntervalMs = Number(process.env.GOVSPENDING_SYNC_INTERVAL_MS ?? 600_000)
const govSpendingFiscalYear = process.env.GOVSPENDING_FISCAL_YEAR
  ? Number(process.env.GOVSPENDING_FISCAL_YEAR)
  : undefined
const govSpendingKeywords = (
  process.env.GOVSPENDING_KEYWORDS ??
  'ซอฟต์แวร์,ระบบสารสนเทศ,พัฒนาระบบ,โปรแกรมคอมพิวเตอร์,แอปพลิเคชัน,เว็บไซต์,software,application,website'
)
  .split(',')
  .map((keyword) => keyword.trim())
  .filter(Boolean)

if (Number.isNaN(port)) {
  throw new Error('PORT must be a valid number')
}

if (!mongodbUri) {
  throw new Error('MONGODB_URI is required')
}

if (!mongodbDatabase) {
  throw new Error('MONGODB_DATABASE is required')
}

if (!Number.isFinite(govSpendingSyncIntervalMs) || govSpendingSyncIntervalMs <= 0) {
  throw new Error('GOVSPENDING_SYNC_INTERVAL_MS must be a positive number')
}

if (
  govSpendingFiscalYear !== undefined &&
  (!Number.isInteger(govSpendingFiscalYear) || govSpendingFiscalYear < 2500)
) {
  throw new Error('GOVSPENDING_FISCAL_YEAR must be a valid Thai fiscal year')
}

export const env = {
  PORT: port,
  MONGODB_URI: mongodbUri,
  MONGODB_DATABASE: mongodbDatabase,
  DEEPSEEK_API_KEY: deepseekApiKey,
  DEEPSEEK_MODEL: deepseekModel,
  GOVSPENDING_API_KEY: govSpendingApiKey,
  GOVSPENDING_SYNC_INTERVAL_MS: govSpendingSyncIntervalMs,
  GOVSPENDING_FISCAL_YEAR: govSpendingFiscalYear,
  GOVSPENDING_KEYWORDS: govSpendingKeywords,
}
