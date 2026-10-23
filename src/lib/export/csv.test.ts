import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

describe("CSV for the gym's data export", () => {
  it("one column per key, nulls empty, nested values as JSON, with a byte-order mark", () => {
    expect(toCsv([{ id: 1, name: "Class", settings: { a: 1 } }, { id: 2, name: null, extra: true }])).toBe(
      '﻿id,name,settings,extra\r\n1,Class,"{""a"":1}",\r\n2,,,true\r\n',
    );
  });

  it("quotes commas, quotes and line breaks; keeps Icelandic letters", () => {
    expect(toCsv([{ raw: 'A. 5 x 5 "heavy", then\nrow' }, { raw: "Styrktartímar þrek" }])).toBe(
      '﻿raw\r\n"A. 5 x 5 ""heavy"", then\nrow"\r\nStyrktartímar þrek\r\n',
    );
  });

  it("text a spreadsheet would run as a formula starts with an apostrophe; numbers stay numbers", () => {
    expect(toCsv([{ v: "=HYPERLINK(1)" }, { v: "-10 burpees" }, { v: "@me" }, { v: "-5" }, { v: "+2.5" }, { v: 7 }])).toBe(
      "﻿v\r\n'=HYPERLINK(1)\r\n'-10 burpees\r\n'@me\r\n-5\r\n+2.5\r\n7\r\n",
    );
  });

  it("the columns can be given, so an empty table still has its header", () => {
    expect(toCsv([], ["id", "name"])).toBe("﻿id,name\r\n");
  });
});
