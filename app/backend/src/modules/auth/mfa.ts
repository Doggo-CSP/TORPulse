import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto'

import type { Request } from 'express'

import { env } from '../../config/env.js'
import { log, securityEvent } from '../../lib/logger.js'
import { escapeHtml } from '../../lib/html.js'
import type { Mailer } from '../notification/mailer.js'
import { User, type KnownDevice } from './user.model.js'

// Second factor after Google sign-in (ASVS V6.3.3): a 6-digit one-time code sent to the
// account's verified Google email. Until the code is entered the session is "pending" and
// every route treats it as logged out (see mfaGate in session-context.middleware.ts).

export const MFA_CODE_TTL_MS = 10 * 60 * 1000
export const MFA_MAX_ATTEMPTS = 5
export const MFA_RESEND_INTERVAL_MS = 60 * 1000
export const MFA_MAX_SENDS = 5
const MAX_KNOWN_DEVICES = 10

declare module 'express-session' {
  interface SessionData {
    mfa?: {
      userId: string
      codeHash: string
      expiresAt: number
      attempts: number
      sentAt: number
      sends: number
    }
    mfaVerifiedAt?: number
  }
}

export interface MfaDependencies {
  // Undefined when SMTP is not configured; then codes are only logged, outside production
  mailer?: Mailer
  secret: string
  isProduction: boolean
  now?: () => number
}

// Codes are stored as an HMAC keyed with the session secret, so a leaked session store does not
// reveal them; comparison is constant-time.
const hashCode = (secret: string, userId: string, code: string): string =>
  createHmac('sha256', secret).update(`${userId}:${code}`).digest('hex')

export const generateCode = (): string => randomInt(0, 1_000_000).toString().padStart(6, '0')

const sameHash = (a: string, b: string): boolean => {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

const fromAddress = (): string =>
  env.NOTIFICATION_FROM ?? env.SMTP_USER ?? 'no-reply@torpulse.local'

export const startMfaChallenge = async (
  req: Request,
  user: { _id: { toString(): string }; email: string; name: string },
  deps: MfaDependencies,
): Promise<'sent' | 'too_soon' | 'too_many'> => {
  const now = (deps.now ?? Date.now)()
  const userId = user._id.toString()
  const previous = req.session.mfa?.userId === userId ? req.session.mfa : undefined

  if (previous && now - previous.sentAt < MFA_RESEND_INTERVAL_MS) {
    return 'too_soon'
  }
  if (previous && previous.sends >= MFA_MAX_SENDS) {
    return 'too_many'
  }

  const code = generateCode()
  req.session.mfa = {
    userId,
    codeHash: hashCode(deps.secret, userId, code),
    expiresAt: now + MFA_CODE_TTL_MS,
    attempts: 0,
    sentAt: now,
    sends: (previous?.sends ?? 0) + 1,
  }

  if (deps.mailer) {
    await deps.mailer.send({
      from: fromAddress(),
      to: user.email,
      subject: 'TORPulse sign-in code',
      text: `Your TORPulse sign-in code is ${code}. It expires in 10 minutes. If you did not try to sign in, change your Google password.`,
      html: `<p>Your TORPulse sign-in code is</p><p style="font-size:24px;letter-spacing:4px"><strong>${code}</strong></p><p>It expires in 10 minutes. If you did not try to sign in, change your Google password.</p>`,
    })
  } else if (!deps.isProduction) {
    // Local development without SMTP only. createApiApp refuses to start in production
    // without SMTP, so this branch can never run there.
    log.warn(`[dev only] MFA code for ${user.email}: ${code}`)
  }

  securityEvent('auth.mfa.sent', { requestId: req.requestId, userId, ip: req.ip }, 'info')
  return 'sent'
}

export type MfaVerifyResult = 'ok' | 'invalid' | 'expired' | 'locked' | 'no_challenge'

export const verifyMfaCode = (
  req: Request,
  code: string,
  deps: MfaDependencies,
): MfaVerifyResult => {
  const challenge = req.session.mfa
  const now = (deps.now ?? Date.now)()

  if (!challenge) return 'no_challenge'
  if (now > challenge.expiresAt) return 'expired'
  if (challenge.attempts >= MFA_MAX_ATTEMPTS) return 'locked'

  if (
    /^\d{6}$/.test(code) &&
    sameHash(challenge.codeHash, hashCode(deps.secret, challenge.userId, code))
  ) {
    return 'ok'
  }

  challenge.attempts += 1
  return challenge.attempts >= MFA_MAX_ATTEMPTS ? 'locked' : 'invalid'
}

// ---- New-device alerts (ASVS V6.3.5) ----

const deviceLabel = (userAgent: string): string => {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Unknown browser'
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Unknown OS'
  return `${browser} on ${os}`
}

// A device is the browser/OS family plus the /24 (IPv4) or /48 (IPv6) network, keyed with the
// session secret so the stored hash cannot be reversed into an address.
export const deviceHash = (secret: string, userAgent: string, ip: string): string => {
  const network = ip.includes(':')
    ? ip.split(':').slice(0, 3).join(':')
    : ip.split('.').slice(0, 3).join('.')
  return createHmac('sha256', secret)
    .update(`${deviceLabel(userAgent)}|${network}`)
    .digest('hex')
}

export const userAgentHash = (userAgent: string): string =>
  createHash('sha256').update(deviceLabel(userAgent)).digest('hex')

export const recordDeviceAndAlert = async (
  req: Request,
  userId: string,
  deps: MfaDependencies,
): Promise<boolean> => {
  const userAgent = req.get('user-agent') ?? ''
  const ip = req.ip ?? ''
  const hash = deviceHash(deps.secret, userAgent, ip)
  const now = new Date((deps.now ?? Date.now)())

  const user = await User.findById(userId).select('+knownDevices email name')
  if (!user) return false

  const devices: KnownDevice[] = user.knownDevices ?? []
  const known = devices.find((device) => device.hash === hash)
  const isFirstDevice = devices.length === 0

  if (known) {
    known.lastSeenAt = now
  } else {
    devices.push({ hash, label: deviceLabel(userAgent), lastSeenAt: now })
    devices.sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
    devices.splice(MAX_KNOWN_DEVICES)
  }
  user.knownDevices = devices
  await user.save()

  // The very first sign-in has nothing to compare against, so it is recorded silently
  if (known || isFirstDevice) return false

  securityEvent('auth.new_device', {
    requestId: req.requestId,
    userId,
    ip,
    device: deviceLabel(userAgent),
  })

  if (deps.mailer) {
    const label = deviceLabel(userAgent)
    await deps.mailer
      .send({
        from: fromAddress(),
        to: user.email,
        subject: 'New sign-in to TORPulse',
        text: `Your TORPulse account was signed in from a new device: ${label}, network ${ip}, at ${now.toISOString()}. If this was not you, sign out and change your Google password.`,
        html: `<p>Your TORPulse account was signed in from a new device.</p><ul><li>Device: ${escapeHtml(label)}</li><li>Network: ${escapeHtml(ip)}</li><li>Time (UTC): ${now.toISOString()}</li></ul><p>If this was not you, sign out and change your Google password.</p>`,
      })
      .catch((error: unknown) => log.error('New-device alert email failed', error))
  }
  return true
}

// Tells the account owner that someone passed Google sign-in but failed the code check.
export const alertMfaLockout = async (req: Request, userId: string, deps: MfaDependencies) => {
  securityEvent('auth.mfa.locked', { requestId: req.requestId, userId, ip: req.ip })
  if (!deps.mailer) return
  const user = await User.findById(userId).select('email')
  if (!user) return
  await deps.mailer
    .send({
      from: fromAddress(),
      to: user.email,
      subject: 'Failed sign-in attempt on TORPulse',
      text: `Someone signed in to your Google account for TORPulse but entered the wrong verification code ${MFA_MAX_ATTEMPTS} times (network ${req.ip ?? 'unknown'}, ${new Date().toISOString()}). If this was not you, change your Google password.`,
      html: `<p>Someone signed in to your Google account for TORPulse but entered the wrong verification code ${MFA_MAX_ATTEMPTS} times.</p><p>Network: ${escapeHtml(req.ip ?? 'unknown')}<br>Time (UTC): ${new Date().toISOString()}</p><p>If this was not you, change your Google password.</p>`,
    })
    .catch((error: unknown) => log.error('MFA lockout alert email failed', error))
}
