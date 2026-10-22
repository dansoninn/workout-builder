import { describe, expect, it } from "vitest";

import { addDays, dayLabel, weekDays, weekLabel, weekNumber, weekStart } from "./week";

describe("weeks", () => {
  it("start on Monday", () => {
    expect(weekStart("2026-10-21")).toBe("2026-10-19"); // Wednesday
    expect(weekStart("2026-10-19")).toBe("2026-10-19"); // Monday
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // Sunday
    expect(weekStart("2027-01-01")).toBe("2026-12-28"); // across the year
  });

  it("list seven days and read as people write them", () => {
    expect(weekDays("2026-10-19")).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
    expect(dayLabel("2026-10-21")).toBe("Wed 21 Oct");
    expect(weekLabel("2026-10-19")).toBe("19 Oct – 25 Oct 2026");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("numbers weeks the ISO way", () => {
    expect(weekNumber("2026-10-21")).toBe(43);
    expect(weekNumber("2027-01-01")).toBe(53);
    expect(weekNumber("2026-01-01")).toBe(1);
  });
});
