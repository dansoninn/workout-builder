import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CORE_EXERCISES } from "@/lib/library/core-exercises";
import { EQUIPMENT } from "@/lib/library/equipment";
import {
  MIGRATION_PATH,
  REVIEW_DOC_PATH,
  aliasesOf,
  buildMigrationSql,
  buildReviewMarkdown,
  exerciseId,
  musclesOf,
  patternsOf,
  slugify,
  uuidV5,
} from "@/lib/library/generate";
import { normalizeAlias } from "@/lib/normalize-alias";

const movements = CORE_EXERCISES.filter((e) => e.kind === "movement");
const monostructural = CORE_EXERCISES.filter((e) => e.kind === "monostructural");

const byName = (name: string) => {
  const exercise = CORE_EXERCISES.find((e) => e.name === name);
  if (!exercise) throw new Error(`No exercise named ${name}`);
  return exercise;
};

/** Alias → exercise name, for lookups the way the parser will do them. */
const aliasIndex = new Map(CORE_EXERCISES.flatMap((e) => aliasesOf(e).map((a) => [a, e.name] as const)));

describe("core library: identity", () => {
  it("has unique names and slugs in the database's slug format", () => {
    const slugs = CORE_EXERCISES.map((e) => slugify(e.name));
    expect(new Set(CORE_EXERCISES.map((e) => e.name)).size).toBe(CORE_EXERCISES.length);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("derives stable UUID v5 ids from slugs", () => {
    // RFC 4122 reference vector: "www.example.com" in the DNS namespace.
    expect(uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
    const ids = CORE_EXERCISES.map(exerciseId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("core library: patterns", () => {
  it("every movement has 1–3 patterns whose weights sum to exactly 1.00 in steps of 0.1", () => {
    for (const exercise of movements) {
      const patterns = patternsOf(exercise);
      expect(patterns.length, exercise.name).toBeGreaterThanOrEqual(1);
      expect(patterns.length, exercise.name).toBeLessThanOrEqual(3);
      const tenths = patterns.map(([, weight]) => weight * 10);
      for (const t of tenths) {
        expect(Number.isInteger(Math.round(t * 1e9) / 1e9), `${exercise.name}: step of 0.1`).toBe(true);
        expect(t, exercise.name).toBeGreaterThan(0);
      }
      expect(Math.round(tenths.reduce((a, b) => a + b, 0)), exercise.name).toBe(10);
    }
  });

  it("monostructural exercises have a modality and no patterns or muscles", () => {
    expect(monostructural.length).toBeGreaterThan(0);
    for (const exercise of monostructural) {
      expect(patternsOf(exercise), exercise.name).toEqual([]);
      expect(musclesOf(exercise), exercise.name).toEqual({ primary: [], secondary: [] });
    }
  });

  it("keeps the seven pattern-weight examples from calc spec §3 unchanged", () => {
    const expected: Record<string, Record<string, number>> = {
      "Back squat": { squat: 1 },
      "Air squat": { squat: 1 },
      "Wall ball": { squat: 0.6, v_push: 0.4 },
      "Kettlebell swing": { hinge: 1 },
      "Dumbbell snatch": { hinge: 0.7, v_pull: 0.3 },
      "Toes-to-bar": { core: 0.7, v_pull: 0.3 },
      "Burpee": { h_push: 0.5, jump: 0.5 },
      "Box jump-over": { jump: 1 },
    };
    for (const [name, weights] of Object.entries(expected)) {
      expect(Object.fromEntries(patternsOf(byName(name))), name).toEqual(weights);
    }
  });
});

describe("core library: muscles, plane, equipment", () => {
  it("every movement has 1–3 primary and at most 3 secondary muscles, never both", () => {
    for (const exercise of movements) {
      const { primary, secondary } = musclesOf(exercise);
      expect(primary.length, exercise.name).toBeGreaterThanOrEqual(1);
      expect(primary.length, exercise.name).toBeLessThanOrEqual(3);
      expect(secondary.length, exercise.name).toBeLessThanOrEqual(3);
      expect(primary.filter((m) => secondary.includes(m)), exercise.name).toEqual([]);
      expect(new Set([...primary, ...secondary]).size, exercise.name).toBe(primary.length + secondary.length);
    }
  });

  it("every core exercise has a curated plane", () => {
    for (const exercise of CORE_EXERCISES) expect(exercise.plane, exercise.name).toBeTruthy();
  });

  it("every equipment item is used, and listed once per exercise", () => {
    for (const item of EQUIPMENT) {
      expect(CORE_EXERCISES.some((e) => e.equipment?.includes(item.key)), item.key).toBe(true);
    }
    for (const exercise of CORE_EXERCISES) {
      const keys = exercise.equipment ?? [];
      expect(new Set(keys).size, exercise.name).toBe(keys.length);
    }
  });
});

describe("core library: aliases", () => {
  it("are normalised and include the canonical name", () => {
    for (const exercise of CORE_EXERCISES) {
      const aliases = aliasesOf(exercise);
      expect(aliases[0], exercise.name).toBe(normalizeAlias(exercise.name));
      for (const alias of exercise.aliases ?? []) expect(normalizeAlias(alias), `${exercise.name}: "${alias}"`).toBe(alias);
    }
  });

  it("never point two exercises at the same alias", () => {
    const seen = new Map<string, string>();
    for (const exercise of CORE_EXERCISES) {
      for (const alias of aliasesOf(exercise)) {
        expect(seen.get(alias), `"${alias}" used by ${seen.get(alias)} and ${exercise.name}`).toBeUndefined();
        seen.set(alias, exercise.name);
      }
    }
  });

  it("matches every exercise in the calc spec's worked WODs (§7) and the data spec's alias example (§5)", () => {
    const written: Record<string, string> = {
      "Back squat": "Back squat",
      "DB bench": "Dumbbell bench press",
      "SA DB row": "Single-arm dumbbell row",
      "KB swing": "Kettlebell swing",
      "Russian KBS": "Kettlebell swing",
      "Air squat": "Air squat",
      "DU": "Double-under",
      "Wall ball": "Wall ball",
      "Alt. DB snatch": "Dumbbell snatch",
      "Toes to bar": "Toes-to-bar",
      "Burpee over rower": "Burpee",
      "Box jump over": "Box jump-over",
      "Run": "Run",
      "Row": "Row",
      "Bike": "Air bike",
      "Lunges": "Walking lunge",
    };
    for (const [text, name] of Object.entries(written)) {
      // Plural stripping is the parser's job (Step 4); emulate it minimally here.
      const alias = normalizeAlias(text);
      const match = aliasIndex.get(alias) ?? aliasIndex.get(alias.replace(/s$/, ""));
      expect(match, text).toBe(name);
    }
  });
});

describe("generated files", () => {
  it("the seed migration is up to date with the library source", () => {
    expect(readFileSync(MIGRATION_PATH, "utf8"), "run npm run library:generate").toBe(buildMigrationSql());
  });

  it("the review document is up to date with the library source", () => {
    expect(readFileSync(REVIEW_DOC_PATH, "utf8"), "run npm run library:generate").toBe(buildReviewMarkdown());
  });
});
