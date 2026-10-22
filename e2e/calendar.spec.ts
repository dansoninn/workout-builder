import { expect, type Page, test } from "@playwright/test";

import { expectAccessible, ownerWithGym } from "./helpers";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: string, days: number) => iso(new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000));
const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

/** A saved workout on `date`, made in the builder. */
async function workoutOn(page: Page, slug: string, date: string, title: string) {
  await page.goto(`/${slug}/builder?date=${date}`);
  await page.getByLabel("Workout title").filter({ visible: true }).fill(title);
  await page.getByLabel("A1 exercise").filter({ visible: true }).fill("air squat");
  await page.keyboard.press("Enter");
  await page.keyboard.type("20");
  await page.getByRole("button", { name: /^Save/ }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/builder\/[0-9a-f-]{36}$/);
}

const day = (page: Page, date: string) => page.locator(`[data-drop-target="${date}"]`);

test("month calendar: drag a workout to another day, move it by keyboard, undo", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  // The middle of this month, so every day used is in the month on screen.
  const today = iso(new Date());
  const base = `${today.slice(0, 7)}-10`;
  await workoutOn(page, slug, base, "Engine day");

  await page.goto(`/${slug}/calendar`);
  await expect(page.getByRole("heading", { name: "Calendar", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Month", exact: true })).toHaveAttribute("aria-current", "page");
  const card = page.getByRole("link", { name: /Engine day/ });
  await expect(day(page, base).getByRole("link", { name: /Engine day/ })).toContainText("Draft");
  await expectAccessible(page, "month calendar");

  // Drag and drop to two days later.
  await card.dragTo(day(page, addDays(base, 2)));
  await expect(day(page, addDays(base, 2)).getByRole("link", { name: /Engine day/ })).toBeVisible();
  await expect(page.getByText(`Engine day moved to ${dayLabel(addDays(base, 2))}`)).toBeVisible();
  await page.reload();
  await expect(day(page, addDays(base, 2)).getByRole("link", { name: /Engine day/ })).toBeVisible();

  // The keyboard way: the card's move button, then a date.
  await page.getByRole("button", { name: "Move Engine day" }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Move Engine day" });
  await dialog.getByLabel("Date").fill(addDays(base, 5));
  await dialog.getByRole("button", { name: "Move", exact: true }).click();
  await expect(day(page, addDays(base, 5)).getByRole("link", { name: /Engine day/ })).toBeVisible();

  // Undo puts it back.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Moved back")).toBeVisible();
  await expect(day(page, addDays(base, 2)).getByRole("link", { name: /Engine day/ })).toBeVisible();

  // The week view shows the same workout under its track.
  await page.goto(`/${slug}/calendar?view=week&date=${addDays(base, 2)}`);
  await expect(page.getByRole("row").filter({ hasText: dayLabel(addDays(base, 2)) }).getByRole("link", { name: /Engine day/ })).toBeVisible();
  await page.getByRole("link", { name: /Engine day/ }).dragTo(page.locator(`[data-drop-target^="${addDays(base, 3)}:"]`).first());
  await expect(page.getByRole("row").filter({ hasText: dayLabel(addDays(base, 3)) }).getByRole("link", { name: /Engine day/ })).toBeVisible();
});
