import { readFile } from "node:fs/promises";

import { expect, type Page, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

import { acceptAsNewUser, expectAccessible, invite, ownerWithGym, uniqueEmail } from "./helpers";

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

test("a coach deletes their account; their workout stays with the gym; the only owner is told what to do first", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const { slug } = await ownerWithGym(page);
  const coachEmail = uniqueEmail("coach");
  const { context, page: coach } = await acceptAsNewUser(browser, await invite(page, slug, coachEmail, "Coach"), "Cora Coach");
  await workout(coach, slug, "Cora's engine");

  await coach.goto(`/${slug}/settings/profile`);
  await coach.getByRole("button", { name: "Delete my account…" }).click();
  const dialog = coach.getByRole("dialog", { name: "Delete your account?" });
  await dialog.getByLabel(`Type ${coachEmail} to confirm`).fill("someone@else.test");
  await dialog.getByRole("button", { name: "Delete my account" }).click();
  await expect(dialog.getByText("Type your email address exactly as shown")).toBeVisible();
  await dialog.getByLabel(`Type ${coachEmail} to confirm`).fill(coachEmail);
  await dialog.getByRole("button", { name: "Delete my account" }).click();
  await expect(coach.getByRole("heading", { name: "Your account was deleted" })).toBeVisible();
  // Signed out: the gym's pages ask to sign in.
  await coach.goto(`/${slug}/calendar`);
  await expect(coach).toHaveURL(/\/sign-in/);
  await context.close();

  // The gym keeps the workout; the coach is no longer a member.
  await page.goto(`/${slug}/calendar`);
  await expect(page.getByRole("link", { name: /Cora's engine/ })).toBeVisible();
  await page.goto(`/${slug}/settings/members`);
  await expect(page.getByText("Cora Coach")).toHaveCount(0);

  // The gym's only owner cannot leave it without an owner.
  await page.goto(`/${slug}/settings/profile`);
  await expect(page.getByText(/You are the only owner of .+\. Make someone else an owner/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete my account…" })).toHaveCount(0);
  await expectAccessible(page, "profile with account deletion");
});

test("an owner deletes the gym: gone for everyone at once; for 30 days it can be brought back as it was", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const { slug } = await ownerWithGym(page);
  await workout(page, slug, "Last class");
  const { context, page: coach } = await acceptAsNewUser(browser, await invite(page, slug, uniqueEmail("coach"), "Coach"), "Cora Coach");

  await page.goto(`/${slug}/settings/gym`);
  const name = (await page.getByLabel("Gym name").inputValue()).trim();
  await page.getByRole("button", { name: "Delete this gym…" }).click();
  const dialog = page.getByRole("dialog", { name: `Delete ${name}?` });
  await dialog.getByLabel(`Type ${name} to confirm`).fill("Another gym");
  await dialog.getByRole("button", { name: "Delete the gym" }).click();
  await expect(dialog.getByText("Type the gym's name exactly as shown")).toBeVisible();
  await dialog.getByLabel(`Type ${name} to confirm`).fill(name.toUpperCase());
  await dialog.getByRole("button", { name: "Delete the gym" }).click();

  // The owner has no other gym: "create your gym", with the deleted one listed.
  await expect(page).toHaveURL(/\/onboarding$/);
  const deleted = page.getByRole("region", { name: "Gyms you deleted" });
  await expect(deleted.getByRole("listitem")).toHaveCount(1);
  await expect(deleted).toContainText(name);
  await expect(deleted).toContainText("Erased for good on");
  await expectAccessible(page, "onboarding with a deleted gym");
  // Gone for its coach too.
  await coach.goto(`/${slug}/calendar`);
  await expect(coach.getByRole("heading", { name: "Gym not found" })).toBeVisible();

  // Brought back, as it was.
  await deleted.getByRole("button", { name: `Bring back ${name}` }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/builder$`));
  await page.goto(`/${slug}/calendar`);
  await expect(page.getByRole("link", { name: /Last class/ })).toBeVisible();
  await coach.goto(`/${slug}/calendar`);
  await expect(coach.getByRole("link", { name: /Last class/ })).toBeVisible();
  await context.close();
});

test("cookies: only the sign-in session and the last gym opened; nothing that tracks", async ({ page, context }) => {
  const { slug } = await ownerWithGym(page);
  for (const path of ["calendar", "analytics", "builder/paste", "settings/profile"]) await page.goto(`/${slug}/${path}`);
  const cookies = await context.cookies();
  // Supabase's sign-in cookies: the session (maybe in parts) and the short-lived code verifiers of email links.
  const session = /^sb-[a-z0-9-]+-auth-token(\.\d+|(-flows?(-[0-9a-f]+)?)?-code-verifier)?$/;
  expect(cookies.map((c) => c.name).filter((name) => !session.test(name) && name !== "wb_gym")).toEqual([]);
  // The last gym: its address only, readable by the server only, for this site only.
  const gym = cookies.find((c) => c.name === "wb_gym");
  expect(gym).toMatchObject({ value: slug, httpOnly: true, sameSite: "Lax" });
});
