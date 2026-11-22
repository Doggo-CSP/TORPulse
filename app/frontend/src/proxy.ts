import { NextResponse, type NextRequest } from "next/server";

// Per-request Content-Security-Policy with a nonce (ASVS V3.4.3). Next.js reads the nonce from
// this header while rendering and puts it on its own scripts, so only those scripts run:
// injected <script> tags or inline handlers have no valid nonce and are blocked.
// Pages are dynamically rendered for this (root layout awaits connection()).

const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").origin;

export function buildCsp(nonce: string, isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    // 'strict-dynamic' lets scripts loaded by trusted (nonced) scripts run, nothing else
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // React style={...} attributes and chart libraries need inline styles; styles cannot run code
    "style-src 'self' 'unsafe-inline'",
    // Google account avatars
    "img-src 'self' data: blob: https://lh3.googleusercontent.com",
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (apiOrigin.startsWith("https://")) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
