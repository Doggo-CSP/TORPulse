import type { RequestHandler } from 'express'
import helmet from 'helmet'

// Security response headers for the API (ASVS V3.2.1, V3.4.x).
// The API serves JSON plus one small HTML page (/api/v1/ingestion/report) that uses inline
// styles and no scripts, so the CSP allows nothing except inline styles, and `sandbox` stops a
// response opened directly in a browser tab from running anything.
export const createSecurityHeaders = ({
  isProduction,
}: {
  isProduction: boolean
}): RequestHandler =>
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'none'"],
        'style-src': ["'unsafe-inline'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"],
        'frame-ancestors': ["'none'"],
        sandbox: [],
      },
    },
    // The frontend (another origin on the same site) reads the API with CORS fetches
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    frameguard: { action: 'deny' },
    // HSTS only means something over HTTPS, which the production proxy (Caddy) provides.
    // Sending it from a plain-HTTP dev server would only confuse local testing.
    strictTransportSecurity: isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  })

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// Cross-site request forgery check (ASVS V3.5.1, V3.5.2).
// Browsers send an Origin header on every POST/PUT/PATCH/DELETE, including "simple" requests
// (form posts, text/plain fetches) that skip the CORS preflight. A state-changing request from a
// browser is accepted only when that Origin is the frontend. Requests with no Origin and no
// Sec-Fetch-Site come from non-browser clients (curl, server-to-server, tests), which cannot
// carry a victim's cookies, so they are left to the normal session checks.
// SameSite=Lax on the session cookie is a second layer.
export const createOriginCheck = (allowedOrigin: string): RequestHandler => {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      next()
      return
    }

    const origin = req.get('origin')
    const fetchSite = req.get('sec-fetch-site')
    const foreignOrigin = origin !== undefined && origin !== allowedOrigin
    const crossSiteWithoutOrigin = origin === undefined && fetchSite === 'cross-site'

    if (foreignOrigin || crossSiteWithoutOrigin) {
      res.status(403).json({ success: false, message: 'คำขอจากต้นทางที่ไม่ได้รับอนุญาต' })
      return
    }

    next()
  }
}
