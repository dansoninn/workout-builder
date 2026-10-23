// The proposed additions follow the core library's conventions, so an
// approved entry can move into core-exercises.ts as it is.

import { describe, expect, it } from "vitest";

import { AMBIGUOUS_TERMS } from "@/lib/library/ambiguous-terms";
import { CORE_EXERCISES } from "@/lib/library/core-exercises";
import { aliasesOf, musclesOf, patternsOf, slugify } from "@/lib/library/generate";
import { PROPOSED_AMBIGUOUS, PROPOSED_CHANGES, PROPOSED_EXERCISES } from "@/lib/library/proposed-additions";
import { normalizeAlias } from "@/lib/normalize-alias";
import { resolveExercise } from "@/lib/workout/parse";
import { coreLibrary } from "@/lib/workout/test-library";

const proposed = PROPOSED_EXERCISES.map((p) => p.exercise);
const coreAliases = new Map(CORE_EXERCISES.flatMap((e) => aliasesOf(e).map((a) => [a, e.name] as const)));
const library = coreLibrary({}, { exercises: PROPOSED_EXERCISES, changes: PROPOSED_CHANGES, ambiguous: PROPOSED_AMBIGUOUS });

describe("proposed library additions", () => {
  it("are new: no name or slug of the core library, none twice", () => {
    const names = [...CORE_EXERCISES, ...proposed].map((e) => slugify(e.name));
    expect(new Set(names).size).toBe(names.length);
    for (const e of proposed) expect(slugify(e.name)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("have 1–3 patterns summing to 1.00 in steps of 0.1, or none and say why", () => {
    for (const e of proposed) {
      const patterns = patternsOf(e);
      if (patterns.length === 0) {
        expect(e.note, e.name).toMatch(/pattern/);
        continue;
      }
      expect(patterns.length, e.name).toBeLessThanOrEqual(3);
      const tenths = patterns.map(([, w]) => Math.round(w * 1000) / 100);
      for (const t of tenths) expect(Number.isInteger(t) && t > 0, e.name).toBe(true);
      expect(tenths.reduce((a, b) => a + b, 0), e.name).toBe(10);
    }
  });

  it("have at most three primary and three secondary muscles, none in both", () => {
    for (const e of proposed) {
      const { primary, secondary } = musclesOf(e);
      expect(primary.length, e.name).toBeGreaterThan(0);
      expect(primary.length, e.name).toBeLessThanOrEqual(3);
      expect(secondary.length, e.name).toBeLessThanOrEqual(3);
      expect(primary.filter((m) => secondary.includes(m)), e.name).toEqual([]);
    }
  });

  it("have a pace, except holds scored by time", () => {
    for (const { exercise, pace } of PROPOSED_EXERCISES) {
      if (exercise.unit === "time_s") expect(pace, exercise.name).toBeNull();
      else expect(pace?.secPerRep ?? pace?.secPerM, exercise.name).toBeGreaterThan(0);
    }
  });

  it("add no alias the core library already has, nor a generic word", () => {
    const generic = new Set([...AMBIGUOUS_TERMS, ...PROPOSED_AMBIGUOUS].map((t) => t.term));
    const added = [...proposed.flatMap((e) => aliasesOf(e)), ...PROPOSED_CHANGES.flatMap((c) => (c.aliases ?? []).map(normalizeAlias))];
    expect(added.filter((a) => coreAliases.has(a))).toEqual([]);
    expect(added.filter((a) => generic.has(a))).toEqual([]);
    expect(added.length - new Set(added).size).toBe(0);
  });

  it("change only exercises that exist, and ask between exercises that exist", () => {
    const names = new Set([...CORE_EXERCISES, ...proposed].map((e) => e.name));
    for (const c of PROPOSED_CHANGES) expect(names.has(c.exercise), c.exercise).toBe(true);
    for (const t of PROPOSED_AMBIGUOUS) for (const name of t.candidates) expect(names.has(name), name).toBe(true);
  });

  it("every new alias finds its exercise through the parser", () => {
    for (const e of proposed) {
      for (const alias of aliasesOf(e)) {
        const r = resolveExercise(library, alias, {}, "count");
        expect(r.kind === "matched" && r.exercise.name, alias).toBe(e.name);
      }
    }
    for (const c of PROPOSED_CHANGES) {
      for (const alias of c.aliases ?? []) {
        const r = resolveExercise(library, alias, {}, c.exercise === "Row" ? "machine" : "count");
        expect(r.kind === "matched" && r.exercise.name, alias).toBe(c.exercise);
      }
    }
  });
});
