import { expect, test } from "./fixtures";

test.describe("without a session", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("pages need a session and remember where you were going", async ({ page }) => {
    await page.goto("/for-you");
    await expect(page).toHaveURL(/\/login\?next=%2Ffor-you$/);
    await expect(page.getByText("Log in to continue")).toBeVisible();
  });

  test("logging in through the form opens the workspace", async ({ page, account }) => {
    await page.goto("/login?next=%2Fprojects");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.locator("main")).toContainText("Jiggl Platform");
  });

  test("a wrong password is rejected", async ({ page, account }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill("nope-nope-nope");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Wrong email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    const res = await page.request.post("/api/auth/login", { data: { email: account.email, password: "nope-nope-nope" } });
    expect(res.status()).toBe(401);
  });
});

test.describe("with a session", () => {
  test("a logged-in user is sent from the auth pages to the app", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/for-you$/);
  });

  test("logging out ends the session", async ({ page }) => {
    await page.goto("/for-you");
    await expect(page.getByText("Recent projects")).toBeVisible();
    const res = await page.request.post("/api/auth/logout");
    expect(res.ok()).toBeTruthy();
    await page.goto("/for-you");
    await expect(page).toHaveURL(/\/login/);
  });
});
