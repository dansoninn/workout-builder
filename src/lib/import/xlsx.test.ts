import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { cellPosition, excelDate, readXlsx, xmlText } from "./xlsx";

/** A small workbook, written the way Excel and Google Sheets write theirs. */
function workbook(): Uint8Array {
  const sheet = (rows: string, merges = "") =>
    `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData>${merges}</worksheet>`;
  return zipSync({
    "[Content_Types].xml": strToU8("<Types/>"),
    "xl/workbook.xml": strToU8(
      '<workbook xmlns:r="r"><sheets><sheet name="Jan" sheetId="1" r:id="rId1"/><sheet name="Feb &amp; Mar" sheetId="2" r:id="rId2"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="worksheet" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
    ),
    "xl/sharedStrings.xml": strToU8(
      '<sst><si><t>KRAFTUR &amp; ÚTHALD</t></si><si><r><t>AMRAP 12</t></r><r><rPr><b/></rPr><t xml:space="preserve">\n10 burpees</t></r><rPh><t>x</t></rPh></si><si><t/></si></sst>',
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      sheet(
        '<row r="1"><c r="D1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Squat</t></is></c><c r="B2"><v>1.0</v></c><c r="D2" t="s"><v>1</v></c><c r="E2" t="b"><v>1</v></c></row>',
        '<mergeCells count="1"><mergeCell ref="D2:G2"/></mergeCells>',
      ),
    ),
    "xl/worksheets/sheet2.xml": strToU8(sheet('<row r="3"><c r="AB3" t="str"><v>&lt;formula&gt;</v></c></row>')),
  });
}

describe("reading an Excel workbook", () => {
  const book = readXlsx(workbook());

  it("every sheet by name, in order", () => {
    expect(book.sheets.map((s) => s.name)).toEqual(["Jan", "Feb & Mar"]);
  });

  it("text cells, shared and inline, with line breaks and rich text runs; numbers and booleans as written", () => {
    const [jan] = book.sheets;
    expect(jan!.rows[0]![3]).toBe("KRAFTUR & ÚTHALD");
    expect(jan!.rows[1]).toEqual(["Squat", "1.0", "", "AMRAP 12\n10 burpees", "TRUE"]);
  });

  it("merged cells", () => {
    expect(book.sheets[0]!.merges).toEqual([{ top: 1, left: 3, bottom: 1, right: 6 }]);
  });

  it("columns past Z, and a formula's last value", () => {
    expect(book.sheets[1]!.rows[2]![27]).toBe("<formula>");
  });

  it("a file that is not a workbook says so", () => {
    expect(() => readXlsx(strToU8("hello"))).toThrow("This file is not an Excel workbook (.xlsx).");
  });

  it("helpers: cell references, entities, Excel dates", () => {
    expect(cellPosition("A1")).toEqual({ row: 0, column: 0 });
    expect(cellPosition("AA10")).toEqual({ row: 9, column: 26 });
    expect(xmlText("&#252;&#x00FA;&amp;")).toBe("üú&");
    expect(excelDate(45292)).toBe("2024-01-01");
  });
});
