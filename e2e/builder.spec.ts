import { expect, type Page, test } from "@playwright/test";

import { acceptAsNewUser, invite, ownerWithGym, shortcutsReady, uniqueEmail } from "./helpers";

/** Keyboard only: focus a control, then press keys (no clicks). */
async function typeInto(page: Page, label: string | RegExp, text: string) {
  await page.getByLabel(label, { exact: typeof label === "string" }).first().focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(text);
}

async function chooseOption(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option", { name: option, exact: true })).toBeVisible();
  await page.keyboard.type(option); // type-ahead highlights the matching option
  await expect(page.getByRole("option", { name: option, exact: true })).toHaveAttribute("data-highlighted", "");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel(label, { exact: true })).toHaveText(new RegExp(option.replace(/[()]/g, "\\$&")));
}

async function chooseEffort(page: Page, block: string, label: string) {
  await page.locator(`[data-block="${block}"]`).getByLabel(label, { exact: true }).focus();
  await page.keyboard.press("Space");
}

/** Type an exercise, take the highlighted match with Enter, then the amount and load. */
async function line(page: Page, search: string, amount: string, load?: string) {
  await page.keyboard.type(search);
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.type(amount);
  if (load) {
    await page.keyboard.press("Tab");
    await page.keyboard.type(load);
  }
}

test("WOD 1 by keyboard only: 202 AU and ~7.7 rounds, saved, the same after a reload", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  await shortcutsReady(page);
  const blockId = async (label: string) =>
    page.locator("section[data-block]").filter({ has: page.getByText(`Block ${label}`, { exact: true }) }).getAttribute("data-block");

  await typeInto(page, "Workout title", "WOD 1");

  // A. E3M × 5: 5 back squat @75–80%, Load Moderate.
  await chooseOption(page, "Block A format", "Every (EMOM)");
  await typeInto(page, "Every", "3");
  await typeInto(page, "Rounds", "5");
  await chooseEffort(page, (await blockId("A"))!, "Load Moderate");
  await page.getByLabel("A1 exercise").focus();
  await line(page, "back squat", "5", "75-80%");
  await page.keyboard.press("ControlOrMeta+Enter");

  // B. E2M × 4: 8–10 DB bench, 8/8 single-arm DB row, Load Moderate.
  await expect(page.getByLabel("B1 exercise")).toBeFocused();
  await line(page, "dumbbell bench", "8-10");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("B2 exercise")).toBeFocused();
  await line(page, "single-arm dumbbell row", "8/8");
  await chooseOption(page, "Block B format", "Every (EMOM)");
  await chooseOption(page, "Block B intent", "Strength");
  await page.locator(`[data-block="${await blockId("B")}"]`).getByLabel("Every", { exact: true }).focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("2");
  await page.locator(`[data-block="${await blockId("B")}"]`).getByLabel("Rounds", { exact: true }).focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("4");
  await chooseEffort(page, (await blockId("B"))!, "Load Moderate");

  // C. AMRAP 8: 5 KB swing, 10 air squat, 15 double-unders, Pace Hard.
  await page.getByLabel("B2 exercise").focus();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByLabel("C1 exercise")).toBeFocused();
  await line(page, "kettlebell swing", "5");
  await page.keyboard.press("Enter");
  await line(page, "air squat", "10");
  await page.keyboard.press("Enter");
  await line(page, "double-under", "15");
  const c = await blockId("C");
  await page.locator(`[data-block="${c}"]`).getByLabel("Time", { exact: true }).focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("8");
  await chooseEffort(page, c!, "Pace Hard");

  // The live panel: the approved WOD 1 numbers (calc spec §7).
  const panel = page.getByRole("complementary", { name: "Training load" });
  await expect(page.getByTestId("planned-load").locator("[data-visible-number]")).toHaveText("202 AU");
  await expect(page.getByTestId("session-length").locator("[data-visible-number]")).toHaveText("31 min");
  await expect(panel.getByRole("row").filter({ hasText: "AMRAP" })).toContainText("~7.7");

  // Save with ⌘S; the address becomes the workout's own.
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/${slug}/builder/[0-9a-f-]{36}$`));

  await page.reload();
  await expect(page.getByLabel("Workout title")).toHaveValue("WOD 1");
  await expect(page.getByLabel("A1 amount")).toHaveValue("5");
  await expect(page.getByLabel("A1 load")).toHaveValue("75-80%");
  await expect(page.getByLabel("B2 amount")).toHaveValue("8/8");
  await expect(page.getByTestId("planned-load").locator("[data-visible-number]")).toHaveText("202 AU");
  await expect(panel.getByRole("row").filter({ hasText: "AMRAP" })).toContainText("~7.7");

  // The calendar reads the numbers the server stored when saving.
  await page.goto(`/${slug}/calendar`);
  const card = page.getByRole("link", { name: /WOD 1/ });
  await expect(card).toContainText("31 min");
  await expect(card).toContainText("202 AU");
  await expect(card).toContainText("Draft");
});

test("a line without an exercise can be saved but blocks publishing, with a link to it", async ({ page }) => {
  await ownerWithGym(page);
  await page.getByLabel("A1 amount").fill("20");
  await page.getByRole("button", { name: /^Save/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  await page.getByRole("button", { name: "Publish" }).click();
  const dialog = page.getByRole("dialog", { name: "Not ready to publish" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "A1" }).click();
  // Next.js keeps the page we came from alive but hidden; only the visible builder counts.
  await expect(page.getByLabel("A1 exercise").filter({ visible: true })).toBeFocused();

  await page.keyboard.type("air squat");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
});

test("unsaved work is kept in the browser and offered back", async ({ page }) => {
  await ownerWithGym(page);
  await page.getByLabel("Workout title").fill("Thursday strength");
  await page.getByLabel("A1 exercise").fill("front squat");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600); // the backup is written shortly after a change
  page.on("dialog", (d) => d.accept());
  await page.reload();

  await expect(page.getByRole("alert").filter({ hasText: "were kept in this browser" })).toBeVisible();
  await page.getByRole("button", { name: "Restore them" }).click();
  await expect(page.getByLabel("Workout title")).toHaveValue("Thursday strength");
  await expect(page.getByLabel("A1 exercise")).toHaveValue("Front squat");
});

test("a viewer sees a workout but cannot change it", async ({ page, browser }) => {
  const { slug } = await ownerWithGym(page);
  await page.getByLabel("Workout title").fill("Viewer check");
  await page.getByLabel("A1 exercise").fill("air squat");
  await page.keyboard.press("Enter");
  await page.keyboard.type("10");
  await page.getByRole("button", { name: /^Save/ }).click();
  await expect(page).toHaveURL(/\/builder\/[0-9a-f-]{36}$/);
  const workoutPath = new URL(page.url()).pathname;

  const link = await invite(page, slug, uniqueEmail("viewer"), "Viewer");
  const { context, page: viewer } = await acceptAsNewUser(browser, link, "Vera Viewer");
  await viewer.goto(workoutPath);
  await expect(viewer.getByLabel("Workout title")).toHaveValue("Viewer check");
  await expect(viewer.getByLabel("Workout title")).toBeDisabled();
  await expect(viewer.getByLabel("A1 amount")).toBeDisabled();
  await expect(viewer.getByRole("button", { name: /^Save/ })).toHaveCount(0);
  await expect(viewer.getByText("View only")).toBeVisible();
  await expect(viewer.getByTestId("planned-load").locator("[data-visible-number]")).toHaveText(/AU$/);
  await context.close();
});

test("a generic word lists what it could mean and never picks for the coach", async ({ page }) => {
  await ownerWithGym(page);
  await page.getByLabel("A1 exercise").fill("squat");
  await expect(page.getByText("“squat” could mean")).toBeVisible();
  await expect(page.getByRole("option").first()).not.toHaveAttribute("data-highlighted", "");
  await page.keyboard.press("Enter");
  // Nothing is picked, and what the coach typed stays.
  await expect(page.getByLabel("A1 exercise")).toHaveValue("squat");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("A1 exercise")).not.toHaveValue("squat");
  await expect(page.getByLabel("A1 amount")).toBeFocused();
});

test("a workout saved as a template is used on another date, and the template stays", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  await page.getByLabel("Workout title").fill("Engine builder");
  await page.getByLabel("A1 exercise").fill("air squat");
  await page.keyboard.press("Enter");
  await page.keyboard.type("50");
  await page.getByRole("button", { name: "More workout actions" }).click();
  await page.getByRole("menuitem", { name: "Save as template" }).click();
  await expect(page.getByText("Saved as a template")).toBeVisible();
  await expect(page.getByLabel("Workout title").filter({ visible: true })).toHaveValue("Engine builder (template)");

  await page.getByRole("button", { name: "Use on a date" }).click();
  const dialog = page.getByRole("dialog", { name: "Use this template on a date" });
  const monday = new Date();
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const date = monday.toISOString().slice(0, 10);
  await dialog.getByLabel("Date").fill(date);
  await dialog.getByRole("button", { name: "Add to calendar" }).click();
  await expect(page.getByLabel("Workout title").filter({ visible: true })).toHaveValue("Engine builder");

  await page.goto(`/${slug}/calendar?week=${date}`);
  await expect(page.getByRole("row").filter({ hasText: "Mon" }).getByRole("link", { name: /Engine builder/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Templates" }).getByRole("link", { name: /Engine builder \(template\)/ })).toBeVisible();
});
