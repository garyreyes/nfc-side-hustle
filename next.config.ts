import type { NextConfig } from "next";

// No nonce-based CSP here deliberately — that would force every page
// into dynamic rendering (some, like the root /, are static today) and
// requires generating/threading a nonce through proxy.ts, which V4
// intentionally keeps as a thin, optimistic-only auth redirect (see
// ARCHITECTURE.md § V4). 'unsafe-inline' is required regardless, since
// Next's own hydration payload is an inline <script> — this still blocks
// arbitrary third-party script injection and framing, which is the
// actual goal now that a real login page and session cookies exist.
// 'unsafe-eval' only in dev, matching Next's own documented CSP pattern
// — React uses eval() in development to reconstruct server-side error
// stacks in the browser; neither React nor Next use eval in production.
const isDev = process.env.NODE_ENV === "development";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
