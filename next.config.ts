import type { NextConfig } from "next";

const dev = process.env.NODE_ENV === "development";
const onVercel = Boolean(process.env.VERCEL_ENV);
// Vercel's toolbar (comments on preview deployments) loads from vercel.live; production never does.
const toolbar = process.env.VERCEL_ENV === "preview";

/**
 * Content-Security-Policy (PLAN-step-6 6f). The browser only ever talks to
 * this app: Supabase is called from the server, fonts are self-hosted, there
 * are no third-party scripts. Inline scripts and styles stay allowed because
 * Next.js inlines its page data and prerendered pages cannot carry a
 * per-request nonce; everything else is limited to our own origin.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}${toolbar ? " https://vercel.live" : ""}`,
  `style-src 'self' 'unsafe-inline'${toolbar ? " https://vercel.live" : ""}`,
  `img-src 'self' data: blob:${toolbar ? " https://vercel.live https://vercel.com" : ""}`,
  `font-src 'self'${toolbar ? " https://vercel.live https://assets.vercel.com" : ""}`,
  `connect-src 'self'${dev ? " ws:" : ""}${toolbar ? " https://vercel.live wss://ws-us3.pusher.com" : ""}`,
  `frame-src ${toolbar ? "https://vercel.live" : "'none'"}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(onVercel ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Keep the dev-only badge clear of the account menu (bottom left).
  devIndicators: { position: "bottom-right" },
  // End-to-end tests build into their own folder so they never mix with `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    // "Tracks" became "Programs" (Daniel, 2026-10-23); old links keep working.
    return [{ source: "/:gym/settings/tracks", destination: "/:gym/settings/programs", permanent: true }];
  },
};

export default nextConfig;
