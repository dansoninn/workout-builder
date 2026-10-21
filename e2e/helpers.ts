import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page } from "@playwright/test";

export const PASSWORD = "e2e-password-1";

/** A unique address per test run, so tests never collide in the shared local database. */
export function uniqueEmail(who: string): string {
  return `${who}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}

export function uniqueGymName(): string {
  return `Gym ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export async function signUp(page: Page, { name, email }: { name: string; email: string }) {
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
}

export async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Creates a gym from the onboarding page and returns its address (slug). */
export async function createGym(page: Page, name = uniqueGymName()): Promise<string> {
  // Until the form is interactive, typed text can be lost; the address following the name shows it is.
  await expect(async () => {
    await page.getByLabel("Gym name").fill(name);
    await expect(page.getByLabel("Address")).not.toHaveValue("", { timeout: 1000 });
  }).toPass();
  const slug = await page.getByLabel("Address").inputValue();
  await page.getByRole("button", { name: "Create gym" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/builder$`));
  await expect(page.getByRole("heading", { name: "Builder", level: 1 })).toBeVisible();
  return slug;
}

/** A new owner with a new gym, signed in on `page`. */
export async function ownerWithGym(page: Page) {
  const email = uniqueEmail("owner");
  await signUp(page, { name: "Olga Owner", email });
  const slug = await createGym(page);
  return { email, slug };
}

/** Owner invites `email` with `role` from Settings → Members; returns the link shown once. */
export async function invite(page: Page, slug: string, email: string, roleLabel: string): Promise<string> {
  await page.goto(`/${slug}/settings/members`);
  await page.getByRole("button", { name: "Invite member" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Role").click();
  await page.getByRole("option", { name: new RegExp(`^${roleLabel}`) }).click();
  await dialog.getByRole("button", { name: "Create invitation link" }).click();
  const link = await page.getByTestId("invitation-link").inputValue();
  expect(link).toMatch(/\/invite\/[0-9a-f]{64}$/);
  await page.getByRole("button", { name: "Done" }).click();
  return new URL(link).pathname;
}

/** Someone new opens an invitation link in their own browser, creates an account there and joins. */
export async function acceptAsNewUser(browser: Browser, invitePath: string, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(invitePath);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account and join" }).click();
  await expect(page).toHaveURL(/\/builder$/);
  return { context, page };
}

/** The role shown under the gym's name in the sidebar. */
export async function expectRole(page: Page, role: string) {
  await expect(page.getByTestId("current-role")).toHaveText(role);
}

/** Waits until the app's keyboard shortcuts (⌘K, G then …) are listening. */
export async function shortcutsReady(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-shortcuts", "ready");
}

export async function openAccountMenu(page: Page) {
  await page.getByRole("button", { name: /account menu$/ }).click();
}

/** No WCAG 2.2 A/AA violations on the current page. */
export async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join("\n    ")}`,
  );
  expect(summary, `Accessibility problems on ${label}`).toEqual([]);
}
