import pino, { type Logger } from 'pino'

// Structured application logging (ASVS V16.2.x, V16.4.1). Every entry is one JSON line on
// stdout with an ISO-8601 UTC timestamp, the service name, a level and a message. JSON encoding
// escapes CR/LF and quotes inside values, so user-controlled text cannot forge extra log lines.
// Docker's Loki driver ships stdout to the separate log store (see docs, logging inventory).
//
// Under `node --test` (NODE_TEST_CONTEXT is set) logging is silent unless LOG_LEVEL is set.

const defaultLevel = process.env.NODE_TEST_CONTEXT ? 'silent' : 'info'

// Fields that must never reach the logs (ASVS V16.2.5). Paths are matched anywhere they appear
// in a log object; values are replaced, the key stays so the entry shows something was there.
export const REDACT_PATHS = [
  'password',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'code',
  'otp',
  'cookie',
  'authorization',
  '*.password',
  '*.secret',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.idToken',
  '*.code',
  '*.otp',
  '*.cookie',
  '*.authorization',
  'req.headers.cookie',
  'req.headers.authorization',
  'headers.cookie',
  'headers.authorization',
]

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? defaultLevel,
  base: { service: process.env.SERVICE_NAME ?? 'torpulse-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: 'msg',
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  serializers: { err: pino.stdSerializers.err, error: pino.stdSerializers.err },
})

const serialize = (value: unknown): unknown =>
  value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value

type LogMethod = (first: unknown, ...rest: unknown[]) => void

const method =
  (level: 'info' | 'warn' | 'error' | 'debug'): LogMethod =>
  (first, ...rest) => {
    const msg = typeof first === 'string' ? first : first instanceof Error ? first.message : ''
    const extra = typeof first === 'string' ? rest : [first, ...rest]
    if (extra.length === 0) {
      logger[level](msg)
      return
    }
    const errors = extra.filter((value) => value instanceof Error)
    logger[level](
      {
        ...(errors[0] ? { err: errors[0] } : {}),
        extra: extra.filter((value) => !(value instanceof Error)).map(serialize),
      },
      msg,
    )
  }

// console-style helpers for worker and module code: log.info('message', anyValue, error)
export const log = {
  info: method('info'),
  warn: method('warn'),
  error: method('error'),
  debug: method('debug'),
}

// Security-relevant events (ASVS V16.3.x) share one shape so they can be queried together in
// Loki: {category: "security", event: "auth.login.failure", outcome, userId, ip, requestId, ...}
export type SecurityEvent =
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.logout'
  | 'auth.mfa.sent'
  | 'auth.mfa.success'
  | 'auth.mfa.failure'
  | 'auth.mfa.locked'
  | 'auth.reauth.success'
  | 'auth.reauth.failure'
  | 'auth.reauth.required'
  | 'auth.new_device'
  | 'session.expired'
  | 'session.revoked'
  | 'session.context_changed'
  | 'authz.denied'
  | 'csrf.blocked'
  | 'ratelimit.blocked'
  | 'input.rejected'
  | 'outbound.blocked'

export const securityEvent = (
  event: SecurityEvent,
  fields: Record<string, unknown> = {},
  level: 'info' | 'warn' = 'warn',
): void => {
  logger[level]({ category: 'security', event, ...fields }, event)
}
