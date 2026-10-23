import { describe, expect, it } from "vitest";

import { easterSunday, icelandicHolidays, runsOn } from "./holidays";

describe("Easter Sunday", () => {
  it("falls on the published dates", () => {
    expect([2019, 2024, 2025, 2026, 2027, 2028, 2038].map(easterSunday)).toEqual([
      "2019-04-21", "2024-03-31", "2025-04-20", "2026-04-05", "2027-03-28", "2028-04-16", "2038-04-25",
    ]);
  });
});

describe("Iceland's public holidays", () => {
  it("2026, as published", () => {
    expect(icelandicHolidays(2026).map((h) => `${h.date} ${h.name}`)).toEqual([
      "2026-01-01 New Year's Day",
      "2026-04-02 Maundy Thursday",
      "2026-04-03 Good Friday",
      "2026-04-05 Easter Sunday",
      "2026-04-06 Easter Monday",
      "2026-04-23 First Day of Summer",
      "2026-05-01 Labour Day",
      "2026-05-14 Ascension Day",
      "2026-05-24 Whit Sunday",
      "2026-05-25 Whit Monday",
      "2026-06-17 National Day",
      "2026-08-03 Commerce Day",
      "2026-12-24 Christmas Eve",
      "2026-12-25 Christmas Day",
      "2026-12-26 Boxing Day",
      "2026-12-31 New Year's Eve",
    ]);
  });

  it("the First Day of Summer is the Thursday between 19 and 25 April; Commerce Day the first Monday of August", () => {
    const of = (year: number, name: string) => icelandicHolidays(year).find((h) => h.name === name)!.date;
    expect([2024, 2025, 2027, 2030].map((y) => of(y, "First Day of Summer"))).toEqual(["2024-04-25", "2025-04-24", "2027-04-22", "2030-04-25"]);
    expect([2024, 2025, 2027, 2030].map((y) => of(y, "Commerce Day"))).toEqual(["2024-08-05", "2025-08-04", "2027-08-02", "2030-08-05"]);
  });

  it("two holidays on one day are one entry (one per day on a gym's calendar)", () => {
    // 2011: Easter on 24 April, so Maundy Thursday is the First Day of Summer; 2008: Ascension Day on 1 May.
    expect(icelandicHolidays(2011).filter((h) => h.date === "2011-04-21")).toEqual([{ date: "2011-04-21", name: "Maundy Thursday and First Day of Summer" }]);
    expect(icelandicHolidays(2008).find((h) => h.date === "2008-05-01")?.name).toBe("Labour Day and Ascension Day");
    for (const year of [2008, 2011, 2026, 2038]) {
      const dates = icelandicHolidays(year).map((h) => h.date);
      expect(new Set(dates).size).toBe(dates.length);
    }
  });
});

describe("a program's dates", () => {
  it("runs from its start to its end, both included; open-ended without them", () => {
    const spring = { startsOn: "2026-01-05", endsOn: "2026-05-31" };
    expect(["2026-01-04", "2026-01-05", "2026-05-31", "2026-06-01"].map((d) => runsOn(spring, d))).toEqual([false, true, true, false]);
    expect(runsOn({ startsOn: null, endsOn: null }, "1999-01-01")).toBe(true);
    expect(runsOn({ startsOn: "2026-09-01", endsOn: null }, "2030-01-01")).toBe(true);
  });
});
