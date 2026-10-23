#!/usr/bin/env node
// Fails if a Supabase key or secret is in anything the browser can download
// (PLAN-step-6 6f): the static bundle and the prerendered pages of a build.
// The browser never talks to Supabase in this app, so not even the anon key
// belongs there. Keys are read from the local stack (`supabase status`) and
// are never printed; only the files they were found in are.
//
//   node scripts/check-bundle.mjs .next-e2e
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const distDir = process.argv[2] ?? ".next";

const status = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const values = Object.fromEntries(
  status
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)="?([^"]*)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const secrets = Object.entries(values).filter(([name, value]) => /KEY|SECRET/.test(name) && value.length >= 16);
if (secrets.length === 0) {
  console.error("Could not read the local Supabase keys from `supabase status`.");
  process.exit(1);
}
// Also any service-role or secret key, whatever its value.
const patterns = [/service_role/, /\bsb_secret_[A-Za-z0-9_-]+/];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|css|html|rsc|json|txt|map|body)$/.test(name)) yield path;
  }
}

const roots = [join(distDir, "static"), join(distDir, "server", "app")];
const found = [];
let scanned = 0;
for (const root of roots) {
  for (const path of files(root)) {
    // Server-only code under server/app is not sent to the browser; its pages and payloads are.
    if (root.endsWith("app") && path.endsWith(".js")) continue;
    const text = readFileSync(path, "utf8");
    scanned++;
    for (const [name, value] of secrets) if (text.includes(value)) found.push(`${path}: ${name}`);
    for (const pattern of patterns) if (pattern.test(text)) found.push(`${path}: matches ${pattern}`);
  }
}

if (found.length > 0) {
  console.error(`Keys in what the browser can download:\n  ${found.join("\n  ")}`);
  process.exit(1);
}
console.log(`No keys in ${scanned} files the browser can download (${roots.join(", ")}).`);
