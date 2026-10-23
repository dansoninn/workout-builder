/**
 * Rows as CSV for spreadsheets (the gym's data export, PLAN-step-6 6c):
 * UTF-8 with a byte-order mark so Excel reads Icelandic letters, one column
 * per key, nested values as JSON. Text that a spreadsheet would run as a
 * formula (starting with = + - @) gets a leading apostrophe; plain numbers
 * stay numbers. The export's JSON keeps every value exactly as stored.
 */
export function toCsv(rows: readonly Record<string, unknown>[], columns?: readonly string[]): string {
  const keys = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const lines = [keys.map(cell).join(","), ...rows.map((r) => keys.map((k) => cell(r[k])).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^[+-]?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
