import 'dotenv/config'
const port = Number(process.env.PORT ?? 8000)
const mongodbUri = process.env.MONGODB_URI
const mongodbDatabase = process.env.MONGODB_DATABASE
const deepseekApiKey = process.env.DEEPSEEK_API_KEY
const deepseekModel = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash'
const aiProviderValue = process.env.AI_PROVIDER ?? 'deepseek'
const geminiModel = process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview'
const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT
const googleCloudLocation = process.env.GOOGLE_CLOUD_LOCATION ?? 'global'
const googleApiKey = process.env.GOOGLE_API_KEY
const govSpendingApiKey = process.env.GOVSPENDING_API_KEY
// Scheduled GovSpending discovery; the admin "sync now" only needs the API key.
const govSpendingSyncEnabled =
  (process.env.GOVSPENDING_SYNC_ENABLED ?? 'true').trim().toLowerCase() !== 'false'
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
const bmaSyncEnabled = (process.env.BMA_SYNC_ENABLED ?? 'true').trim().toLowerCase() !== 'false'
// Comma-separated, e.g. 2570,2569. Unset means the current and previous Thai fiscal years.
const bmaBudgetYears = process.env.BMA_BUDGET_YEAR
  ? process.env.BMA_BUDGET_YEAR.split(',')
      .map((year) => year.trim())
      .filter(Boolean)
      .map(Number)
  : undefined
// BMA project titles are Thai, so it falls back to the GovSpending keywords.
const bmaKeywords = process.env.BMA_KEYWORDS
  ? process.env.BMA_KEYWORDS.split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean)
  : govSpendingKeywords
const nodeEnv = process.env.NODE_ENV ?? 'development'

if (Number.isNaN(port)) {
  throw new Error('PORT must be a valid number')
}

if (!mongodbUri) {
  throw new Error('MONGODB_URI is required')
}

if (!mongodbDatabase) {
  throw new Error('MONGODB_DATABASE is required')
}

if (aiProviderValue !== 'deepseek' && aiProviderValue !== 'gemini') {
  throw new Error('AI_PROVIDER must be either deepseek or gemini')
}

const aiProvider: 'deepseek' | 'gemini' = aiProviderValue

if (!Number.isFinite(govSpendingSyncIntervalMs) || govSpendingSyncIntervalMs <= 0) {
  throw new Error('GOVSPENDING_SYNC_INTERVAL_MS must be a positive number')
}

if (
  govSpendingFiscalYear !== undefined &&
  (!Number.isInteger(govSpendingFiscalYear) || govSpendingFiscalYear < 2500)
) {
  throw new Error('GOVSPENDING_FISCAL_YEAR must be a valid Thai fiscal year')
}

if (bmaBudgetYears?.some((year) => !Number.isInteger(year) || year < 2500)) {
  throw new Error('BMA_BUDGET_YEAR must be a comma-separated list of Thai fiscal years')
}

export const env = {
  PORT: port,
  NODE_ENV: nodeEnv,
  MONGODB_URI: mongodbUri,
  MONGODB_DATABASE: mongodbDatabase,
  DEEPSEEK_API_KEY: deepseekApiKey,
  DEEPSEEK_MODEL: deepseekModel,
  AI_PROVIDER: aiProvider,
  GEMINI_MODEL: geminiModel,
  GOOGLE_CLOUD_PROJECT: googleCloudProject,
  GOOGLE_CLOUD_LOCATION: googleCloudLocation,
  GOOGLE_API_KEY: googleApiKey,
  GOVSPENDING_API_KEY: govSpendingApiKey,
  GOVSPENDING_SYNC_ENABLED: govSpendingSyncEnabled,
  GOVSPENDING_SYNC_INTERVAL_MS: govSpendingSyncIntervalMs,
  GOVSPENDING_FISCAL_YEAR: govSpendingFiscalYear,
  GOVSPENDING_KEYWORDS: govSpendingKeywords,
  BMA_SYNC_ENABLED: bmaSyncEnabled,
  BMA_BUDGET_YEARS: bmaBudgetYears,
  BMA_KEYWORDS: bmaKeywords,
}
