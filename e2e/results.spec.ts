import { expect, type Page, test } from "@playwright/test";

import { acceptAsNewUser, expectAccessible, invite, ownerWithGym, uniqueEmail } from "./helpers";

async function chooseFormat(page: Page, block: string, format: string) {
  await page.getByLabel(`Block ${block} format`, { exact: true }).click();
  await page.getByRole("option", { name: format, exact: true }).click();
}

/** Today's workout with an AMRAP 8 (A) and 3 rounds for time with a 15-minute cap (B), saved. */
async function engineDay(page: Page) {
  await page.getByLabel("Workout title").fill("Engine day");
  await chooseFormat(page, "A", "AMRAP");
  await page.getByLabel("Time", { exact: true }).fill("8");
  await page.getByLabel("A1 exercise").fill("air squat");
  await page.keyboard.press("Enter");
  await page.keyboard.type("10");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByLabel("B1 exercise")).toBeFocused();
  await page.keyboard.type("burpee");
  await page.keyboard.press("Enter");
  await page.keyboard.type("10");
  await chooseFormat(page, "B", "For time");
  await page.getByLabel("Rounds", { exact: true }).fill("3");
  await page.getByLabel("Time cap (optional)").fill("15");
  await page.getByRole("button", { name: /^Save/ }).click();
  await expect(page).toHaveURL(/\/builder\/[0-9a-f-]{36}$/);
}

test("after class, on a phone: log, correct, remove and undo what each class did", async ({ page, browser }) => {
  const { slug } = await ownerWithGym(page);
  await engineDay(page);
  const workoutPath = new URL(page.url()).pathname;
  await expect(page.getByRole("link", { name: "Log results" })).toHaveAttribute("href", workoutPath.replace("/builder/", "/results/"));

  // The coach's phone.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/${slug}/results`);
  await expect(page.getByRole("heading", { name: "Results", level: 1 })).toBeVisible();
  const today = page.getByRole("region", { name: /^Today/ });
  await expect(today.getByRole("link", { name: /Engine day/ })).toContainText("A AMRAP · B For time · no results yet");
  await expectAccessible(page, "results list (phone)");
  await today.getByRole("link", { name: /Engine day/ }).click();

  const a = page.getByRole("region", { name: "Block A: AMRAP 8:00" });
  const b = page.getByRole("region", { name: "Block B: For time · 3 rounds · cap 15:00" });
  await expect(a).toContainText("10 Air squat");
  await expect(a).toContainText(/Planned\s*~/);
  await expect(b).toContainText(/Planned\s*~\d+:\d\d/);

  // AMRAP: rounds the group reached, with a decimal comma as a phone types it.
  await a.getByRole("button", { name: "Log a result for block A" }).click();
  await expect(a.getByLabel("Fewest rounds")).toBeFocused();
  await page.keyboard.type("6,5");
  await a.getByLabel("Most rounds").fill("8");
  await a.getByLabel("Class (optional)").fill("06:00");
  await a.getByLabel("Note (optional)").fill("Two scaled to box step-ups");
  await expectAccessible(page, "result form (phone)");
  await a.getByRole("button", { name: "Save result" }).click();
  await expect(page.getByText("Result logged for block A")).toBeVisible();
  const aResults = a.getByRole("list", { name: "Results for block A" });
  await expect(aResults).toContainText("6.5–8 rounds");
  await expect(aResults).toContainText("06:00");
  await expect(aResults).toContainText("Logged by Olga Owner");

  // For time: a number-pad time, and the capped counting as the cap.
  await b.getByRole("button", { name: "Log a result for block B" }).click();
  await b.getByLabel("Fastest").fill("1600");
  await b.getByRole("button", { name: "Save result" }).click();
  await expect(b.getByRole("alert")).toHaveText("No finish can be over the time cap; anyone capped counts as the cap");
  await b.getByLabel("Fastest").fill("930");
  await b.getByRole("button", { name: /Some were capped/ }).click();
  await expect(b.getByLabel("Slowest")).toHaveValue("15:00");
  await b.getByRole("button", { name: "Save result" }).click();
  const bResults = b.getByRole("list", { name: "Results for block B" });
  await expect(bResults).toContainText("9:30–15:00");

  // Correct a result.
  await aResults.getByRole("button", { name: "Edit result 6.5–8 rounds" }).click();
  await a.getByLabel("Most rounds").fill("8.5");
  await a.getByRole("button", { name: "Save correction" }).click();
  await expect(aResults).toContainText("6.5–8.5 rounds");

  // Rounds + reps as coaches write them: the round is 10 air squats, so "+5" is half a round.
  await a.getByRole("button", { name: "Log a result for block A" }).click();
  await a.getByLabel("Fewest rounds").fill("7 + 5");
  await expect(a.getByText("7 + 5 ≈ 7.5 rounds")).toBeVisible();
  await a.getByLabel("Class (optional)").fill("12:00");
  await a.getByRole("button", { name: "Save result" }).click();
  await expect(aResults).toContainText("7 + 5 rounds (≈ 7.5)");

  // Remove one, then undo.
  await bResults.getByRole("button", { name: "Remove result 9:30–15:00" }).click();
  await expect(b.getByText("No results yet.")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(bResults).toContainText("9:30–15:00");
  await page.reload();
  await expect(page.getByRole("list", { name: "Results for block B" })).toContainText("9:30–15:00");

  // The list says how many are logged.
  await page.goto(`/${slug}/results`);
  await expect(page.getByRole("link", { name: /Engine day/ })).toContainText("3 results");

  // A block with results keeps them: the builder will not drop it.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(workoutPath);
  await page.getByRole("button", { name: "Block A options" }).click();
  await page.getByRole("menuitem", { name: "Delete block" }).click();
  await page.getByRole("button", { name: /^Save/ }).click();
  await expect(page.getByText("Block A has results logged for it. Remove those results first, or keep the block.")).toBeVisible();

  // A viewer reads the results but cannot log them.
  const link = await invite(page, slug, uniqueEmail("viewer"), "Viewer");
  const { context, page: viewer } = await acceptAsNewUser(browser, link, "Vera Viewer");
  await viewer.setViewportSize({ width: 375, height: 812 });
  await viewer.goto(workoutPath.replace("/builder/", "/results/"));
  await expect(viewer.getByRole("list", { name: "Results for block A" })).toContainText("6.5–8.5 rounds");
  await expect(viewer.getByText("Owners, head coaches and coaches log results.")).toBeVisible();
  await expect(viewer.getByRole("button", { name: /Log a result/ })).toHaveCount(0);
  await expect(viewer.getByRole("button", { name: /^Edit result/ })).toHaveCount(0);
  await expectAccessible(viewer, "results, read-only (phone)");
  await context.close();
});
