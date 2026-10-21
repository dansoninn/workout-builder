// The design tokens meet WCAG 2.2 contrast in both themes (docs/DESIGN.md):
// body text 7:1 (AAA), secondary text 4.5:1 (AA), placeholders, input
// borders, focus ring and semantic fills 3:1 (non-text contrast).

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { contrastRatio, oklchToLinearSrgb, themeTokens } from "@/lib/design/color";

const { light, dark } = themeTokens(readFileSync("src/app/globals.css", "utf8"));
const SURFACES = ["background", "surface", "surface-sunken", "surface-raised"];
const PATTERNS = ["squat", "lunge", "hinge", "jump", "h-push", "v-push", "h-pull", "v-pull", "core", "rotation", "carry"];
const INTENTS = ["strength", "conditioning", "skill", "mobility"];
const EFFORTS = ["easy", "moderate", "hard", "max"];

describe("colour maths", () => {
  it("converts OKLCH to sRGB and computes WCAG contrast", () => {
    expect(oklchToLinearSrgb({ l: 1, c: 0, h: 0 }).map((v) => Number(v.toFixed(3)))).toEqual([1, 1, 1]);
    expect(oklchToLinearSrgb({ l: 0, c: 0, h: 0 })).toEqual([0, 0, 0]);
    expect(contrastRatio({ l: 1, c: 0, h: 0 }, { l: 0, c: 0, h: 0 })).toBeCloseTo(21, 1);
  });
});

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("%s theme", (_, t) => {
  const ratio = (fg: string, bg: string) => {
    const a = t[fg];
    const b = t[bg];
    if (!a || !b) throw new Error(`missing token ${a ? bg : fg}`);
    return contrastRatio(a, b);
  };

  it("defines every token in both themes", () => {
    expect(Object.keys(t).sort()).toEqual(Object.keys(light).sort());
  });

  it.each(SURFACES)("body text on %s: at least 7:1", (bg) => {
    expect(ratio("foreground", bg)).toBeGreaterThanOrEqual(7);
  });

  it.each(SURFACES)("secondary text on %s: at least 4.5:1", (bg) => {
    expect(ratio("muted-foreground", bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["primary-text", "destructive", "warning", "success"])("%s as text on the surface: at least 4.5:1", (fg) => {
    expect(ratio(fg, "surface")).toBeGreaterThanOrEqual(4.5);
    expect(ratio(fg, "background")).toBeGreaterThanOrEqual(4.5);
  });

  it("button text on the primary colour: at least 4.5:1", () => {
    expect(ratio("primary-foreground", "primary")).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["subtle-foreground", "placeholders and disabled text"],
    ["input", "form-field borders"],
    ["ring", "the focus ring"],
  ])("%s (%s): at least 3:1 on the surface", (fg) => {
    expect(ratio(fg, "surface")).toBeGreaterThanOrEqual(3);
  });

  it.each([...PATTERNS.map((p) => `pattern-${p}`), ...INTENTS.map((i) => `intent-${i}`), ...EFFORTS.map((e) => `effort-${e}`)])(
    "%s fill: at least 3:1 on the surface",
    (token) => {
      expect(ratio(token, "surface")).toBeGreaterThanOrEqual(3);
    },
  );
});
