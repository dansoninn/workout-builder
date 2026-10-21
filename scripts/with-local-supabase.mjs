#!/usr/bin/env node
// Runs a command with the app pointed at the local Supabase (`supabase start`)
// instead of the remote project in .env.local. Only the public URL and anon
// key are passed on; nothing is printed or written to disk.
//
//   node scripts/with-local-supabase.mjs next dev
import { execFileSync, spawn } from "node:child_process";

let status;
try {
  status = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
} catch {
  console.error("Local Supabase is not running. Start it with: supabase start");
  process.exit(1);
}

const values = Object.fromEntries(
  status
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)="?([^"]*)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
if (!values.API_URL || !values.ANON_KEY) {
  console.error("Could not read the local Supabase URL and anon key from `supabase status`.");
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/with-local-supabase.mjs <command> [args…]");
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: values.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: values.ANON_KEY },
});
child.on("exit", (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 1)));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
