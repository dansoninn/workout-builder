import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { authPath, gymIndexRedirect, gymSlugOf, isPublicPath, RESERVED_SLUGS, safeNext } from "./paths";

describe("safeNext", () => {
  it("allows paths inside the app", () => {
    expect(safeNext("/afrek/builder")).toBe("/afrek/builder");
    expect(safeNext("/invite/abc?x=1")).toBe("/invite/abc?x=1");
  });

  it("refuses anything that could leave the site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "evil", "", null, undefined, 42]) {
      expect(safeNext(bad)).toBe("/");
    }
  });
});

describe("authPath", () => {
  it("keeps where the user was going", () => {
    expect(authPath("/sign-in", "/afrek/settings/members")).toBe("/sign-in?next=%2Fafrek%2Fsettings%2Fmembers");
    expect(authPath("/sign-up", "/")).toBe("/sign-up");
    expect(authPath("/sign-in", "//evil.example")).toBe("/sign-in");
  });
});

describe("public and gym paths", () => {
  it("knows which pages work without signing in", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/invite/abc")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/api/version")).toBe(true);
    expect(isPublicPath("/afrek/builder")).toBe(false);
    expect(isPublicPath("/onboarding")).toBe(false);
    expect(isPublicPath("/sign-inx")).toBe(false);
  });

  it("finds the gym in a path", () => {
    expect(gymSlugOf("/afrek/builder")).toBe("afrek");
    expect(gymSlugOf("/afrek/settings/members")).toBe("afrek");
    expect(gymSlugOf("/afrek")).toBeNull();
    expect(gymSlugOf("/invite/abc")).toBeNull();
    expect(gymSlugOf("/auth/callback")).toBeNull();
  });

  it("sends gym index addresses to a real page", () => {
    expect(gymIndexRedirect("/afrek")).toBe("/afrek/builder");
    expect(gymIndexRedirect("/afrek/")).toBe("/afrek/builder");
    expect(gymIndexRedirect("/afrek/settings")).toBe("/afrek/settings/gym");
    expect(gymIndexRedirect("/afrek/builder")).toBeNull();
    expect(gymIndexRedirect("/onboarding")).toBeNull();
    expect(gymIndexRedirect("/")).toBeNull();
  });

  it("reserves the same addresses as the database", () => {
    const sql = readFileSync("supabase/migrations/20261021001400_invitations.sql", "utf8");
    const list = sql.match(/organizations_slug_not_reserved check \(slug not in \(([\s\S]*?)\)\)/)?.[1] ?? "";
    const inDatabase = [...list.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
    expect(new Set(inDatabase)).toEqual(RESERVED_SLUGS);
  });

  it("reserves every top-level page of the app", () => {
    const pages = ["sign-in", "sign-up", "forgot-password", "reset-password", "onboarding", "invite", "auth", "design"];
    for (const page of pages) expect(RESERVED_SLUGS.has(page)).toBe(true);
  });
});
