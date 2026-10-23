import { expect, test } from "@playwright/test";

import { xlsxFile } from "../src/lib/import/test-files";
import { expectAccessible, ownerWithGym } from "./helpers";

// Program import (item 5 of Daniel's list, 2026-10-23), on a made-up studio
// plan laid out as Afrek lays out its year: a sheet per month, programs side
// by side, column A the day focus or a holiday.

const studio = () =>
  Buffer.from(
    xlsxFile([
      {
        name: "Janúar",
        rows: [
          ["", "", "", "CLASS", "", "", "STRENGTH CLUB", ""],
          ["Nýársdagur", 1, "Fim", "", "", "", "", ""],
          ["Squat", 2, "Fös", "A. 5 x 5 Back squat\nB. AMRAP 10\n10 burpees\n10 kb swings", "", "", "Squat", "A. 5 x 3 Back squat"],
          ["Mix", 3, "Lau", "AMRAP 12\n12 wall balls\n9 burpees", "", "", "", ""],
          ["PP", 4, "Sun", "Murph", "", "", "", ""],
          ["Squat", 5, "Mán", "For time\n21-15-9\nThrusters 43/30 kg\nPull-ups", "", "", "Bench Press", "???"],
          ["Mix", 6, "Þri", "AMRAP 12\n12 wall balls\n9 burpees", "", "", "", ""],
          ["Squat", 7, "Mið", "AMRAP 8\n3 x 10 squat\n10 bike", "", "", "", ""],
        ],
      },
    ]),
  );

test("import a month from a spreadsheet: answer once, preview, import, see it analysed, and undo it", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  await page.goto(`/${slug}/import`);
  await expect(page.getByRole("heading", { name: "Import", level: 1 })).toBeVisible();
  await expectAccessible(page, "import, start");

  await page.getByLabel("A file").setInputFiles({ name: "studio-2026.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: studio() });
  await expect(page.getByRole("status").filter({ hasText: "Found:" })).toContainText("2 programs: CLASS, STRENGTH CLUB, 2026");
  await page.getByRole("button", { name: "Start the import" }).click();
  await expect(page).toHaveURL(/\/import\/[0-9a-f-]{36}$/);

  // Needs you: the generic words, most lines first; one answer each, for the whole import.
  await expect(page.getByRole("heading", { name: "studio-2026.xlsx" })).toBeVisible();
  await page.getByRole("group", { name: "Which “bike” does your gym mean?" }).getByRole("button", { name: "Air bike" }).click();
  await page.getByRole("group", { name: "Which “squat” does your gym mean?" }).getByRole("button", { name: "Air squat" }).click();
  await expect(page.getByRole("heading", { name: "Nothing needs you" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Lines understood" })).toHaveAttribute("aria-valuenow", "100");
  await expect(page.getByRole("row", { name: /Nýársdagur/ })).toBeVisible();
  await expect(page.getByText("All changes kept")).toBeVisible();
  await expectAccessible(page, "import, needs you");

  // Answers are kept: a reload brings them back.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Nothing needs you" })).toBeVisible();

  // Preview: a day next to the document.
  await page.getByRole("button", { name: "3. Preview" }).click();
  await page.getByRole("button", { name: /^Sun 4 Jan, PP: Ready/ }).click();
  const day = page.getByRole("dialog");
  await expect(day.getByRole("region", { name: "In the document" })).toContainText("Murph");
  await expect(day.getByRole("region", { name: "What the app reads" })).toContainText("Pull-up");
  await day.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("What the period adds up to")).toBeVisible();
  await expectAccessible(page, "import, preview");

  // Import, published.
  await page.getByRole("button", { name: "4. Import" }).click();
  await page.getByLabel(/Publish the \d+ ready workouts/).check();
  await page.getByRole("button", { name: "Import 6 workouts" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Import" }).click();
  await expect(page).toHaveURL(/\/import\/[0-9a-f-]{36}\/report$/);
  await expect(page.getByRole("heading", { name: "Your programming, analysed" })).toBeVisible();
  await expect(page.getByRole("region", { name: "In plain words" })).toContainText("6 workouts");
  await expectAccessible(page, "import, report");

  // On the calendar: the workouts, the holiday, the day focus.
  await page.goto(`/${slug}/calendar?view=month&date=2026-01-10`);
  await expect(page.locator('[data-drop-target="2026-01-04"]')).toContainText("Murph");
  await expect(page.locator('[data-drop-target="2026-01-01"]')).toContainText("Nýársdagur · Closed");
  await expect(page.locator('[data-drop-target="2026-01-02"]')).toContainText("Squat");

  // Undo it, in one step.
  await page.goto(`/${slug}/import`);
  await page.getByRole("link", { name: "studio-2026.xlsx" }).click();
  await page.getByRole("button", { name: "Undo the whole import" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Undo the import" }).click();
  await expect(page.getByText(/Import undone: 6 workouts taken off/)).toBeVisible();
  await page.goto(`/${slug}/calendar?view=month&date=2026-01-10`);
  await expect(page.locator('[data-drop-target="2026-01-04"]')).not.toContainText("Murph");
});

test("pasted text: personal data is taken out before anything is kept", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  await page.goto(`/${slug}/import`);
  await page.getByLabel("Or paste the text").fill("Monday 5.1.2026\nAMRAP 12\n10 burpees\nGreat work Jón Jónsson!\n\nTuesday 6.1.2026\n5 x 5 Back squat");
  const found = page.getByRole("status").filter({ hasText: "Found:" });
  await expect(found).toContainText("Text with a date at the top of each day.");
  await expect(found).toContainText("Personal data: 1 full name");
  await page.getByRole("button", { name: "Start the import" }).click();
  await expect(page).toHaveURL(/\/import\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "3. Preview" }).click();
  await page.getByRole("button", { name: /^Mon 5 Jan/ }).click();
  await expect(page.getByRole("dialog").getByRole("region", { name: "In the document" })).toContainText("Great work [removed]!");
});
