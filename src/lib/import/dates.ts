import { excelDate } from "./xlsx";

/**
 * Dates as programming documents write them: Excel date numbers, ISO dates,
 * 5.1.2026 or 1/5/2026 (day or month first, as the coach confirms), and
 * month and weekday names in English, Icelandic, the other Nordic languages
 * and German ("Jan", "Apríl", "Mánudagur", "Montag"). Plain YYYY-MM-DD out.
 */

const MONTHS: Record<string, number> = {};
const month = (n: number, ...names: string[]) => names.forEach((w) => (MONTHS[w] = n));
month(1, "january", "jan", "janúar", "januar", "januari", "jän", "jänner");
month(2, "february", "feb", "febrúar", "februar", "februari");
month(3, "march", "mar", "mars", "marts", "märz", "maerz", "mrz");
month(4, "april", "apr", "apríl");
month(5, "may", "maí", "mai", "maj");
month(6, "june", "jun", "júní", "juni", "jún");
month(7, "july", "jul", "júlí", "juli", "júl");
month(8, "august", "aug", "ágúst", "ágú", "augusti");
month(9, "september", "sep", "sept");
month(10, "october", "oct", "október", "okt", "oktober");
month(11, "november", "nov", "nóvember", "nóv");
month(12, "december", "dec", "desember", "des", "dezember", "dez");

/** A month's number from its name ("Apríl", "Jan.", "MARCH"), or null. */
export function monthOf(word: string): number | null {
  return MONTHS[word.trim().toLowerCase().replace(/\.$/, "")] ?? null;
}

const WEEKDAYS: Record<string, number> = {};
// 0 = Monday … 6 = Sunday (ISO order, as the calendar).
const weekday = (n: number, ...names: string[]) => names.forEach((w) => (WEEKDAYS[w] = n));
weekday(0, "monday", "mon", "mánudagur", "mánudag", "mán", "mandag", "man", "måndag", "mån", "montag", "mo");
weekday(1, "tuesday", "tue", "tues", "þriðjudagur", "þriðjudag", "þri", "tirsdag", "tir", "tisdag", "tis", "dienstag", "di");
weekday(2, "wednesday", "wed", "miðvikudagur", "miðvikudag", "mið", "onsdag", "ons", "mittwoch", "mi");
weekday(3, "thursday", "thu", "thur", "thurs", "fimmtudagur", "fimmtudag", "fim", "torsdag", "tor", "donnerstag", "do");
weekday(4, "friday", "fri", "föstudagur", "föstudag", "fös", "fredag", "fre", "freitag", "fr");
weekday(5, "saturday", "sat", "laugardagur", "laugardag", "lau", "lørdag", "lør", "lördag", "lör", "samstag", "sa");
weekday(6, "sunday", "sun", "sunnudagur", "sunnudag", "søndag", "søn", "söndag", "sön", "sonntag", "so");

/** A weekday from its name, 0 = Monday … 6 = Sunday, or null. Two-letter German forms only where a column holds weekdays. */
export function weekdayOf(word: string, { short = false } = {}): number | null {
  const w = word.trim().toLowerCase().replace(/\.$/, "");
  if (!short && w.length === 2) return null;
  return WEEKDAYS[w] ?? null;
}

/** The weekday of a date, 0 = Monday … 6 = Sunday. */
export function weekdayOfDate(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A real calendar date as YYYY-MM-DD, or null ("2026-02-30" is not one). */
export function isoOf(year: number, monthNumber: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || !Number.isInteger(day)) return null;
  if (year < 1990 || year > 2100 || monthNumber < 1 || monthNumber > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, monthNumber - 1, day));
  return d.getUTCMonth() === monthNumber - 1 ? `${year}-${pad(monthNumber)}-${pad(day)}` : null;
}

/** A day of the month written alone: "5", "05", "5.", "5.0" (a spreadsheet's number). */
export function dayOfMonth(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2})(?:\.0*)?\.?$/);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 31 ? n : null;
}

export interface DateOptions {
  /** The year when the text has none ("Mon 5 Jan"). */
  year?: number | null;
  /** 5/1/2026: day first (Europe, Iceland) unless the document shows otherwise. */
  dayFirst?: boolean;
}

/**
 * A date in a cell or a heading, or null: "2026-01-05", "5.1.2026", "05/01/26",
 * an Excel date number (45292), "5 Jan 2026", "January 5, 2026",
 * "Mánudagur 5. janúar", "Mon 5/1" (with the year given).
 */
export function readDate(text: string, { year = null, dayFirst = true }: DateOptions = {}): string | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;

  // An Excel date number: 1990–2100 is 32874–73415.
  const serial = t.match(/^(\d{5})(?:\.0+)?$/);
  if (serial) {
    const n = Number(serial[1]);
    return n >= 32874 && n <= 73415 ? excelDate(n) : null;
  }

  const iso = t.match(/(?:^|\D)(\d{4})-(\d{1,2})-(\d{1,2})(?:\D|$)/);
  if (iso) return isoOf(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // 5.1.2026 · 5/1/26 · 1-5-2026 · 5.1 (the year given)
  const numeric = t.match(/(?:^|[^\d.:/-])(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\.?(?:[^\d.:/-]|$)/);
  if (numeric) {
    const [a, b] = [Number(numeric[1]), Number(numeric[2])];
    const y = numeric[3] ? (numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3])) : year;
    if (y) {
      // A number above 12 settles the order whatever the document's habit.
      const first = a > 12 ? true : b > 12 ? false : dayFirst;
      return first ? isoOf(y, b, a) : isoOf(y, a, b);
    }
  }

  // Words: "5 jan 2026", "5. janúar", "january 5, 2026", "mon 5 jan"
  const words = t.replace(/[,]/g, " ").split(" ").filter(Boolean);
  let m: number | null = null;
  let d: number | null = null;
  let y: number | null = null;
  for (const w of words) {
    const asMonth = monthOf(w);
    if (asMonth && m === null) m = asMonth;
    else if (/^\d{4}$/.test(w)) y = Number(w);
    else if (/^\d{1,2}(?:\.|st|nd|rd|th)?$/.test(w) && d === null) d = Number(w.replace(/\D/g, ""));
  }
  if (m && d) return isoOf(y ?? year ?? NaN, m, d);
  return null;
}
