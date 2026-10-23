import { strToU8, zipSync } from "fflate";

// For tests: small real files, written the way Excel, Google Sheets and Word
// write theirs, so the import is tested on files and not on the shapes the
// reader expects. Made-up workouts only (a gym's documents stay private).

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function columnName(c: number): string {
  let s = "";
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** An .xlsx file: text in shared strings, numbers as numbers (as Excel keeps a day of the month or a date). */
export function xlsxFile(sheets: { name: string; rows: (string | number)[][] }[]): Uint8Array {
  const shared: string[] = [];
  const sharedIndex = (s: string) => {
    let i = shared.indexOf(s);
    if (i < 0) i = shared.push(s) - 1;
    return i;
  };
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
        .map((s, i) => `<sheet name="${escape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}</Relationships>`,
    ),
  };
  sheets.forEach((sheet, i) => {
    const rows = sheet.rows
      .map((row, r) => {
        const cells = row
          .map((v, c) => {
            if (v === "") return "";
            const ref = `${columnName(c)}${r + 1}`;
            return typeof v === "number" ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="s"><v>${sharedIndex(v)}</v></c>`;
          })
          .join("");
        return `<row r="${r + 1}">${cells}</row>`;
      })
      .join("");
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`,
    );
  });
  files["xl/sharedStrings.xml"] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${shared
      .map((s) => `<si><t xml:space="preserve">${escape(s)}</t></si>`)
      .join("")}</sst>`,
  );
  return zipSync(files);
}

/** A .docx file: paragraphs, and tables (a cell's lines as paragraphs). */
export function docxFile(parts: ({ paragraph: string } | { table: string[][] })[]): Uint8Array {
  const p = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${escape(text)}</w:t></w:r></w:p>`;
  const body = parts
    .map((part) =>
      "paragraph" in part
        ? p(part.paragraph)
        : `<w:tbl>${part.table.map((row) => `<w:tr>${row.map((cell) => `<w:tc>${cell.split("\n").map(p).join("")}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`,
    )
    .join("");
  return zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    "word/document.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
    ),
  });
}
