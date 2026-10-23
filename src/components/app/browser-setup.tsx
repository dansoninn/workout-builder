"use client";

import { z } from "zod";

// The Content-Security-Policy allows no eval (next.config.ts). Zod otherwise
// probes for it with `new Function` the first time it validates; the probe is
// caught, but the browser still reports it as a policy violation. Without it
// zod validates the same way, only without compiling its checks.
z.config({ jitless: true });

/** Settings the browser needs before any page runs. Renders nothing. */
export function BrowserSetup() {
  return null;
}
