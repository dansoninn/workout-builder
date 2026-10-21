/** Letters that do not decompose into a plain letter plus an accent. */
const SPECIAL: Record<string, string> = { þ: "th", ð: "d", æ: "ae", ø: "o", œ: "oe", ß: "ss", ł: "l", đ: "d" };

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MAX = 48;

/** A gym address from its name: "Afrek Functional Fitness" → "afrek-functional-fitness". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[þðæøœßłđ]/g, (c) => SPECIAL[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}
