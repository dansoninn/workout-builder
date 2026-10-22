import { NextResponse } from "next/server";

/**
 * Which commit this deployment runs, so a scheduled check can confirm that
 * production follows `main` (.github/workflows/production-check.yml).
 * Public and harmless: a commit id, nothing else.
 */
export function GET() {
  return NextResponse.json(
    { commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local", environment: process.env.VERCEL_ENV ?? "local" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
