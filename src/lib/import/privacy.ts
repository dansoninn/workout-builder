/**
 * Personal data in a programming document (BACKLOG "Program import",
 * GDPR guard): an athlete's email, phone number, kennitala or full name
 * written into a workout ("PR: Jón Jónsson 120 kg"). Found before anything
 * is stored, and removed unless the coach keeps it. Workouts are not
 * personal data; people in them are.
 *
 * Found: emails; phone numbers (Iceland's seven digits, international with
 * a +); Icelandic kennitölur (a valid date and four digits); full
 * Icelandic names (a given name and a -son or -dóttir name). Not found: a
 * first name alone, or a foreign full name — the coach is told to look.
 */

export type PersonalKind = "email" | "phone" | "kennitala" | "name";

export interface PersonalData {
  kind: PersonalKind;
  text: string;
}

const UPPER = "A-ZÁÐÉÍÓÚÝÞÆÖ";
const LOWER = "a-záðéíóúýþæö";
const PATTERNS: Record<PersonalKind, RegExp> = {
  email: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
  // +354 555 1234 · 555-1234 · 5551234 after "sími"/"tel" — not "800-1000 m" or "21-15-9".
  phone: /(?:\+\d{1,3}[\s-]?\d[\d\s-]{5,12}\d|(?<![\d./-])\d{3}[\s-]\d{4}(?![\d./-])(?!\s*(?:m|km|cal|kg|lb|reps?|sec|s|min|x)\b)|(?:sími|simi|tel|phone|gsm)[.:]?\s*\d{7}\b)/gi,
  kennitala: /(?<!\d)(\d{2})(\d{2})(\d{2})-?(\d{4})(?!\d)/g,
  name: new RegExp(`\\b[${UPPER}][${LOWER}]+(?:\\s[${UPPER}][${LOWER}]+)?\\s[${UPPER}][${LOWER}]+(?:son|dóttir|dottir)\\b`, "g"),
};

const validKennitala = (dd: string, mm: string) => Number(dd) % 40 >= 1 && Number(dd) % 40 <= 31 && Number(mm) >= 1 && Number(mm) <= 12;

/** The personal data in a text, each finding once. */
export function findPersonalData(text: string): PersonalData[] {
  const found = new Map<string, PersonalData>();
  for (const kind of Object.keys(PATTERNS) as PersonalKind[]) {
    for (const m of text.matchAll(PATTERNS[kind])) {
      if (kind === "kennitala" && !validKennitala(m[1]!, m[2]!)) continue;
      const value = m[0].trim();
      found.set(`${kind}:${value}`, { kind, text: value });
    }
  }
  return [...found.values()];
}

/** The text with the personal data taken out. */
export function removePersonalData(text: string, found: PersonalData[]): string {
  return found.reduce((t, f) => t.split(f.text).join("[removed]"), text);
}
