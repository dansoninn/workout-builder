import { expect, type Page, test } from "@playwright/test";

/**
 * The interface font is Geist (docs/DESIGN.md). If its CSS variable or font
 * files fail to load, browsers silently fall back to a serif font, as happened
 * on the first preview deployment. This fails loudly instead.
 */
async function fontState(page: Page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const html = getComputedStyle(document.documentElement);
    return {
      bodyFamily: getComputedStyle(document.body).fontFamily,
      headingFamily: getComputedStyle(document.querySelector("h1") ?? document.body).fontFamily,
      geistVariable: html.getPropertyValue("--font-geist-sans").trim(),
      geistLoaded: [...document.fonts].some((f) => /geist/i.test(f.family) && f.status === "loaded"),
      geistAvailable: document.fonts.check('400 13px "Geist"') || [...document.fonts].some((f) => /geist/i.test(f.family)),
    };
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`text is set in Geist, never a fallback font (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const path of ["/sign-in", "/sign-up", "/design"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      const state = await fontState(page);
      expect(state.geistVariable, `${path}: --font-geist-sans is defined`).not.toBe("");
      expect(state.bodyFamily, `${path}: body font`).toMatch(/geist/i);
      expect(state.headingFamily, `${path}: heading font`).toMatch(/geist/i);
      expect(state.bodyFamily, `${path}: no serif fallback`).not.toMatch(/^\s*(serif|"?Times)/i);
      expect(state.geistLoaded, `${path}: the Geist font file loaded`).toBe(true);
    }
  });
}
