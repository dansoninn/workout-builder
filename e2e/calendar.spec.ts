import { expect, type Page, test } from "@playwright/test";

import { expectAccessible, ownerWithGym } from "./helpers";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: string, days: number) => iso(new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000));
const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

/** A saved workout on `date`, made in the builder (in the gym's first program unless `program` is given). */
async function workoutOn(page: Page, slug: string, date: string, title: string, program?: string) {
  await page.goto(`/${slug}/builder?date=${date}`);
  if (program) {
    await page.getByLabel("Program").filter({ visible: true }).click();
    await page.getByRole("option", { name: program }).click();
  }
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

test("each program is its own space on the calendar; the last choice is kept; all programs show their colours", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  await page.goto(`/${slug}/settings/programs`);
  await page.getByRole("button", { name: "New program" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Strength club");
  await page.getByRole("dialog").getByRole("button", { name: "Create program" }).click();
  await expect(page.getByText("Strength club created")).toBeVisible();

  const base = `${iso(new Date()).slice(0, 7)}-12`;
  await workoutOn(page, slug, base, "Class day");
  await workoutOn(page, slug, base, "Heavy day", "Strength club");

  // One program by default: the gym's first.
  await page.goto(`/${slug}/calendar?date=${base}`);
  const switcher = page.getByLabel("Program", { exact: true });
  await expect(switcher).toHaveText(/Class/);
  await expect(day(page, base).getByRole("link", { name: /Class day/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Heavy day/ })).toHaveCount(0);

  // Another program, remembered for next time.
  const remembered = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/calendar"));
  await switcher.click();
  await page.getByRole("option", { name: "Strength club" }).click();
  await remembered;
  await expect(day(page, base).getByRole("link", { name: /Heavy day/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Class day/ })).toHaveCount(0);
  await page.goto(`/${slug}/calendar?date=${base}`);
  await expect(switcher).toHaveText(/Strength club/);
  await expect(day(page, base).getByRole("link", { name: /Heavy day/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Class day/ })).toHaveCount(0);

  // All programs, only when chosen: every workout, each with its program.
  await switcher.click();
  await page.getByRole("option", { name: "All programs" }).click();
  await expect(day(page, base).getByRole("link", { name: /Heavy day/ })).toContainText("Strength club");
  await expect(day(page, base).getByRole("link", { name: /Class day/ })).toContainText("Class");
  await expectAccessible(page, "calendar, all programs");
  await page.getByRole("link", { name: "Week", exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "Strength club" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Class" })).toBeVisible();
});
