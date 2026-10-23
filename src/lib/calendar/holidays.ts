import { addDays } from "@/lib/week";

/**
 * Public holidays a gym can add to its calendar in one go (item 4 of Daniel's
 * list, 2026-10-23), then edit like its own closed days: keep one open,
 * rename it, remove it. Only Iceland so far; a country is a function of the
 * year, so more can be added without a database change.
 */

export interface Holiday {
  date: string;
  name: string;
}

/** Easter Sunday in the Gregorian calendar (the anonymous Meeus/Jones/Butcher algorithm). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday

/** The first `day` (0 = Sunday … 6 = Saturday) on or after `iso`. */
function onOrAfter(iso: string, day: number): string {
  return addDays(iso, (day - weekday(iso) + 7) % 7);
}

/** Holidays in date order, two on the same day as one ("Maundy Thursday and First Day of Summer"). */
function inOrder(holidays: Holiday[]): Holiday[] {
  const byDate = new Map<string, string[]>();
  for (const h of holidays) byDate.set(h.date, [...(byDate.get(h.date) ?? []), h.name]);
  return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, names]) => ({ date, name: names.join(" and ") }));
}

/** Iceland's public holidays (lögbundnir frídagar), in English, in date order. */
export function icelandicHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const y = (md: string) => `${year}-${md}`;
  return inOrder([
    { date: y("01-01"), name: "New Year's Day" },
    { date: addDays(easter, -3), name: "Maundy Thursday" },
    { date: addDays(easter, -2), name: "Good Friday" },
    { date: easter, name: "Easter Sunday" },
    { date: addDays(easter, 1), name: "Easter Monday" },
    // The first Thursday after 18 April.
    { date: onOrAfter(y("04-19"), 4), name: "First Day of Summer" },
    { date: y("05-01"), name: "Labour Day" },
    { date: addDays(easter, 39), name: "Ascension Day" },
    { date: addDays(easter, 49), name: "Whit Sunday" },
    { date: addDays(easter, 50), name: "Whit Monday" },
    { date: y("06-17"), name: "National Day" },
    // The first Monday in August.
    { date: onOrAfter(y("08-01"), 1), name: "Commerce Day" },
    { date: y("12-24"), name: "Christmas Eve" },
    { date: y("12-25"), name: "Christmas Day" },
    { date: y("12-26"), name: "Boxing Day" },
    { date: y("12-31"), name: "New Year's Eve" },
  ]);
}

/** The countries whose holidays a gym can add, by ISO code. */
export const HOLIDAY_COUNTRIES: Record<string, { label: string; holidays: (year: number) => Holiday[] }> = {
  IS: { label: "Iceland", holidays: icelandicHolidays },
};

/** Whether a program runs on a day: within its start and end dates, when it has them. */
export function runsOn(program: { startsOn: string | null; endsOn: string | null }, date: string): boolean {
  return (program.startsOn === null || date >= program.startsOn) && (program.endsOn === null || date <= program.endsOn);
}
