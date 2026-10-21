import { expect, test } from "@playwright/test";

import { expectRole, openAccountMenu, ownerWithGym, PASSWORD, signIn, signUp, uniqueEmail } from "./helpers";

test("a new owner signs up, creates a gym and lands in its builder", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Builder" })).toHaveAttribute("aria-current", "page");
  await expectRole(page, "Owner");

  // `/` brings you back to your gym.
  await page.goto("/");
  await expect(page).toHaveURL(new RegExp(`/${slug}/builder$`));
});

test("signing out and in again returns to the last gym", async ({ page }) => {
  const { email, slug } = await ownerWithGym(page);
  await openAccountMenu(page);
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await signIn(page, email);
  await expect(page).toHaveURL(new RegExp(`/${slug}/builder$`));
});

test("signed-out visitors go to sign in, then on to the page they asked for", async ({ page }) => {
  const { email, slug } = await ownerWithGym(page);
  await page.context().clearCookies();

  await page.goto(`/${slug}/settings/members`);
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/settings/members$`));
});

test("a wrong password is refused with a clear message", async ({ page }) => {
  const email = uniqueEmail("owner");
  await signUp(page, { name: "Olga Owner", email });
  await page.context().clearCookies();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email or password is incorrect." })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(email);
});

test("sign-up checks the form before sending it", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill("not an email");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your name")).toBeVisible();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters")).toBeVisible();
});

test("the theme choice is remembered", async ({ page }) => {
  await ownerWithGym(page);
  await openAccountMenu(page);
  await page.getByRole("menuitem", { name: "Theme" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});

test("a gym address that is taken or reserved is refused", async ({ page, browser }) => {
  const { slug } = await ownerWithGym(page);

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signUp(otherPage, { name: "Second Owner", email: uniqueEmail("owner") });
  await otherPage.getByLabel("Gym name").fill("Another gym");
  await otherPage.getByLabel("Address").fill(slug);
  await otherPage.getByRole("button", { name: "Create gym" }).click();
  await expect(otherPage.getByText("This address is taken. Try another.")).toBeVisible();

  await otherPage.getByLabel("Address").fill("settings");
  await otherPage.getByRole("button", { name: "Create gym" }).click();
  await expect(otherPage.getByText("This address is reserved. Try another.")).toBeVisible();
  await other.close();
});
