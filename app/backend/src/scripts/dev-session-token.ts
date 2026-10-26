import { createHmac, randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'

import MongoStore from 'connect-mongo'
import type { SessionData } from 'express-session'

import { env } from '../config/env.js'
import { database } from '../config/mongoose.js'
import { getApiAuthConfig } from '../modules/auth/auth.config.js'
import { User } from '../modules/auth/user.model.js'

// DEV ONLY: prints a session cookie ("token") for a user so the admin API can be called with
// curl or the VS Code REST Client without going through Google login.
//   npm run dev:token -- admin@example.com --create --role admin
//   npm run dev:token -- user@example.com --create
// --create makes the user when the email does not exist yet (role 'user' unless --role admin).
// Refuses to run when NODE_ENV=production.

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function assertNotProduction(nodeEnv: string | undefined = process.env.NODE_ENV): void {
  if (nodeEnv === 'production') {
    throw new Error('dev:token is a development tool and is disabled when NODE_ENV=production')
  }
}

// Same format express-session writes: "s:" + id + "." + base64 HMAC-SHA256 (no padding),
// URL-encoded as it appears in the Cookie header.
export function signSessionId(sessionId: string, secret: string): string {
  const signature = createHmac('sha256', secret)
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '')
  return encodeURIComponent(`s:${sessionId}.${signature}`)
}

// What express-session + passport store after a real login.
export function buildSessionData(userId: string, now = new Date()): SessionData {
  return {
    cookie: {
      originalMaxAge: SESSION_TTL_MS,
      expires: new Date(now.getTime() + SESSION_TTL_MS),
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: false,
    },
    passport: { user: userId },
  } as unknown as SessionData
}

async function printToken(email: string, create: boolean, role: 'admin' | 'user'): Promise<void> {
  assertNotProduction()
  const { sessionSecret } = getApiAuthConfig()
  await database.connect()

  const store = MongoStore.create({
    mongoUrl: env.MONGODB_URI,
    dbName: env.MONGODB_DATABASE,
    collectionName: 'sessions',
    ttl: SESSION_TTL_MS / 1000,
  })

  try {
    const normalizedEmail = email.trim().toLowerCase()
    let user = await User.findOne({ email: normalizedEmail })

    if (!user && create) {
      user = await User.create({
        googleId: `dev-${normalizedEmail}`,
        name: normalizedEmail.split('@')[0],
        email: normalizedEmail,
        image: null,
        role,
        status: 'active',
      })
      console.log(`Created ${role} ${normalizedEmail}`)
    }

    if (!user) {
      console.error(`No user with email ${normalizedEmail}. Add --create to make one.`)
      process.exitCode = 1
      return
    }

    const sessionId = randomBytes(24).toString('base64url')
    await new Promise<void>((resolve, reject) => {
      store.set(sessionId, buildSessionData(user._id.toString()), (error?: unknown) =>
        error ? reject(error) : resolve(),
      )
    })

    const token = signSessionId(sessionId, sessionSecret)
    console.log(
      `User:   ${user.email} (id ${user._id.toString()}, role ${user.role}, status ${user.status})`,
    )
    console.log(`Token:  ${token}`)
    console.log(`Header: Cookie: torpulse.sid=${token}`)
    console.log(`Valid for 7 days, until logout, or until the user is suspended.`)
  } finally {
    await store.close()
    await database.disconnect()
  }
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  const args = process.argv.slice(2)
  const email = args.find((arg) => !arg.startsWith('--'))
  const roleIndex = args.indexOf('--role')
  const role = roleIndex >= 0 && args[roleIndex + 1] === 'admin' ? 'admin' : 'user'

  if (!email) {
    console.error('Usage: npm run dev:token -- <email> [--create] [--role admin]')
    process.exitCode = 1
  } else {
    printToken(email, args.includes('--create'), role).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
  }
}
