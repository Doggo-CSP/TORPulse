import 'dotenv/config'
const port = Number(process.env.PORT ?? 8000)
const mongodbUri = process.env.MONGODB_URI
const mongodbDatabase = process.env.MONGODB_DATABASE
const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL
const sessionSecret = process.env.SESSION_SECRET

if (Number.isNaN(port)) {
  throw new Error('PORT must be a valid number')
}

if (!mongodbUri) {
  throw new Error('MONGODB_URI is required')
}

if (!mongodbDatabase) {
  throw new Error('MONGODB_DATABASE is required')
}

if (!googleClientId) {
  throw new Error('GOOGLE_CLIENT_ID is required')
}

if (!googleClientSecret) {
  throw new Error('GOOGLE_CLIENT_SECRET is required')
}

if (!googleCallbackUrl) {
  throw new Error('GOOGLE_CALLBACK_URL is required')
}

if (!sessionSecret) {
  throw new Error('SESSION_SECRET is required')
}

export const env = {
  PORT: port,
  MONGODB_URI: mongodbUri,
  MONGODB_DATABASE: mongodbDatabase,
  GOOGLE_CLIENT_ID: googleClientId,
  GOOGLE_CLIENT_SECRET: googleClientSecret,
  GOOGLE_CALLBACK_URL: googleCallbackUrl,
  SESSION_SECRET: sessionSecret,
}
