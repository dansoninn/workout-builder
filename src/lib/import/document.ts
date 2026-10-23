import { strFromU8, unzipSync } from "fflate";

import { readXlsx, type Sheet, xmlText } from "./xlsx";

/**
 * A programming document as the import reads it (BACKLOG "Program import",
 * 2026-10-23): cells (a spreadsheet, a CSV, the tables of a Word document)
 * or lines of text (a Word document without tables, a PDF's text, pasted
 * text). Only text is kept; the file itself is never stored.
 */
export type ImportDocument =
  | { kind: "grid"; name: string; sheets: Pick<Sheet, "name" | "rows">[] }
  | { kind: "text"; name: string; text: string };

export type SourceKind = "xlsx" | "csv" | "docx" | "pdf" | "text";

/** The kind of a file, by its name. */
export function sourceKindOf(fileName: string): SourceKind | null {
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (ext === "xlsx" || ext === "xlsm") return "xlsx";
  if (ext === "csv" || ext === "tsv") return "csv";
  if (ext === "docx") return "docx";
  if (ext === "pdf") return "pdf";
  if (ext === "txt" || ext === "md") return "text";
  return null;
}

/** Reads a spreadsheet: every sheet's cells, rows of equal width. */
export function fromXlsx(name: string, bytes: Uint8Array): ImportDocument {
  return { kind: "grid", name, sheets: readXlsx(bytes).sheets.map(({ name, rows }) => ({ name, rows })) };
}

/**
 * Reads a CSV or TSV export (RFC 4180: quoted fields, quotes doubled, line
 * breaks inside quotes). The separator is found from the first line:
 * comma, semicolon (European Excel) or tab.
 */
export function fromCsv(name: string, text: string): ImportDocument {
  const body = text.replace(/^﻿/, "");
  const firstLine = body.split(/\r?\n/, 1)[0] ?? "";
  const separator = [",", ";", "\t"].map((s) => ({ s, n: firstLine.split(s).length })).sort((a, b) => b.n - a.n)[0]!.s;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === separator) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && body[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const width = Math.max(0, ...rows.map((r) => r.length));
  return { kind: "grid", name, sheets: [{ name: name.replace(/\.[a-z]+$/i, ""), rows: rows.map((r) => Array.from({ length: width }, (_, c) => r[c] ?? "")) }] };
}

/** A Word paragraph's text: its runs, tabs and line breaks. */
function paragraphText(xml: string): string {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(tab|br|cr)\b[^>]*\/>/g)]
    .map((m) => (m[2] === "tab" ? "\t" : m[2] ? "\n" : xmlText(m[1] ?? "")))
    .join("");
}

/**
 * Reads a Word document (.docx). Its tables become sheets (one row per table
 * row, a cell's paragraphs joined by line breaks): a weekly plan is often a
 * table. Without a table of some size, its paragraphs are the text.
 */
export function fromDocx(name: string, bytes: Uint8Array): ImportDocument {
  let xml: string;
  try {
    const files = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" });
    xml = strFromU8(files["word/document.xml"] ?? new Uint8Array());
  } catch {
    throw new Error("This file is not a Word document (.docx).");
  }
  if (!xml) throw new Error("This file is not a Word document (.docx).");
  const body = xml.match(/<w:body>([\s\S]*)<\/w:body>/)?.[1] ?? xml;

  const tables: string[][][] = [];
  for (const [table] of body.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)) {
    const rows = [...table.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map(([tr]) =>
      [...tr.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map(([tc]) => [...tc.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(([p]) => paragraphText(p)).join("\n").trim()),
    );
    const width = Math.max(0, ...rows.map((r) => r.length));
    tables.push(rows.map((r) => Array.from({ length: width }, (_, c) => r[c] ?? "")));
  }
  const text = [...body.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, "").matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(([p]) => paragraphText(p)).join("\n");
  const big = tables.filter((t) => t.length >= 3);
  if (big.length > 0) return { kind: "grid", name, sheets: big.map((rows, i) => ({ name: big.length === 1 ? "Table" : `Table ${i + 1}`, rows })) };
  return { kind: "text", name, text: text.replace(/\n{3,}/g, "\n\n").trim() };
}

/** Pasted text, or a PDF's text. */
export function fromText(name: string, text: string): ImportDocument {
  return { kind: "text", name, text: text.replace(/\r\n?/g, "\n").replace(/^﻿/, "") };
}
