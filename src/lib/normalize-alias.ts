// Normalises what a coach types into the form stored in
// exercise_aliases.alias_normalized: lower-case, no punctuation or symbols,
// single spaces, trimmed. The database CHECK constraint enforces the same form.
//   "Farmer's carry" → "farmers carry"   (apostrophes vanish)
//   "C&J"            → "c and j"
//   "Toes-to-bar"    → "toes to bar"     (other punctuation becomes a space)
export function normalizeAlias(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
