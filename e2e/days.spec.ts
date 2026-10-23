import { expect, type Page, test } from "@playwright/test";

import { expectAccessible, ownerWithGym } from "./helpers";

// Item 4 of Daniel's list (2026-10-23): day focus, holidays and closed days, program dates.

const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: string, days: number) => iso(new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000));
const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const day = (page: Page, date: string) => page.locator(`[data-drop-target="${date}"]`);

async function workoutOn(page: Page, slug: string, date: string, title: string) {
  await page.goto(`/${slug}/builder?date=${date}`);
  await page.getByLabel("Workout title").filter({ visible: true }).fill(title);
  await page.getByLabel("A1 exercise").filter({ visible: true }).fill("air squat");
  await page.keyboard.press("Enter");
  await page.keyboard.type("20");
  await page.getByRole("button", { name: /^Save/ }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/builder\/[0-9a-f-]{36}$/);
}

async function addFocus(page: Page, name: string) {
  await page.getByRole("button", { name: "New day focus" }).click();
  const dialog = page.getByRole("dialog", { name: "New day focus" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: "Add day focus" }).click();
  await expect(dialog).toBeHidden();
}

test("day focus: the gym's list in Settings, set on a day of the calendar, kept, and Analytics shows one focus's days", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  await page.goto(`/${slug}/settings/days`);
  await addFocus(page, "Squat");
  await addFocus(page, "Mix");
  await expect(page.getByRole("button", { name: "Edit Squat" })).toBeVisible();
  await expectAccessible(page, "settings, days");

  const base = `${iso(new Date()).slice(0, 7)}-10`;
  await workoutOn(page, slug, base, "Heavy legs");
  await workoutOn(page, slug, addDays(base, 1), "Engine day");

  await page.goto(`/${slug}/calendar?view=month&date=${base}`);
  await day(page, base).getByRole("button", { name: `Day focus for ${dayLabel(base)}, Class: none` }).click();
  await page.getByRole("menuitemradio", { name: "Squat" }).click();
  await expect(day(page, base).getByRole("button", { name: `Day focus for ${dayLabel(base)}, Class: Squat` })).toBeVisible();
  await day(page, addDays(base, 1)).getByRole("button", { name: /Day focus for .*: none/ }).click();
  await page.getByRole("menuitemradio", { name: "Mix" }).click();
  await expect(day(page, addDays(base, 1))).toContainText("Mix");
  await page.reload();
  await expect(day(page, base)).toContainText("Squat");
  await expectAccessible(page, "month calendar with day focus");

  // Analytics: every day, then only the Squat days.
  await page.goto(`/${slug}/analytics?from=${base}&to=${addDays(base, 1)}`);
  const list = page.getByRole("region", { name: "Workouts in this period" });
  await expect(list).toContainText("Heavy legs");
  await expect(list).toContainText("Engine day");
  await page.getByLabel("Day focus").click();
  await page.getByRole("option", { name: "Squat days" }).click();
  await expect(page).toHaveURL(/focus=[0-9a-f-]{36}/);
  await expect(page.getByText("Only Squat days.")).toBeVisible();
  await expect(list).toContainText("Heavy legs");
  await expect(list).not.toContainText("Engine day");
  await expectAccessible(page, "analytics, one day focus");

  // Clearing it on the calendar takes the day out of the Squat days.
  await page.goto(`/${slug}/calendar?view=month&date=${base}`);
  await day(page, base).getByRole("button", { name: /Day focus for .*: Squat/ }).click();
  await page.getByRole("menuitemradio", { name: "No focus" }).click();
  await expect(day(page, base).getByRole("button", { name: /Day focus for .*: none/ })).toBeAttached();
});

test("holidays and closed days: Iceland's in one click, one kept open, on the calendar; a program's dates warn, never block", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  await page.goto(`/${slug}/settings/days?year=2026`);
  await page.getByRole("button", { name: "Add Iceland's public holidays for 2026" }).click();
  const list = page.getByRole("list", { name: "Holidays and closed days in 2026" });
  await expect(list).toContainText("Christmas Day");
  await expect(list.getByRole("listitem")).toHaveCount(16);
  await expect(page.getByRole("button", { name: "Iceland's public holidays for 2026 are added" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "Closed on National Day" }).uncheck();
  await page.getByLabel("Date").fill("2026-11-14");
  await page.getByLabel("What it is").fill("Closed for a competition");
  await page.getByRole("button", { name: "Add the day" }).click();
  await expect(list).toContainText("Closed for a competition");
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Closed on National Day" })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Closed on Christmas Day" })).toBeChecked();

  await page.goto(`/${slug}/calendar?view=month&date=2026-12-10`);
  await expect(day(page, "2026-12-25")).toContainText("Christmas Day · Closed");
  await page.goto(`/${slug}/calendar?view=month&date=2026-06-10`);
  await expect(day(page, "2026-06-17")).toContainText("National Day");
  await expect(day(page, "2026-06-17")).not.toContainText("Closed");

  // A program that runs 1–20 December.
  await page.goto(`/${slug}/settings/programs`);
  await page.getByRole("button", { name: "Edit Class" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Class" });
  await dialog.getByLabel("Runs from").fill("2026-12-01");
  await dialog.getByLabel("Until").fill("2026-12-20");
  await dialog.getByRole("button", { name: "Save program" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Class" })).toContainText("1 Dec 2026 – 20 Dec 2026");

  await page.goto(`/${slug}/calendar?view=month&date=2026-12-10`);
  await expect(day(page, "2026-12-22")).toContainText("Not running");
  await expect(day(page, "2026-12-10")).not.toContainText("Not running");
  await expectAccessible(page, "month calendar with holidays and program dates");

  // The builder says so, and saves anyway.
  await workoutOn(page, slug, "2026-12-25", "Christmas WOD");
  await expect(page.getByRole("status").filter({ hasText: "Christmas Day: the gym is closed that day." })).toContainText(
    "Class runs 1 Dec 2026 – 20 Dec 2026: this date is outside it.",
  );
});
