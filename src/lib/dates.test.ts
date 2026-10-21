import { describe, expect, it } from "vitest";

import { daysUntil, formatShortDate } from "./dates";

describe("dates", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");

  it("counts whole days left, rounding up", () => {
    expect(daysUntil("2026-11-04T12:00:00Z", now)).toBe(14);
    expect(daysUntil("2026-10-21T13:00:00Z", now)).toBe(1);
    expect(daysUntil("2026-10-21T12:00:00Z", now)).toBe(0);
    expect(daysUntil("2026-10-20T12:00:00Z", now)).toBe(-1);
  });

  it("formats dates the same everywhere", () => {
    expect(formatShortDate("2026-10-21T23:30:00Z")).toBe("21 Oct 2026");
  });
});
