import { expect, test } from "@playwright/test";

import { acceptAsNewUser, invite, ownerWithGym, uniqueEmail } from "./helpers";

test("an owner adds a gym exercise with pattern weights, and the builder finds it", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  await page.goto(`/${slug}/exercises`);
  await page.getByRole("button", { name: "New exercise" }).click();
  const form = page.getByRole("dialog", { name: "New gym exercise" });
  await form.getByLabel("Name").fill("Sandbag bear-hug carry");
  await form.getByLabel("Weight of pattern 1").fill("0.6");
  await form.getByRole("button", { name: "Pattern", exact: true }).click();
  await form.getByRole("combobox", { name: "Pattern 2" }).click();
  await page.getByRole("option", { name: "Carry" }).click();
  await form.getByLabel("Weight of pattern 2").fill("0.3");
  await expect(form.getByText("Total 0.90 (must be 1.00)")).toBeVisible();
  await expect(form.getByRole("button", { name: "Add exercise" })).toBeDisabled();
  await form.getByLabel("Weight of pattern 2").fill("0.4");
  await expect(form.getByText("Total 1.00 ✓")).toBeVisible();
  await form.getByRole("button", { name: "Quads" }).first().click();
  await form.getByRole("button", { name: "Add exercise" }).click();
  await expect(page.getByText("Sandbag bear-hug carry added to your gym")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sandbag bear-hug carry" })).toBeVisible();

  await page.goto(`/${slug}/builder`);
  await page.getByLabel("A1 exercise").fill("sandbag");
  await expect(page.getByRole("option").first()).toContainText("Sandbag bear-hug carry");
});

test("a gym's own name for an exercise comes first in the builder", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  await page.goto(`/${slug}/exercises`);
  await page.getByLabel("Search exercises").fill("back squat");
  await page.getByRole("button", { name: "Back squat", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Back squat" });
  await sheet.getByLabel("Add a name your gym uses").fill("BS");
  await sheet.getByRole("button", { name: "Add name" }).click();
  await expect(page.getByText("“bs” now finds Back squat")).toBeVisible();

  await page.goto(`/${slug}/builder`);
  await page.getByLabel("A1 exercise").fill("bs");
  await expect(page.getByRole("option").first()).toContainText("Back squat");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("A1 exercise")).toHaveValue("Back squat");
});

test("owners set the gym's pace; coaches see it but cannot change it", async ({ page, browser }) => {
  const { slug } = await ownerWithGym(page);
  await page.goto(`/${slug}/settings/paces`);
  await page.getByLabel("Find an exercise").fill("air squat");
  const pace = page.getByLabel("Air squat pace s/rep");
  await pace.fill("2.5");
  await pace.press("Enter");
  await expect(page.getByText("Air squat: your gym's pace saved")).toBeVisible();
  await page.reload();
  await page.getByLabel("Find an exercise").fill("air squat");
  await expect(page.getByLabel("Air squat pace s/rep")).toHaveValue("2.5");

  const link = await invite(page, slug, uniqueEmail("coach"), "Coach");
  const { context, page: coach } = await acceptAsNewUser(browser, link, "Cara Coach");
  await coach.goto(`/${slug}/settings/paces`);
  await expect(coach.getByText("Owners and head coaches set the gym's paces.")).toBeVisible();
  await coach.getByLabel("Find an exercise").fill("air squat");
  await expect(coach.getByLabel("Air squat pace s/rep")).toBeDisabled();
  await coach.goto(`/${slug}/exercises`);
  await expect(coach.getByRole("button", { name: "New exercise" })).toHaveCount(0);
  await context.close();
});
