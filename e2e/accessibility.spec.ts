import { expect, test } from "@playwright/test";

import { expectAccessible, invite, ownerWithGym, shortcutsReady, signUp, uniqueEmail } from "./helpers";

// Every screen, in light and in dark (the default "system" theme follows the device).
for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });
    // Each test walks many screens and runs a full axe scan on each.
    test.setTimeout(120_000);

    test("signed-out screens", async ({ page }) => {
      for (const path of ["/sign-in", "/sign-up", "/forgot-password", "/auth/link-expired", "/no-such-page"]) {
        await page.goto(path);
        await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${colorScheme}\\b`));
        await expectAccessible(page, `${path} (${colorScheme})`);
      }
      await page.goto(`/invite/${"0".repeat(64)}`);
      await expect(page.getByRole("heading", { name: "This invitation link is not valid" })).toBeVisible();
      await expectAccessible(page, `invalid invitation (${colorScheme})`);
    });

    test("invitation and onboarding", async ({ page, browser }) => {
      const { slug } = await ownerWithGym(page);
      const link = await invite(page, slug, uniqueEmail("coach"), "Coach");

      const visitorContext = await browser.newContext({ colorScheme });
      const visitor = await visitorContext.newPage();
      await visitor.goto(link);
      await expect(visitor.getByRole("heading", { name: /^Join/ })).toBeVisible();
      await expectAccessible(visitor, `invitation, signed out (${colorScheme})`);

      await signUp(visitor, { name: "Nina New", email: uniqueEmail("new") });
      await expectAccessible(visitor, `onboarding (${colorScheme})`);
      await visitorContext.close();
    });

    test("app screens and dialogs", async ({ page }) => {
      const { slug } = await ownerWithGym(page);
      const pages: [string, string][] = [
        ["builder", "Builder"],
        ["calendar", "Calendar"],
        ["analytics", "Analytics"],
        ["exercises", "Exercises"],
        ["settings/gym", "Settings"],
        ["settings/members", "Settings"],
        ["settings/tracks", "Settings"],
        ["settings/profile", "Settings"],
        ["settings/paces", "Settings"],
      ];
      for (const [path, heading] of pages) {
        await page.goto(`/${slug}/${path}`);
        await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
        await expect(page.getByLabel("Loading")).toHaveCount(0);
        await expectAccessible(page, `${path} (${colorScheme})`);
      }

      await page.goto(`/${slug}/settings/members`);
      await shortcutsReady(page);
      await page.getByRole("button", { name: "Invite member" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectAccessible(page, `invite dialog (${colorScheme})`);
      await page.keyboard.press("Escape");

      await page.keyboard.press("ControlOrMeta+k");
      await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
      await expectAccessible(page, `command palette (${colorScheme})`);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Command palette" })).toHaveCount(0);

      await page.keyboard.press("?");
      await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
      await expectAccessible(page, `shortcuts dialog (${colorScheme})`);

      // The builder with content, its menus and the publish check.
      await page.goto(`/${slug}/builder`);
      await page.getByLabel("A1 exercise").fill("air squat");
      await page.keyboard.press("Enter");
      await page.keyboard.type("10");
      await page.getByLabel("A1 load").fill("heavy");
      await expect(page.getByText("Try 75-80%").first()).toBeVisible();
      await expectAccessible(page, `builder with a line and a problem (${colorScheme})`);
      await page.getByLabel("A1 load").fill("");
      await page.getByRole("button", { name: "A1 options" }).click();
      await expectAccessible(page, `builder line options (${colorScheme})`);
      await page.keyboard.press("Escape");
      await page.getByLabel("A1 exercise").fill("");
      await page.getByRole("button", { name: "Publish" }).click();
      await expect(page.getByRole("dialog", { name: "Not ready to publish" })).toBeVisible();
      await expectAccessible(page, `publish check (${colorScheme})`);
      await page.keyboard.press("Escape");

      await page.goto(`/${slug}/exercises`);
      await page.getByRole("button", { name: "Back squat", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Back squat" })).toBeVisible();
      await expectAccessible(page, `exercise detail (${colorScheme})`);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "New exercise" }).click();
      await expect(page.getByRole("dialog", { name: "New gym exercise" })).toBeVisible();
      await expectAccessible(page, `new exercise form (${colorScheme})`);
      await page.keyboard.press("Escape");

      await page.goto(`/${"x".repeat(12)}-none/builder`);
      await expect(page.getByRole("heading", { name: "Gym not found" })).toBeVisible();
      await expectAccessible(page, `gym not found (${colorScheme})`);
    });
  });
}
