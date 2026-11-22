import { randomUUID } from 'node:crypto'

import type { Request, RequestHandler } from 'express'

import { logger, securityEvent } from '../lib/logger.js'

declare global {
  namespace Express {
    interface Request {
      // Correlates every log line of one request, and is returned to the client in errors
      requestId?: string
    }
  }
}

// Who / where / what for log entries (ASVS V16.2.1). `req.ip` is the client address as reported
// by the trusted proxy (trust proxy = 1 behind Caddy), so a client cannot spoof it (V15.3.4).
export const requestContext = (req: Request): Record<string, unknown> => ({
  requestId: req.requestId,
  method: req.method,
  path: req.path,
  ip: req.ip,
  userId: req.user?._id?.toString(),
  userAgent: req.get('user-agent'),
})

const REJECTION_STATUSES = new Set([400, 401, 403, 413, 415, 429])

// One access-log line per request, plus a security event for every rejected request
// (ASVS V16.3.2, V16.3.3): failed authorization (401/403), input validation (400/413/415)
// and anti-automation (429). Query strings are left out because they may hold search text.
export const requestLogger: RequestHandler = (req, res, next) => {
  req.requestId = randomUUID()
  res.setHeader('X-Request-Id', req.requestId)
  const started = process.hrtime.bigint()

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6
    const entry = { ...requestContext(req), status: res.statusCode, durationMs }

    if (res.statusCode >= 500) {
      logger.error({ category: 'access', ...entry }, 'request failed')
    } else {
      logger.info({ category: 'access', ...entry }, 'request')
    }

    if (REJECTION_STATUSES.has(res.statusCode)) {
      const event =
        res.statusCode === 429
          ? 'ratelimit.blocked'
          : res.statusCode === 401 || res.statusCode === 403
            ? 'authz.denied'
            : 'input.rejected'
      securityEvent(event, entry)
    }
  })

  next()
}
