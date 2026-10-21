const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days until a moment, rounded up ("in 14 days"); 0 or less once it has passed. Server-side only (reads the clock). */
export function daysUntil(iso: string, now: number = Date.now()): number {
  return Math.ceil((new Date(iso).getTime() - now) / DAY_MS);
}

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "21 Oct 2026". UTC, so the server and the browser agree. */
export function formatShortDate(iso: string): string {
  return shortDate.format(new Date(iso));
}
