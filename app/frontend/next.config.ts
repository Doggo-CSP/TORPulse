import type { NextConfig } from "next";

// Security response headers for every page (ASVS V3.4.x, V13.4.6).
// The Content-Security-Policy is set per request with a nonce in src/proxy.ts. Browsers ignore
// HSTS on plain HTTP, so sending it from local builds is harmless; behind the HTTPS proxy it
// pins the site to HTTPS for a year.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Emit a self-contained server in .next/standalone for the Docker image
  output: "standalone",
  // Do not advertise the framework and version
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
