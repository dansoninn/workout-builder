import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

// Smoke test: proves Vitest runs and resolves the "@/" path alias.
describe("cn", () => {
  it("merges conflicting Tailwind classes, last one wins", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });
});
