import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { AMBIGUOUS_TERMS } from "@/lib/library/ambiguous-terms";
import { CORE_EXERCISES } from "@/lib/library/core-exercises";
import { EQUIPMENT } from "@/lib/library/equipment";
import {
  IMPLEMENT_COUNT_MIGRATION_PATH,
  LIBRARY_DOC_PATH,
  MIGRATION_PATH,
  aliasesOf,
  buildImplementCountMigrationSql,
  buildLibraryMarkdown,
  buildMigrationSql,
  exerciseByName,
  exerciseId,
  implementCountOf,
  musclesOf,
  patternsOf,
  slugify,
  uuidV5,
} from "@/lib/library/generate";
import { normalizeAlias } from "@/lib/normalize-alias";

const movements = CORE_EXERCISES.filter((e) => e.kind === "movement");
const monostructural = CORE_EXERCISES.filter((e) => e.kind === "monostructural");

/** Alias → exercise name, for lookups the way the parser will do them. */
const aliasIndex = new Map(CORE_EXERCISES.flatMap((e) => aliasesOf(e).map((a) => [a, e.name] as const)));
const termIndex = new Map(AMBIGUOUS_TERMS.map((t) => [t.term, t.candidates]));

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
    for (const exercise of movements.filter((e) => patternsOf(e).length > 0)) {
      const patterns = patternsOf(exercise);
      expect(patterns.length, exercise.name).toBeLessThanOrEqual(3);
      const tenths = patterns.map(([, weight]) => Math.round(weight * 1000) / 100);
      for (const t of tenths) {
        expect(Number.isInteger(t), `${exercise.name}: step of 0.1`).toBe(true);
        expect(t, exercise.name).toBeGreaterThan(0);
      }
      expect(tenths.reduce((a, b) => a + b, 0), exercise.name).toBe(10);
    }
  });

  it("only the calf raise has no pattern, and it says why", () => {
    const patternFree = movements.filter((e) => patternsOf(e).length === 0);
    expect(patternFree.map((e) => e.name)).toEqual(["Calf raise"]);
    for (const exercise of patternFree) expect(exercise.note, exercise.name).toMatch(/pattern/);
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
      expect(Object.fromEntries(patternsOf(exerciseByName(name))), name).toEqual(weights);
    }
  });

  it("applies Daniel's review decisions (2026-10-21)", () => {
    expect(Object.fromEntries(patternsOf(exerciseByName("Sled push")))).toEqual({ lunge: 0.6, carry: 0.4 });
    expect(Object.fromEntries(patternsOf(exerciseByName("Sled drag")))).toEqual({ carry: 1 });
    expect(Object.fromEntries(patternsOf(exerciseByName("Sled pull")))).toEqual({ h_pull: 1 });
    for (const name of ["Toes-to-bar", "Knees-to-elbows", "Hanging knee raise", "Sit-up", "GHD sit-up", "V-up",
      "L-sit", "Hollow hold", "Hollow rock", "Mountain climber"]) {
      const { primary, secondary } = musclesOf(exerciseByName(name));
      expect([...primary, ...secondary], name).toContain("hip_flexors");
    }
    for (const name of ["Trap bar deadlift", "Nordic hamstring curl", "Copenhagen plank", "Calf raise",
      "Lat pulldown", "Face pull", "Box step-over", "Burpee pull-up"]) {
      expect(() => exerciseByName(name), name).not.toThrow();
    }
    expect(musclesOf(exerciseByName("Copenhagen plank")).primary).toContain("adductors");
    expect(exerciseByName("Copenhagen plank").unilateral).toBe(true);
    expect(aliasIndex.get("shuttle run")).toBe("Run");
  });
});

describe("core library: muscles, plane, equipment", () => {
  it("every movement has 1–3 primary and at most 3 secondary muscles, never both", () => {
    for (const exercise of movements) {
      const { primary, secondary } = musclesOf(exercise);
      expect(primary.length, exercise.name).toBeGreaterThanOrEqual(1);
      expect(primary.length, exercise.name).toBeLessThanOrEqual(3);
      expect(secondary.length, exercise.name).toBeLessThanOrEqual(3);
      expect(new Set([...primary, ...secondary]).size, exercise.name).toBe(primary.length + secondary.length);
    }
  });

  it("implement counts follow calc spec §9.8 (DB thruster 2, DB snatch 1) and only loaded movements use 2", () => {
    expect(implementCountOf(exerciseByName("Dumbbell thruster"))).toBe(2);
    expect(implementCountOf(exerciseByName("Dumbbell snatch"))).toBe(1);
    for (const exercise of CORE_EXERCISES) {
      if (implementCountOf(exercise) === 1) continue;
      expect(exercise.kind, exercise.name).toBe("movement");
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

describe("core library: aliases and ambiguous terms", () => {
  it("aliases are normalised and include the canonical name", () => {
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

  it("ambiguous terms are normalised, unique, never core aliases, with 2+ distinct core candidates", () => {
    expect(new Set(AMBIGUOUS_TERMS.map((t) => t.term)).size).toBe(AMBIGUOUS_TERMS.length);
    for (const { term, candidates } of AMBIGUOUS_TERMS) {
      expect(normalizeAlias(term), term).toBe(term);
      expect(aliasIndex.get(term), `"${term}" is also a core alias`).toBeUndefined();
      expect(candidates.length, term).toBeGreaterThanOrEqual(2);
      expect(new Set(candidates).size, term).toBe(candidates.length);
      for (const name of candidates) expect(() => exerciseByName(name), `${term}: ${name}`).not.toThrow();
    }
  });

  it("generic words Daniel listed are ambiguous terms, except the unambiguous ones kept as aliases", () => {
    for (const word of ["squat", "lunge", "clean", "snatch", "jerk", "press", "dip", "muscle up", "bike"]) {
      expect(termIndex.has(word), word).toBe(true);
    }
    expect(aliasIndex.get("bench")).toBe("Bench press");
    expect(aliasIndex.get("row")).toBe("Row");
    expect(aliasIndex.get("ski")).toBe("Ski erg");
    expect(termIndex.get("squat")?.slice(0, 3)).toEqual(["Back squat", "Front squat", "Air squat"]);
  });

  it("resolves every exercise in the calc spec's worked WODs (§7) and the data spec's alias example (§5)", () => {
    // Written term → expected exercise. Generic words resolve to an ambiguous
    // term whose candidates include the expected exercise (the coach picks).
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
      const forms = [normalizeAlias(text), normalizeAlias(text).replace(/s$/, "")];
      const direct = forms.map((f) => aliasIndex.get(f)).find(Boolean);
      const candidates = forms.map((f) => termIndex.get(f)).find(Boolean);
      expect(direct ?? (candidates?.includes(name) ? name : undefined), text).toBe(name);
    }
  });
});

describe("generated files", () => {
  it("the seed migration is up to date with the library source", () => {
    expect(readFileSync(MIGRATION_PATH, "utf8"), "run npm run library:generate").toBe(buildMigrationSql());
  });

  it("the implement-count migration is up to date with the library source", () => {
    expect(readFileSync(IMPLEMENT_COUNT_MIGRATION_PATH, "utf8"), "run npm run library:generate").toBe(
      buildImplementCountMigrationSql(),
    );
  });

  it("the library document is up to date with the library source", () => {
    expect(readFileSync(LIBRARY_DOC_PATH, "utf8"), "run npm run library:generate").toBe(buildLibraryMarkdown());
  });
});
