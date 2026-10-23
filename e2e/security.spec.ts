import { expect, test } from "@playwright/test";

import { ownerWithGym } from "./helpers";

test("pages carry the security headers and load without breaking the Content-Security-Policy", async ({ page }) => {
  // Every blocked load or script is recorded where the test can read it.
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { cspViolations: string[] }).cspViolations = seen;
    document.addEventListener("securitypolicyviolation", (e) => seen.push(`${e.violatedDirective} ${e.blockedURI}`));
  });

  const signIn = await page.goto("/sign-in");
  const headers = signIn!.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");

  const { slug } = await ownerWithGym(page);
  for (const path of ["calendar", "builder", "builder/paste", "analytics", "results", "exercises", "settings/programs", "settings/guidelines"]) {
    await page.goto(`/${slug}/${path}`);
    await expect(page.getByRole("main")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations), path).toEqual([]);
  }
});
