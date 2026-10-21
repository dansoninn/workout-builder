import { expect, test } from "@playwright/test";

import { acceptAsNewUser, expectRole, invite, ownerWithGym, signUp, uniqueEmail } from "./helpers";

test("an owner invites a coach, who joins with exactly coach rights", async ({ page, browser }) => {
  const { slug } = await ownerWithGym(page);
  const coachEmail = uniqueEmail("coach");
  const link = await invite(page, slug, coachEmail, "Coach");

  const pending = page.getByRole("region", { name: "Pending invitations" });
  await expect(pending.getByRole("cell", { name: coachEmail, exact: true })).toBeVisible();

  const { context, page: coach } = await acceptAsNewUser(browser, link, "Cara Coach");
  await expect(coach).toHaveURL(new RegExp(`/${slug}/builder$`));
  await expectRole(coach, "Coach");

  // Coaches see the team but cannot invite, change roles, or see emails.
  await coach.goto(`/${slug}/settings/members`);
  await expect(coach.getByRole("cell", { name: /Cara Coach/ })).toBeVisible();
  await expect(coach.getByRole("button", { name: "Invite member" })).toHaveCount(0);
  await expect(coach.getByRole("combobox")).toHaveCount(0);
  await expect(coach.getByText(coachEmail)).toHaveCount(0);
  await expect(coach.getByText("Only the gym's owners can invite people or change roles.")).toBeVisible();

  // Nor manage tracks.
  await coach.goto(`/${slug}/settings/tracks`);
  await expect(coach.getByRole("button", { name: "New track" })).toHaveCount(0);

  // The invitation is used up.
  await page.reload();
  await expect(pending).toHaveCount(1);
  await expect(page.getByText("No pending invitations.")).toBeVisible();
  await context.close();
});

test("an invitation works once, and only for its email", async ({ page, browser }) => {
  const { slug } = await ownerWithGym(page);
  const viewerEmail = uniqueEmail("viewer");
  const link = await invite(page, slug, viewerEmail, "Viewer");

  // Someone signed in with another email is told so.
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await signUp(other, { name: "Otto Other", email: uniqueEmail("other") });
  await other.goto(link);
  await expect(other.getByText(`This invitation is for ${viewerEmail}`)).toBeVisible();
  await expect(other.getByRole("button", { name: /^Join/ })).toHaveCount(0);

  // The invited person joins…
  const { context, page: viewer } = await acceptAsNewUser(browser, link, "Vera Viewer");
  await expectRole(viewer, "Viewer");

  // …and the link cannot be used again.
  await other.goto(link);
  await expect(other.getByText("This invitation has already been used.")).toBeVisible();
  await otherContext.close();
  await context.close();
});

test("a viewer sees the gym but cannot change it", async ({ page, browser }) => {
  const { slug } = await ownerWithGym(page);
  const link = await invite(page, slug, uniqueEmail("viewer"), "Viewer");
  const { context, page: viewer } = await acceptAsNewUser(browser, link, "Vera Viewer");

  await viewer.goto(`/${slug}/settings/gym`);
  await expect(viewer.getByText("Only the gym's owners can change these.")).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Save changes" })).toHaveCount(0);

  await viewer.goto(`/${slug}/settings/tracks`);
  await expect(viewer.getByText("Owners and head coaches manage tracks.")).toBeVisible();
  await expect(viewer.getByRole("button", { name: "New track" })).toHaveCount(0);
  await context.close();
});

test("an owner changes a role, then removes the member", async ({ page, browser }) => {
  const { slug } = await ownerWithGym(page);
  const link = await invite(page, slug, uniqueEmail("coach"), "Coach");
  const { context, page: coach } = await acceptAsNewUser(browser, link, "Cara Coach");

  await page.reload();
  await page.getByRole("combobox", { name: "Role of Cara Coach" }).click();
  await page.getByRole("option", { name: "Head coach" }).click();
  await expect(page.getByText("Cara Coach is now head coach")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Role of Cara Coach" })).toHaveText(/Head coach/);

  // The head coach can now manage tracks.
  await coach.goto(`/${slug}/settings/tracks`);
  await expect(coach.getByRole("button", { name: "New track" })).toBeVisible();

  await page.getByRole("button", { name: "Remove Cara Coach" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove member" }).click();
  await expect(page.getByText(/Cara Coach was removed/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("cell", { name: /Cara Coach/ })).toHaveCount(0);

  // Gone means gone.
  await coach.goto(`/${slug}/builder`);
  await expect(coach.getByRole("heading", { name: "Gym not found" })).toBeVisible();
  await context.close();
});

test("an owner cancels an invitation, or replaces it with a fresh link", async ({ page, browser }) => {
  const { slug } = await ownerWithGym(page);
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  const email = uniqueEmail("coach");
  const firstLink = await invite(page, slug, email, "Coach");

  await page.getByRole("button", { name: `New link for ${email}` }).click();
  const secondLink = new URL(await page.getByTestId("invitation-link").inputValue()).pathname;
  expect(secondLink).not.toBe(firstLink);
  await page.getByRole("button", { name: "Done" }).click();

  // The first link no longer works; the new one does, until it is cancelled.
  await visitor.goto(firstLink);
  await expect(visitor.getByText(/cancelled or replaced by a newer link/)).toBeVisible();
  await visitor.goto(secondLink);
  await expect(visitor.getByRole("button", { name: "Create account and join" })).toBeVisible();

  await page.getByRole("button", { name: `Cancel invitation for ${email}` }).click();
  await expect(page.getByText(`Invitation for ${email} cancelled`)).toBeVisible();
  await visitor.goto(secondLink);
  await expect(visitor.getByText(/cancelled or replaced by a newer link/)).toBeVisible();
  await visitorContext.close();
});

test("the last owner cannot remove themself or step down", async ({ page }) => {
  const { slug } = await ownerWithGym(page);
  await page.goto(`/${slug}/settings/members`);
  await expect(page.getByRole("combobox", { name: "Role of Olga Owner" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /^Leave/ })).toBeDisabled();
});
