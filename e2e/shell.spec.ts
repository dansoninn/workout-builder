import { expect, test } from "@playwright/test";

import { ownerWithGym, shortcutsReady } from "./helpers";

test("one gym's pages are 'not found' for members of another gym", async ({ page, browser }) => {
  await ownerWithGym(page);
  const otherContext = await browser.newContext();
  const { slug: otherSlug } = await ownerWithGym(await otherContext.newPage());

  for (const path of ["builder", "settings/members", "settings/programs"]) {
    await page.goto(`/${otherSlug}/${path}`);
    await expect(page.getByRole("heading", { name: "Gym not found" })).toBeVisible();
  }
  await otherContext.close();
});

test("the command palette and G shortcuts work without the mouse", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  await shortcutsReady(page);

  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.keyboard.type("members");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/${slug}/settings/members$`));
  await expect(page.getByRole("dialog", { name: "Command palette" })).toHaveCount(0);

  await page.keyboard.press("g");
  await page.keyboard.press("c");
  await expect(page).toHaveURL(new RegExp(`/${slug}/calendar$`));

  await page.keyboard.press("g");
  await page.keyboard.press("s");
  await expect(page).toHaveURL(new RegExp(`/${slug}/settings/gym$`));

  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Actions too: invite someone straight from the palette.
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("invite");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: /^Invite to/ })).toBeVisible();
});

test("on a phone, the navigation opens from the menu button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { slug } = await ownerWithGym(page);
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog", { name: "Navigation" }).getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/settings/gym$`));
  await expect(page.getByRole("dialog", { name: "Navigation" })).toHaveCount(0);
});

test("a new gym starts with a Class program; owners create, rename and archive programs", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  await page.goto(`/${slug}/settings/programs`);
  // Links from before "Tracks" became "Programs" still arrive.
  await page.goto(`/${slug}/settings/tracks`);
  await expect(page).toHaveURL(new RegExp(`/${slug}/settings/programs$`));
  const tracks = page.getByRole("region", { name: "Programs" });
  await expect(tracks.getByRole("listitem")).toHaveCount(1);
  await expect(tracks.getByText("Class", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "New program" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Strength club");
  await page.getByRole("dialog").getByTitle("Teal").click();
  await expect(page.getByRole("dialog").getByLabel("Teal")).toBeChecked();
  await page.getByRole("dialog").getByRole("button", { name: "Create program" }).click();
  await expect(page.getByText("Strength club created")).toBeVisible();
  await expect(tracks.getByRole("listitem")).toHaveCount(2);

  // Names are unique among a gym's active programs.
  await page.getByRole("button", { name: "New program" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("class");
  await page.getByRole("dialog").getByRole("button", { name: "Create program" }).click();
  await expect(page.getByText("There is already a program with this name")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Edit Class" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Group class");
  await page.getByRole("dialog").getByRole("button", { name: "Save program" }).click();
  await expect(page.getByText("Program saved")).toBeVisible();

  await page.getByRole("button", { name: "Archive Group class" }).click();
  await expect(page.getByRole("region", { name: "Archived" }).getByText("Group class")).toBeVisible();
  await expect(page.getByText("Group class archived")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Restore Group class" })).toBeVisible();
});

test("an owner renames the gym and everyone sees the new name", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  await page.goto(`/${slug}/settings/gym`);
  await page.getByLabel("Gym name").fill("Renamed Gym");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Gym settings saved")).toBeVisible();
  await expect(page.getByRole("button", { name: /Renamed Gym.*switch gym$/ })).toBeVisible();
});
