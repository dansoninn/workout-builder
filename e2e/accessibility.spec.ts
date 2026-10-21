import { expect, test } from "@playwright/test";

import { expectAccessible, invite, ownerWithGym, shortcutsReady, signUp, uniqueEmail } from "./helpers";

// Every screen, in light and in dark (the default "system" theme follows the device).
for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

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

      await page.goto(`/${"x".repeat(12)}-none/builder`);
      await expect(page.getByRole("heading", { name: "Gym not found" })).toBeVisible();
      await expectAccessible(page, `gym not found (${colorScheme})`);
    });
  });
}
