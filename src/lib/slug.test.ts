import { describe, expect, it } from "vitest";

import { SLUG_PATTERN, slugify } from "./slug";

describe("slugify", () => {
  it("makes a readable address from a gym name", () => {
    expect(slugify("Afrek Functional Fitness")).toBe("afrek-functional-fitness");
    expect(slugify("  CrossFit   Reykjavík! ")).toBe("crossfit-reykjavik");
  });

  it("spells out Icelandic and other special letters", () => {
    expect(slugify("Þrek & Þol")).toBe("threk-thol");
    expect(slugify("Æfingastöðin")).toBe("aefingastodin");
    expect(slugify("Straße Gym")).toBe("strasse-gym");
  });

  it("always gives a valid address or an empty string", () => {
    for (const name of ["---", "!!!", "Gym 2.0", "a".repeat(80) + " b", "x-".repeat(40)]) {
      const slug = slugify(name);
      expect(slug === "" || SLUG_PATTERN.test(slug)).toBe(true);
      expect(slug.length).toBeLessThanOrEqual(48);
    }
  });
});
