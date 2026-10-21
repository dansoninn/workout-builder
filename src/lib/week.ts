/** Calendar weeks run Monday to Sunday (ISO 8601). Dates are plain YYYY-MM-DD strings, no time zones. */

const DAY_MS = 86_400_000;

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return isoDate(new Date(toDate(iso).getTime() + days * DAY_MS));
}

/** The Monday of the week containing `iso`. */
export function weekStart(iso: string): string {
  const day = toDate(iso).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((day + 6) % 7));
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const rangeFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "Mon 20 Oct". */
export function dayLabel(iso: string): string {
  return dayFormat.format(toDate(iso));
}

/** "20 Oct – 26 Oct 2026". */
export function weekLabel(monday: string): string {
  const [start, end] = [rangeFormat.format(toDate(monday)), rangeFormat.format(toDate(addDays(monday, 6)))];
  return `${start.replace(/ \d{4}$/, "")} – ${end}`;
}

/** ISO week number (1–53). */
export function weekNumber(iso: string): number {
  const date = toDate(iso);
  const thursday = new Date(date.getTime() + (3 - ((date.getUTCDay() + 6) % 7)) * DAY_MS);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / DAY_MS / 7 - (3 - ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}
