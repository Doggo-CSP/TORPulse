import type { Request, RequestHandler } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'

// Both limiters use express-rate-limit's in-memory store. That is correct while the API runs as
// one container (docker-compose). Running several API replicas would need a shared store
// (e.g. Redis or MongoDB) so the counts are not split between instances.

interface LimiterOptions {
  windowMs: number
  max: number
}

const clientIp = (req: Request): string => ipKeyGenerator(req.ip ?? 'unknown')

// Login attempts per IP. /auth/google and its callback are full-page browser navigations, so
// an over-limit request is sent back to the sign-in page with an error code instead of a
// JSON body the user would see as a blank page.
export const createLoginLimiter = ({
  windowMs,
  max,
  frontendUrl,
}: LimiterOptions & { frontendUrl: string }): RequestHandler =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `login:${clientIp(req)}`,
    handler: (_req, res) => {
      res.redirect(302, `${frontendUrl}/auth?error=rate_limited`)
    },
  })

// /api/v1 requests per logged-in user, or per IP for guests. Keying on the user id means one
// account cannot dodge the limit by changing IP, and users behind one NAT do not share a bucket.
export const createApiLimiter = ({ windowMs, max }: LimiterOptions): RequestHandler =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => (req.user ? `user:${req.user._id.toString()}` : `ip:${clientIp(req)}`),
    handler: (_req, res) => {
      res.status(429).json({ success: false, message: 'คำขอมากเกินไป กรุณาลองใหม่ภายหลัง' })
    },
  })
