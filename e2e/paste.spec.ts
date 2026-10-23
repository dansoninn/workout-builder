import { expect, test } from "@playwright/test";

import { acceptAsNewUser, expectAccessible, invite, ownerWithGym, uniqueEmail } from "./helpers";

const WORKOUT = `Engine day
A. Back squat 5 x 5 @ 75%
B. AMRAP
10 burpees
Max lunges
20 zercher squats
Scale: step-ups for burpees`;

test("paste a workout: missing numbers first, generic words asked once and remembered, then the builder", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  await page.getByRole("link", { name: "Paste text" }).click();
  await expect(page.getByRole("heading", { name: "Paste a workout", level: 1 })).toBeVisible();

  const text = page.getByLabel("The workout, as you would write it on the whiteboard");
  await text.fill(WORKOUT);
  const lines = page.getByRole("list", { name: "Lines" });
  await expect(page.getByRole("status").filter({ hasText: "understood" })).toHaveText("3 understood · 3 for you · 1 kept as a note");
  await expect(lines.getByRole("listitem").filter({ hasText: "Back squat 5 x 5" })).toContainText("Block A · 5 sets · strength");
  await expect(lines.getByRole("listitem").filter({ hasText: "Scale:" })).toContainText("Kept as a note");
  await expectAccessible(page, "paste a workout, with questions");

  // A missing number: the workout cannot be made until the text says it.
  await page.getByRole("button", { name: "Make workout" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "missing" })).toHaveText("Write the missing numbers first (line 3).");
  await expect(page.getByLabel("The workout, as you would write it on the whiteboard")).toBeFocused();
  await text.fill(WORKOUT.replace("B. AMRAP", "B. AMRAP 12"));

  // A generic word, answered once.
  const lunges = lines.getByRole("listitem").filter({ hasText: "Max lunges" });
  await expect(lunges).toContainText("Which “lunge” does your gym mean?");
  await lunges.getByRole("button", { name: "Walking lunge" }).click();
  await expect(lunges).toContainText("“lunge” = Walking lunge · becomes your gym's name for it");

  // An unknown exercise: picked from the library, and remembered for the gym.
  const zercher = lines.getByRole("listitem").filter({ hasText: "zercher" });
  await expect(zercher).toContainText("“zercher squats” is not in the library");
  await zercher.getByLabel("Pick the exercise for “zercher squats”").fill("front squat");
  await page.keyboard.press("Enter");
  await expect(zercher).toContainText("“zercher squats” = Front squat");
  await zercher.getByLabel("Remember “zercher squats” as your gym's name for it").check();
  await expect(page.getByRole("status").filter({ hasText: "understood" })).toHaveText("6 understood · 0 for you · 1 kept as a note");

  await page.getByRole("button", { name: "Make workout" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/builder/[0-9a-f-]{36}$`));
  // Next.js keeps the page we came from alive but hidden; only the visible builder counts.
  const field = (label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });
  await expect(field("Workout title")).toHaveValue("Engine day");
  await expect(field("A1 exercise")).toHaveValue("Back squat");
  await expect(field("B2 exercise")).toHaveValue("Walking lunge");
  await expect(field("B2 amount")).toHaveValue("max");
  await expect(field("B3 exercise")).toHaveValue("Front squat");
  await expect(field("Block B notes")).toHaveValue("Scale: step-ups for burpees");

  // The gym's names are used next time, without asking.
  await page.goto(`/${slug}/builder/paste`);
  const again = page.getByLabel("The workout, as you would write it on the whiteboard").filter({ visible: true });
  await expect(again).toHaveValue("");
  await again.fill("AMRAP 10\n10 lunges\n10 zercher squats");
  await expect(page.getByRole("status").filter({ hasText: "understood" })).toHaveText("3 understood · 0 for you · 0 kept as notes");
});

test("effort words are read into the four boxes, and the check screen says which word set which", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  await page.goto(`/${slug}/builder/paste`);
  await page.getByLabel("The workout, as you would write it on the whiteboard").fill("A. Back squat 5x5 (heavy)\nB. AMRAP 12\n400 m run fast\n10 burpees @ 50% effort");
  const lines = page.getByRole("list", { name: "Lines" });
  await expect(lines.getByRole("listitem").filter({ hasText: "Back squat" })).toContainText("“heavy” → Load Hard");
  await expect(lines.getByRole("listitem").filter({ hasText: "400 m run" })).toContainText("“fast” → Pace Hard");
  await expect(lines.getByRole("listitem").filter({ hasText: "burpees" })).toContainText("“50% effort” → Pace Moderate");
  await expect(page.getByRole("region", { name: "Effort boxes" })).toContainText("Short sentences.");
  // A hint names the part it did not understand.
  await page.getByLabel("The workout, as you would write it on the whiteboard").fill("For time\n5 back squat @ 2 bars");
  await expect(lines.getByRole("listitem").filter({ hasText: "back squat" })).toContainText('Did not understand "bars" after 2.');
});

test("viewers cannot paste a workout", async ({ page, browser }) => {
  const { slug } = await ownerWithGym(page);
  const link = await invite(page, slug, uniqueEmail("viewer"), "Viewer");
  const { context, page: viewer } = await acceptAsNewUser(browser, link, "Vera Viewer");
  await viewer.goto(`/${slug}/builder/paste`);
  await expect(viewer.getByText("Owners, head coaches and coaches add workouts.")).toBeVisible();
  await expect(viewer.getByLabel("The workout, as you would write it on the whiteboard")).toHaveCount(0);
  await context.close();
});

test("once the workout is made, the paste page starts empty again, even when made right after typing", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  await page.goto(`/${slug}/builder/paste`);
  const box = () => page.getByLabel("The workout, as you would write it on the whiteboard").filter({ visible: true });
  await box().fill("Quick one\n20 air squat");
  // Straight away: the text's own delayed save (in this browser) is still waiting.
  await page.getByRole("button", { name: "Make workout" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/builder\/[0-9a-f-]{36}$/);
  await page.waitForTimeout(800);
  await page.goto(`/${slug}/builder/paste`);
  await expect(box()).toHaveValue("");
});
