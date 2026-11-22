import { securityEvent } from './logger.js'

// Outbound HTTP allowlist (ASVS V1.3.6, V13.2.4, V13.2.5, V15.3.2).
// The backend only ever calls these hosts, over HTTPS on the default port. Redirects are not
// followed automatically: a redirect is followed only when its target is also on the list, at
// most MAX_REDIRECTS times. Anything else is refused and logged as `outbound.blocked`.
//
// Not routed through here (their libraries do their own HTTP), but also fixed hosts:
// - Gemini via @google/genai: generativelanguage.googleapis.com / {region}-aiplatform.googleapis.com
// - Google sign-in token exchange (passport-oauth2): oauth2.googleapis.com
// - SMTP (nodemailer): SMTP_HOST from configuration
// - MongoDB: MONGODB_URI from configuration
export const OUTBOUND_ALLOWLIST: ReadonlySet<string> = new Set([
  // Central e-GP (Comptroller General's Department)
  'process5.gprocurement.go.th',
  // BMA e-GP (Bangkok Metropolitan Administration)
  'egp2.bangkok.go.th',
  'adminapiegp.bangkok.go.th',
  // Google OpenID Connect signing keys
  'www.googleapis.com',
])

const MAX_REDIRECTS = 3

export class OutboundBlockedError extends Error {
  constructor(
    readonly url: string,
    reason: string,
  ) {
    super(`Outbound request blocked (${reason}): ${url}`)
    this.name = 'OutboundBlockedError'
  }
}

const urlOf = (input: Parameters<typeof fetch>[0]): URL =>
  new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)

export const assertAllowedUrl = (url: URL): void => {
  const reason =
    url.protocol !== 'https:'
      ? 'not https'
      : url.port !== '' && url.port !== '443'
        ? 'non-default port'
        : url.username || url.password
          ? 'credentials in URL'
          : !OUTBOUND_ALLOWLIST.has(url.hostname.toLowerCase())
            ? 'host not on allowlist'
            : null
  if (reason) {
    securityEvent('outbound.blocked', {
      url: `${url.protocol}//${url.host}${url.pathname}`,
      reason,
    })
    throw new OutboundBlockedError(url.href, reason)
  }
}

export const allowlistedFetch: typeof fetch = async (input, init) => {
  let url = urlOf(input)
  let requestInit: RequestInit = { ...init, redirect: 'manual' }
  const original = typeof input === 'object' && !(input instanceof URL) ? input : undefined

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    assertAllowedUrl(url)
    const response = await fetch(original && hop === 0 ? original : url, requestInit)

    if (response.status < 300 || response.status >= 400 || response.status === 304) {
      return response
    }

    const location = response.headers.get('location')
    if (!location) return response
    url = new URL(location, url)
    // A redirected POST becomes a GET without body (same as browsers for 301/302/303)
    if (response.status !== 307 && response.status !== 308) {
      requestInit = { ...requestInit, method: 'GET', body: undefined }
    }
  }

  throw new OutboundBlockedError(url.href, 'too many redirects')
}
