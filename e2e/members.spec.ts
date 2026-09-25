import { expect, test } from "./fixtures";

const testEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@jiggl.test`;

test.describe("deactivating and removing members", () => {
  test("a deactivated member keeps their history but loses access until an admin reactivates them", async ({ page, browser, baseURL }) => {
    const email = testEmail("leaving");
    const password = "leaving-person-1";
    const invited = await page.request.post("/api/workspace/members", { data: { name: "Leaving Person", email, password } });
    expect(invited.ok()).toBe(true);

    // the member can sign in, from a browser without the admin's cookies
    const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const login = () => ctx.request.post("/api/auth/login", { data: { email, password } });
    try {
      expect((await login()).status()).toBe(200);

      // the admin deactivates them from the Team page
      await page.goto("/team");
      const row = page.locator("main tr", { hasText: "Leaving Person" });
      await row.getByRole("button", { name: "Actions for Leaving Person" }).click();
      await page.getByRole("button", { name: /^Deactivate/ }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("Hours, work items, comments and forecast stay as they are");
      await dialog.getByRole("button", { name: "Deactivate", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(row).toContainText("Deactivated");

      // the open session is refused, the app explains why, and signing in again fails
      const boot = await ctx.request.get("/api/bootstrap");
      expect(boot.status()).toBe(403);
      expect((await boot.json()).error).toContain("deactivated");
      const other = await ctx.newPage();
      await other.goto("/for-you");
      await expect(other.locator("main")).toContainText("Your access to this workspace has been removed or deactivated");
      await expect(other.getByRole("button", { name: "Sign out" })).toBeVisible();
      const refused = await login();
      expect(refused.status()).toBe(403);
      // nor can the member reactivate themselves through the sync
      expect((await ctx.request.post("/api/sync", { data: { upserts: { users: [] } } })).status()).toBe(403);

      // the deactivation survives a reload and a sync of the member record by the admin
      await page.reload();
      await expect(row).toContainText("Deactivated");

      // reactivating gives the access back
      await row.getByRole("button", { name: "Actions for Leaving Person" }).click();
      await page.getByRole("button", { name: /^Reactivate/ }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Reactivate", exact: true }).click();
      await expect(row).not.toContainText("Deactivated");
      expect((await login()).status()).toBe(200);
    } finally {
      await ctx.request.post("/api/auth/delete-account");
      await ctx.close();
    }
  });

  test("members with history cannot be removed; a member added by mistake can", async ({ page }) => {
    await page.goto("/team");

    // a demo member with hours and work items: removal is disabled and refused by the server
    const busy = page.locator("main tr", { hasText: "Giulia Bianchi" });
    await busy.getByRole("button", { name: "Actions for Giulia Bianchi" }).click();
    const remove = page.getByRole("button", { name: /Remove from workspace/ });
    await expect(remove).toBeDisabled();
    await expect(remove).toContainText("Deactivate instead");
    await page.keyboard.press("Escape");
    const boot = await (await page.request.get("/api/bootstrap")).json();
    const giulia = boot.data.users.find((u: { name: string }) => u.name === "Giulia Bianchi");
    const refused = await page.request.delete("/api/workspace/members", { data: { memberId: giulia.id } });
    expect(refused.status()).toBe(409);
    expect((await refused.json()).error).toContain("deactivate them instead");

    // nobody can deactivate or remove themselves
    expect((await page.request.patch("/api/workspace/members", { data: { memberId: boot.session.memberId, active: false } })).status()).toBe(400);

    // a member added by mistake goes away for good
    expect((await page.request.post("/api/workspace/members", { data: { name: "Mistake Person", email: testEmail("mistake") } })).ok()).toBe(true);
    await page.reload();
    const row = page.locator("main tr", { hasText: "Mistake Person" });
    await row.getByRole("button", { name: "Actions for Mistake Person" }).click();
    await page.getByRole("button", { name: /Remove from workspace/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Nothing in the workspace refers to Mistake");
    await dialog.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(row).toHaveCount(0);
    await page.reload();
    await expect(page.locator("main")).toContainText("Giulia Bianchi");
    await expect(page.locator("main tr", { hasText: "Mistake Person" })).toHaveCount(0);
  });
});
