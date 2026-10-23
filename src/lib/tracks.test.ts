import { describe, expect, it } from "vitest";

import { analyticsPrograms, calendarProgramView, programsParam, programViewParam } from "./tracks";

const CLASS = "11111111-1111-4111-8111-111111111111";
const STRENGTH = "22222222-2222-4222-8222-222222222222";
const OLD = "33333333-3333-4333-8333-333333333333";
const programs = [
  { id: CLASS, archived: false },
  { id: STRENGTH, archived: false },
  { id: OLD, archived: true },
];

describe("the calendar's program", () => {
  it("is the gym's first program for someone who never chose", () => {
    expect(calendarProgramView(null, null, programs)).toEqual({ all: false, programId: CLASS });
  });

  it("is the person's last choice", () => {
    expect(calendarProgramView(null, { programId: STRENGTH, all: false }, programs)).toEqual({ all: false, programId: STRENGTH });
    expect(calendarProgramView(null, { programId: null, all: true }, programs)).toEqual({ all: true });
  });

  it("follows the address over the last choice", () => {
    expect(calendarProgramView(STRENGTH, { programId: null, all: true }, programs)).toEqual({ all: false, programId: STRENGTH });
    expect(calendarProgramView("all", { programId: CLASS, all: false }, programs)).toEqual({ all: true });
    // An archived program can still be looked at through its address.
    expect(calendarProgramView(OLD, null, programs)).toEqual({ all: false, programId: OLD });
  });

  it("falls back to the first active program when the remembered one was archived, or the address is not the gym's", () => {
    expect(calendarProgramView(null, { programId: OLD, all: false }, programs)).toEqual({ all: false, programId: CLASS });
    expect(calendarProgramView("44444444-4444-4444-8444-444444444444", null, programs)).toEqual({ all: false, programId: CLASS });
  });

  it("shows everything when the gym has no active program", () => {
    expect(calendarProgramView(null, null, [{ id: OLD, archived: true }])).toEqual({ all: true });
  });
});

describe("?program= in the address", () => {
  it("reads a program id or all, and the older ?track=", () => {
    expect(programViewParam({ program: CLASS })).toBe(CLASS);
    expect(programViewParam({ program: "all" })).toBe("all");
    expect(programViewParam({ track: CLASS })).toBe(CLASS);
    expect(programViewParam({ program: "Class" })).toBeNull();
    expect(programViewParam({ program: [CLASS, STRENGTH] })).toBeNull();
  });
});

describe("analytics' programs", () => {
  it("is one program by default: the person's calendar program, else the gym's first", () => {
    expect(analyticsPrograms(null, STRENGTH, programs)).toEqual([STRENGTH]);
    expect(analyticsPrograms(null, null, programs)).toEqual([CLASS]);
    expect(analyticsPrograms(null, OLD, programs)).toEqual([CLASS]);
  });

  it("is several only when asked for, in the programs' order, never an unknown one", () => {
    expect(analyticsPrograms([STRENGTH, CLASS], null, programs)).toEqual([CLASS, STRENGTH]);
    expect(analyticsPrograms([OLD], null, programs)).toEqual([OLD]);
    expect(analyticsPrograms(["44444444-4444-4444-8444-444444444444"], null, programs)).toEqual([CLASS]);
  });

  it("reads ?programs=, and ?program= from older links", () => {
    expect(programsParam({ programs: `${CLASS},${STRENGTH}` })).toEqual([CLASS, STRENGTH]);
    expect(programsParam({ program: CLASS })).toEqual([CLASS]);
    expect(programsParam({ programs: "all" })).toBeNull();
    expect(programsParam({})).toBeNull();
  });
});
