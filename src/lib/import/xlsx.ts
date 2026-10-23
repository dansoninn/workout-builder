import { strFromU8, unzipSync } from "fflate";

/**
 * Reads an Excel workbook (.xlsx, also Google Sheets' and Numbers' exports)
 * into plain text cells, for the program import and its tests. An .xlsx file
 * is a zip of XML parts; only the parts that hold text are read: the sheets
 * and their names, the shared strings, and merged cells. Formulas give their
 * last computed value; styles, charts and images are ignored. Runs in the
 * browser and on the server, with no XML library (the parts are regular).
 */

export interface Sheet {
  name: string;
  /** rows[r][c]: the cell's text, "" when empty. Rows and columns from 0. */
  rows: string[][];
  /** Merged ranges, from 0: a merged cell's text sits in its top-left cell. */
  merges: { top: number; left: number; bottom: number; right: number }[];
}

export interface Workbook {
  sheets: Sheet[];
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** XML text with its entities decoded. */
export function xmlText(raw: string): string {
  return raw.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** An attribute's value from a tag's attribute text. */
function attribute(attributes: string, name: string): string | null {
  const match = attributes.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return match ? xmlText(match[1]!) : null;
}

/** The text of a shared string or inline string: its <t> runs, without phonetic hints. */
function runsText(xml: string): string {
  return [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)]
    .map((m) => xmlText(m[1] ?? ""))
    .join("");
}

/** "AB12" → column 27 (from 0), row 11 (from 0). */
export function cellPosition(ref: string): { row: number; column: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  let column = 0;
  for (const letter of match[1]!.toUpperCase()) column = column * 26 + (letter.charCodeAt(0) - 64);
  return { row: Number(match[2]) - 1, column: column - 1 };
}

function part(files: Record<string, Uint8Array>, path: string): string | null {
  const bytes = files[path] ?? files[path.replace(/^\//, "")];
  return bytes ? strFromU8(bytes) : null;
}

/** Reads the workbook; throws a readable error when the file is not an .xlsx workbook. */
export function readXlsx(bytes: Uint8Array): Workbook {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (file) => (file.name.startsWith("xl/") && file.name.endsWith(".xml")) || file.name.endsWith(".rels") });
  } catch {
    throw new Error("This file is not an Excel workbook (.xlsx).");
  }
  const workbook = part(files, "xl/workbook.xml");
  if (!workbook) throw new Error("This file is not an Excel workbook (.xlsx).");

  const relations = new Map<string, string>();
  for (const [, attrs] of (part(files, "xl/_rels/workbook.xml.rels") ?? "").matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = attribute(attrs!, "Id");
    const target = attribute(attrs!, "Target");
    if (id && target) relations.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`);
  }

  const shared = [...(part(files, "xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => runsText(m[1] ?? ""));

  const sheets: Sheet[] = [];
  for (const [, attrs] of workbook.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = attribute(attrs!, "name") ?? `Sheet ${sheets.length + 1}`;
    const id = attribute(attrs!, "r:id");
    const xml = id ? part(files, relations.get(id) ?? "") : null;
    if (!xml) continue;
    sheets.push({ name, ...readSheet(xml, shared) });
  }
  return { sheets };
}

function readSheet(xml: string, shared: string[]): Omit<Sheet, "name"> {
  const rows: string[][] = [];
  for (const cell of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = cell[1]!;
    const inner = cell[2] ?? "";
    const position = cellPosition(attribute(attrs, "r") ?? "");
    if (!position) continue;
    const type = attribute(attrs, "t");
    const value = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    let text = "";
    if (type === "s") text = shared[Number(value)] ?? "";
    else if (type === "inlineStr") text = runsText(inner.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? "");
    else if (type === "b") text = value === "1" ? "TRUE" : value === "0" ? "FALSE" : "";
    else if (value !== undefined) text = xmlText(value);
    if (text === "") continue;
    const row = (rows[position.row] ??= []);
    row[position.column] = text;
  }
  // Rows and cells are sparse until filled in: holes count as empty.
  let width = 0;
  for (let r = 0; r < rows.length; r++) width = Math.max(width, rows[r]?.length ?? 0);
  const filled = Array.from({ length: rows.length }, (_, r) => Array.from({ length: width }, (_, c) => rows[r]?.[c] ?? ""));

  const merges = [...xml.matchAll(/<mergeCell\b([^>]*)\/?>/g)].flatMap(([, attrs]) => {
    const [from, to] = (attribute(attrs!, "ref") ?? "").split(":");
    const a = cellPosition(from ?? "");
    const b = cellPosition(to ?? from ?? "");
    return a && b ? [{ top: a.row, left: a.column, bottom: b.row, right: b.column }] : [];
  });
  return { rows: filled, merges };
}

/** An Excel date serial (days since 1899-12-30) as YYYY-MM-DD. */
export function excelDate(serial: number): string {
  return new Date(Math.round((serial - 25569) * 86_400_000)).toISOString().slice(0, 10);
}
