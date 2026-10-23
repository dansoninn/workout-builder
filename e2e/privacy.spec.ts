import { readFile } from "node:fs/promises";

import { expect, type Page, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

import { acceptAsNewUser, invite, ownerWithGym, uniqueEmail } from "./helpers";

/** A saved workout titled `title`, made in the builder. */
async function workout(page: Page, slug: string, title: string) {
  await page.goto(`/${slug}/builder`);
  await page.getByLabel("Workout title").filter({ visible: true }).fill(title);
  await page.getByLabel("A1 exercise").filter({ visible: true }).fill("air squat");
  await page.keyboard.press("Enter");
  await page.keyboard.type("20");
  await page.getByRole("button", { name: /^Save/ }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/builder\/[0-9a-f-]{36}$/);
}

test("an owner exports the gym's data as JSON and CSV, with nothing of another gym; nobody else can", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const { email, slug } = await ownerWithGym(page);
  await workout(page, slug, "Þrek mánudagur");
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  const { slug: otherSlug } = await ownerWithGym(otherPage);
  await workout(otherPage, otherSlug, "Other gym secret");

  await page.goto(`/${slug}/settings/gym`);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Export the gym's data" }).click()]);
  expect(download.suggestedFilename()).toMatch(new RegExp(`^${slug}-data-\\d{4}-\\d{2}-\\d{2}\\.zip$`));
  const files = unzipSync(await readFile(await download.path()));
  expect(Object.keys(files)).toEqual(expect.arrayContaining(["README.txt", "data.json", "csv/workouts.csv", "csv/members.csv", "csv/audit_log.csv"]));

  const data = JSON.parse(strFromU8(files["data.json"]!));
  expect(data.gym.slug).toBe(slug);
  expect(data.workouts.map((w: { title: string }) => w.title)).toContain("Þrek mánudagur");
  expect(data.programs.map((p: { name: string }) => p.name)).toEqual(["Class"]);
  expect(strFromU8(files["csv/workouts.csv"]!)).toContain("Þrek mánudagur");
  expect(strFromU8(files["csv/members.csv"]!)).toContain(email);
  const everything = Object.values(files).map((f) => strFromU8(f)).join("\n");
  expect(everything).not.toContain("Other gym secret");
  expect(everything).not.toContain(otherSlug);

  // Another gym's owner gets nothing; nor does a coach of this gym, who has no button either.
  expect((await otherPage.request.get(`/${slug}/settings/gym/export`)).status()).toBe(404);
  const { context: coachContext, page: coach } = await acceptAsNewUser(browser, await invite(page, slug, uniqueEmail("coach"), "Coach"), "Cora Coach");
  await coach.goto(`/${slug}/settings/gym`);
  await expect(coach.getByRole("heading", { name: "Gym", exact: true })).toBeVisible();
  await expect(coach.getByRole("link", { name: "Export the gym's data" })).toHaveCount(0);
  expect((await coach.request.get(`/${slug}/settings/gym/export`)).status()).toBe(404);
  await coachContext.close();
  await other.close();
});
