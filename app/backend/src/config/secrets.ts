import { readFileSync } from 'node:fs'

// Secrets as files (ASVS V13.3.1, V13.3.2). In production each secret is a Docker secret
// mounted read-only at /run/secrets/<name>, and only the containers that need it get it. For a
// setting NAME, NAME_FILE points at that file and its content becomes NAME. Plain NAME values
// (local .env) still work for development.
export const SECRET_SETTINGS = [
  'MONGODB_URI',
  'SESSION_SECRET',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_API_KEY',
  'SMTP_PASS',
] as const

export const loadSecretFiles = (environment: NodeJS.ProcessEnv = process.env): void => {
  for (const name of SECRET_SETTINGS) {
    const file = environment[`${name}_FILE`]?.trim()
    if (!file) continue
    environment[name] = readFileSync(file, 'utf8').trim()
  }
}

loadSecretFiles()
