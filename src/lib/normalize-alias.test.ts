import { describe, expect, it } from "vitest";

import { normalizeAlias } from "@/lib/normalize-alias";

describe("normalizeAlias", () => {
  it.each([
    ["KB Swing", "kb swing"],
    ["Toes-to-bar", "toes to bar"],
    ["Farmer's carry", "farmers carry"],
    ["Farmer’s carry", "farmers carry"],
    ["C&J", "c and j"],
    ["  Wall   ball  ", "wall ball"],
    ["DB bench (heavy)", "db bench heavy"],
    ["Shoulder-to-overhead / S2OH", "shoulder to overhead s2oh"],
    ["Pec Déc", "pec déc"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeAlias(input)).toBe(expected);
  });

  it("is idempotent", () => {
    const once = normalizeAlias("Chest-to-Bar Pull-Up!!");
    expect(normalizeAlias(once)).toBe(once);
  });
});
