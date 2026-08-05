import 'dotenv/config'
const port = Number(process.env.PORT ?? 8000)
const mongodbUri = process.env.MONGODB_URI
const mongodbDatabase = process.env.MONGODB_DATABASE

if (Number.isNaN(port)) {
  throw new Error('PORT must be a valid number')
}

if (!mongodbUri) {
  throw new Error('MONGODB_URI is required')
}

if (!mongodbDatabase) {
  throw new Error('MONGODB_DATABASE is required')
}

export const env = {
  PORT: port,
  MONGODB_URI: mongodbUri,
  MONGODB_DATABASE: mongodbDatabase,
}
