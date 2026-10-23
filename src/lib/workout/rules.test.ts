import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { RULE_CASES } from "./rule-cases";
import { ruleCasesSql } from "./rule-cases-sql";
import { guidelinesSchema } from "@/lib/analytics/guidelines";

import { resultProblem } from "./results";
import { blockParamsValid, capSchema, loadSchema, paceSchema, quantitySchema } from "./rules";

describe("the builder's checks match the database's rules", () => {
  it.each(RULE_CASES.map((c) => [`${c.rule}${c.rule === "params" || c.rule === "result" ? ` ${c.format}` : ""}: ${c.why}`, c] as const))(
    "%s",
    (_label, c) => {
      const valid =
        c.rule === "params" ? blockParamsValid(c.format, c.value)
        : c.rule === "result" ? resultProblem(c.format, c.params, c.value) === null
        : c.rule === "quantity" ? quantitySchema.safeParse(c.value).success
        : c.rule === "load" ? loadSchema.safeParse(c.value).success
        : c.rule === "guidelines" ? guidelinesSchema.safeParse(c.value).success
        : c.rule === "cap" ? capSchema.safeParse(c.value).success
        : paceSchema.safeParse(c.value).success;
      expect(valid).toBe(c.valid);
    },
  );

  it("the database test is generated from the same cases (run `npm run rules:generate`)", () => {
    expect(readFileSync("supabase/tests/database/14_rule_cases.test.sql", "utf8")).toBe(ruleCasesSql());
  });
});
