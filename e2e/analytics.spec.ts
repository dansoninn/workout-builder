import { expect, type Page, test } from "@playwright/test";

import { expectAccessible, ownerWithGym } from "./helpers";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: string, days: number) => iso(new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000));

const WOD_1 = `WOD 1
A. E3M x 5, Load Moderate: 5 back squat @75-80%
B. E2M x 4, Load Moderate: 8-10 DB bench, 8/8 SA DB row
C. AMRAP 8, Pace Hard: 5 KB swing, 10 air squat, 15 DU`;
const WOD_2 = `WOD 2
For time (25 min cap), Pace Hard
800 m run
50 wall balls (9/6 kg)
30 alt. DB snatches (22.5/15 kg)
20 toes-to-bar
40 box jump-overs
10 burpees over the rower
800 m row`;
const WOD_3 = `WOD 3
4 rounds, 90/30, 90 s rest between rounds, Pace Hard
Max row
Max cal bike
Max lunges`;

async function paste(page: Page, slug: string, date: string, text: string, answers: [string, string][] = [], program?: string) {
  await page.goto(`/${slug}/builder/paste`);
  const box = page.getByLabel("The workout, as you would write it on the whiteboard").filter({ visible: true });
  await box.fill(text);
  await page.getByLabel("Date").filter({ visible: true }).fill(date);
  if (program) {
    await page.getByLabel("Program").filter({ visible: true }).click();
    await page.getByRole("option", { name: program }).click();
  }
  for (const [line, exercise] of answers) {
    await page.getByRole("listitem").filter({ hasText: line }).filter({ visible: true }).getByRole("button", { name: exercise, exact: true }).click();
  }
  await page.getByRole("button", { name: "Make workout" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/builder\/[0-9a-f-]{36}$/);
}

test("the §7 week in Analytics: the approved numbers, and warnings against the gym's guidelines", async ({ page }) => {
  test.setTimeout(120_000);
  const { slug } = await ownerWithGym(page);
  // Last week's Monday, Wednesday and Friday.
  const today = iso(new Date());
  const monday = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7) - 7);
  await paste(page, slug, monday, WOD_1);
  await paste(page, slug, addDays(monday, 2), WOD_2);
  await paste(page, slug, addDays(monday, 4), WOD_3, [["Max cal bike", "Air bike"], ["Max lunges", "Walking lunge"]]);

  // A new gym starts with the default guidelines (decision 18): the §7 week is outside five of them.
  await page.goto(`/${slug}/analytics?from=${monday}&to=${addDays(monday, 6)}`);
  await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: /outside your guidelines/ }).getByRole("heading")).toHaveText("5 things outside your guidelines");
  const summary = page.getByRole("region", { name: "Summary" });
  await expect(summary.locator("[data-visible-number]").first()).toHaveText("~593 AU");
  await expect(page.getByRole("table", { name: "Planned load per calendar week" })).toContainText("0.85");
  const strength = page.getByRole("region", { name: "Hard sets by pattern" });
  await expect(strength.getByRole("listitem")).toHaveText([/Squat\s*5/, /Horizontal push\s*4/, /Horizontal pull\s*4/]);
  await expect(page.locator("figure figcaption")).toContainText("Planned load per day");

  // The owner changes them: no vertical guidelines, a looser push : pull and knee : hip.
  await page.getByRole("link", { name: "Change them in Settings" }).click();
  await expect(page.getByRole("heading", { name: "Guidelines" })).toBeVisible();
  await expect(page.getByLabel("Hinge")).toHaveValue("4");
  await page.getByLabel("Vertical push").fill("");
  await page.getByLabel("Vertical pull").fill("");
  await page.getByRole("group", { name: "Push : pull" }).getByLabel("Highest").fill("1.5");
  await page.getByRole("group", { name: "Knee : hip" }).getByLabel("Highest").fill("2");
  await page.getByRole("button", { name: "Save guidelines" }).click();
  await expect(page.getByText("Guidelines saved")).toBeVisible();
  await expectAccessible(page, "guidelines");

  await page.goto(`/${slug}/analytics?from=${monday}&to=${addDays(monday, 6)}`);
  const warnings = page.getByRole("region", { name: /outside your guidelines/ });
  await expect(warnings.getByRole("heading")).toHaveText("2 things outside your guidelines");
  await expect(warnings.getByRole("listitem").nth(0)).toContainText("Hinge: no hard sets in 7 days");
  await expect(warnings.getByRole("listitem").nth(0)).toContainText("Guideline: At least 4 a week (4 for 7 days)");
  const kneeHip = warnings.getByRole("listitem").nth(1);
  await expect(kneeHip).toContainText("Knee : hip ~4.1: knee-heavy (exposure reps)");
  // The workouts behind it, most knee reps first, each a link.
  await expect(kneeHip.getByRole("link")).toHaveText(["WOD 3", "WOD 1", "WOD 2"]);
  await expectAccessible(page, "analytics with warnings");
  // The presets: 30 days ending today hold last week too.
  await page.goto(`/${slug}/analytics`);
  await expect(page.getByRole("button", { name: "7 days" })).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: "30 days" }).click();
  await expect(page).toHaveURL(/days=30/);
  await expect(page.getByRole("region", { name: "Summary" }).locator("[data-visible-number]").first()).toHaveText("~593 AU");

  await page.goto(`/${slug}/analytics?from=${monday}&to=${addDays(monday, 6)}`);
  await page.getByRole("region", { name: /outside your guidelines/ }).getByRole("listitem").nth(1).getByRole("link", { name: "WOD 3" }).click();
  await expect(page.getByLabel("Workout title").filter({ visible: true })).toHaveValue("WOD 3");
});

test("analytics shows one program by default; several only when chosen, always named; each program against its own guidelines", async ({ page }) => {
  test.setTimeout(120_000);
  const { slug } = await ownerWithGym(page);
  await page.goto(`/${slug}/settings/programs`);
  await page.getByRole("button", { name: "New program" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Strength club");
  await page.getByRole("dialog").getByRole("button", { name: "Create program" }).click();
  await expect(page.getByText("Strength club created")).toBeVisible();

  const today = iso(new Date());
  const monday = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7) - 7);
  await paste(page, slug, monday, WOD_1);
  await paste(page, slug, addDays(monday, 2), WOD_2, [], "Strength club");

  // One program by default: the gym's first.
  const week = `from=${monday}&to=${addDays(monday, 6)}`;
  await page.goto(`/${slug}/analytics?${week}`);
  const workouts = page.getByRole("region", { name: "Workouts in this period" });
  await expect(page.getByRole("button", { name: /^Program Class$/ })).toBeVisible();
  await expect(workouts.getByRole("link")).toHaveText([/WOD 1/]);

  // Both, chosen: named together, each workout with its program, load per program.
  await page.getByRole("button", { name: /^Program Class$/ }).click();
  await page.getByRole("checkbox", { name: "Strength club" }).check();
  await page.getByRole("button", { name: "Show these programs" }).click();
  await expect(page).toHaveURL(/programs=/);
  await expect(page.getByText("Class + Strength club, together.")).toBeVisible();
  await expect(workouts.getByRole("link")).toHaveText([/WOD 1\s*Class/, /WOD 2\s*Strength club/]);
  await expect(page.getByRole("table", { name: "Planned load per calendar week, per program" })).toContainText("Together");
  // Warnings name their program: each program is checked on its own.
  await expect(page.getByRole("region", { name: /outside your guidelines/ }).getByRole("listitem").first()).toContainText(/^Warning: (Class|Strength club): /);
  await expectAccessible(page, "analytics, two programs");

  // "Only" goes back to one program in one click.
  await page.getByRole("button", { name: /^Programs, together/ }).click();
  await page.getByRole("button", { name: "Only Strength club" }).click();
  await expect(page.getByText("Class + Strength club, together.")).toHaveCount(0);
  await expect(workouts.getByRole("link")).toHaveText([/WOD 2/]);
  await expect(page.getByText("Strength club uses the gym's guidelines")).toBeVisible();
  const strengthOnly = page.url();

  // Strength club gets its own guidelines (decision 5): only a monotony limit. Class keeps the gym's.
  await page.goto(`/${slug}/settings/guidelines`);
  await page.getByRole("navigation", { name: "Guidelines for" }).getByRole("link", { name: /Strength club/ }).click();
  await expect(page.getByRole("radio", { name: "The gym's guidelines" })).toBeChecked();
  await expect(page.getByLabel("Hinge").filter({ visible: true })).toBeDisabled();
  await page.getByRole("radio", { name: "Its own guidelines" }).check();
  for (const input of await page.locator("form input[inputmode=decimal]:visible").all()) await input.fill("");
  await page.getByLabel("Monotony, at most").filter({ visible: true }).fill("2");
  await page.getByRole("button", { name: "Save guidelines" }).filter({ visible: true }).click();
  await expect(page.getByText("Guidelines saved")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Guidelines for" }).getByRole("link", { name: /Strength club/ })).toContainText("own");
  await expectAccessible(page, "a program's own guidelines");

  await page.goto(strengthOnly);
  await expect(page.getByText("Strength club uses its own guidelines")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Within your guidelines" })).toBeVisible();
});
