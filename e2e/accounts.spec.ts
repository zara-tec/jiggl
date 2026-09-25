import { expect, test } from "./fixtures";

test.describe("accounts and teams", () => {
  test("an admin invites a member with a welcome password, resets it, and the member signs in and changes it", async ({ page, browser, baseURL }) => {
    const email = `e2e-invited-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@jiggl.test`;

    // invite with a generated welcome password
    await page.goto("/team");
    await page.getByRole("button", { name: "Invite member" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill("Invited Person");
    await dialog.getByLabel("Email", { exact: true }).fill(email);
    await dialog.getByRole("button", { name: "Generate" }).click();
    const welcome = await dialog.locator("input.font-mono").inputValue();
    expect(welcome).toMatch(/^[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4}$/);
    await dialog.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(dialog).toContainText("Invited Person can sign in now");
    await expect(dialog).toContainText(email);
    await dialog.getByRole("button", { name: "Done" }).click();
    const row = page.locator("main tr", { hasText: "Invited Person" });
    await expect(row).toBeVisible();
    await expect(row).not.toContainText("No account");

    // the admin resets it
    await row.getByRole("button", { name: "Actions for Invited Person" }).click();
    await page.getByRole("button", { name: /Reset password/ }).click();
    const reset = page.getByRole("dialog");
    await reset.getByRole("button", { name: "Generate" }).click();
    const password = await reset.locator("input.font-mono").inputValue();
    expect(password).not.toBe(welcome);
    await reset.getByRole("button", { name: "Set password" }).click();
    await expect(reset).toContainText("Password of Invited Person replaced");
    await reset.getByRole("button", { name: "Done" }).click();

    // the invited person signs in with the reset password, in a fresh browser (no cookies of the admin), and lands in the admin's workspace
    const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const other = await ctx.newPage();
    try {
      await other.goto("/login");
      await other.getByPlaceholder("you@company.com").fill(email);
      await other.locator('input[type="password"]').fill(password);
      await other.getByRole("button", { name: /sign in|log in/i }).click();
      await expect(other).not.toHaveURL(/\/login/);
      await expect(other.locator("main")).toBeVisible();
      await other.goto("/team");
      await expect(other.locator("main")).toContainText("Invited Person");
      await expect(other.locator("main")).toContainText("E2E Tester");

      // changes their own password and signs in again with it
      await other.goto("/settings");
      const form = other.locator("form", { hasText: "Current password" });
      await form.getByLabel("Current password", { exact: true }).fill(password);
      await form.getByLabel("New password", { exact: true }).fill("brand-new-secret-1");
      await form.getByLabel("Repeat new password", { exact: true }).fill("brand-new-secret-1");
      await form.getByRole("button", { name: "Change password" }).click();
      await expect(form).toContainText("Password changed.");
      await ctx.request.post("/api/auth/logout");
      await other.goto("/login");
      await other.getByPlaceholder("you@company.com").fill(email);
      await other.locator('input[type="password"]').fill("brand-new-secret-1");
      await other.getByRole("button", { name: /sign in|log in/i }).click();
      await expect(other).not.toHaveURL(/\/login/);
    } finally {
      // the invited account deletes itself (test addresses need no password)
      await ctx.request.post("/api/auth/delete-account");
      await ctx.close();
    }
  });

  test("instance settings are the owner's business: others see nothing and are refused", async ({ page }) => {
    // a throw-away account is never the oldest one, so it does not own the instance
    const info = await (await page.request.get("/api/instance")).json();
    expect(["open", "invited", "domains"]).toContain(info.registration);
    expect(info.owner).toBe(false);
    expect(info.ownerEmail).toBeUndefined();
    const denied = await page.request.post("/api/instance", { data: { registration: "invited" } });
    expect(denied.status()).toBe(403);
    await page.goto("/settings");
    const main = page.locator("main");
    await expect(main).toContainText("Password");
    await expect(main).not.toContainText("Hand over to");
  });

  test("a project team restricts who can be assigned", async ({ page }) => {
    // the demo's Mobile App project has a chosen team smaller than the workspace
    await page.goto("/projects/MOB/settings");
    const main = page.locator("main");
    await expect(main).toContainText("Team");
    await expect(main.getByTestId("team-member").first()).toBeVisible();
    const chips = main.getByTestId("team-member");
    const before = await chips.allInnerTexts();
    await main.getByRole("button", { name: /^Add member/ }).click();
    await page.getByRole("option").first().click();
    await expect(chips).toHaveCount(before.length + 1);
    const after = await chips.allInnerTexts();
    const added = after.find((t) => !before.includes(t))!;
    expect(added).toBeTruthy();
    await chips.filter({ hasText: added }).getByRole("button", { name: /^Remove / }).click();
    await expect(chips).toHaveCount(before.length);
    await expect(page.locator("header").getByText("Saved")).toBeVisible();
  });
});
