import { expect, test } from "./fixtures";

const ROUTES = [
  "/for-you",
  "/projects",
  "/projects/JIG/summary",
  "/projects/JIG/board",
  "/projects/JIG/backlog",
  "/projects/JIG/timeline",
  "/projects/JIG/list",
  "/projects/JIG/time",
  "/projects/JIG/offers",
  "/projects/JIG/offers/o_jig_1",
  "/projects/JIG/budget",
  "/projects/JIG/reports",
  "/projects/JIG/settings",
  "/browse/JIG-1",
  "/timer",
  "/calendar",
  "/reports",
  "/offers",
  "/insights",
  "/clients",
  "/tags",
  "/team",
  "/filters",
  "/dashboards",
  "/settings",
];

test.describe("demo workspace", () => {
  test("every main page renders without client errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`[pageerror] ${page.url()} ${String(e).slice(0, 200)}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`[console] ${page.url()} ${m.text().slice(0, 200)}`);
    });
    for (const route of ROUTES) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route.replace(/[/.-]/g, "\\$&")}$`));
      await expect(page.locator("main")).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test("a new work item is saved and survives a reload", async ({ page }) => {
    await page.goto("/for-you");
    await page.getByRole("button", { name: "Create", exact: true }).first().click();
    await page.getByPlaceholder("What needs to be done?").fill("E2E persisted item");
    await page.getByRole("dialog").getByRole("button", { name: "Create", exact: true }).click();
    await expect(page).toHaveURL(/\/browse\/[A-Z]+-\d+$/);
    await expect(page.locator("header").getByText("Saved")).toBeVisible();
    await page.reload();
    await expect(page.getByText("E2E persisted item").first()).toBeVisible();
  });

  test("an accepted offer converts into an order with work items", async ({ page }) => {
    await page.goto("/projects/DATA/offers/o_data_1");
    await page.locator("main").getByRole("button", { name: /^Draft/ }).click();
    await page.getByRole("option", { name: /Accepted/ }).click();
    await page.getByRole("button", { name: "Convert to order" }).click();
    await page.getByRole("button", { name: /Create \d+ work items?/ }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("main")).toContainText("This offer is an order");
    await expect(page.locator("header").getByText("Saved")).toBeVisible();

    // the order lines became work items of the project, which is no longer a prospect
    await page.goto("/projects/DATA/list");
    const main = page.locator("main");
    await expect(main).toContainText("Ingestion pipelines");
    await expect(main).toContainText(/\d+ of \d+ work items/);
    await expect(main).not.toContainText("PROSPECT");
  });

  test("the forecast matrix values effort per member and baselines track the changes", async ({ page }) => {
    await page.goto("/projects/JIG/offers/o_jig_1");
    const main = page.locator("main");
    await main.getByRole("tab", { name: "Forecast" }).click();
    await expect(main.getByPlaceholder("Activity").first()).toHaveValue("Timer and manual entries");
    await expect(main).toContainText("Unsold");
    await expect(main).toContainText("324h");
    // more effort for one member on one activity moves the totals
    const cell = main.getByLabel("Sara Conti on Idle detection and reminders");
    await cell.fill("20");
    await cell.press("Enter");
    await expect(main).toContainText("332h");
    await expect(page.locator("header").getByText("Saved")).toBeVisible();

    await main.getByRole("tab", { name: "Baselines" }).click();
    await expect(main).toContainText("Since “Order”");
    await expect(main).toContainText("Joined");
    await main.getByRole("button", { name: "Take baseline" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Take a baseline");
    await dialog.getByRole("button", { name: "Take baseline" }).click();
    await expect(main).toContainText("Revision 2");
    await expect(main).toContainText("Since “Revision 2”");
    await expect(main).toContainText("No line changed since this baseline.");
    await expect(page.locator("header").getByText("Saved")).toBeVisible();
  });

  test("the budget page compares sold and consumed", async ({ page }) => {
    await page.goto("/projects/JIG/budget");
    const main = page.locator("main");
    await expect(main).toContainText("Sold");
    await expect(main).toContainText(/Consumed \((at price|revenue)\)/);
    await expect(main).toContainText("Burn");
    await expect(main).toContainText("Pipeline");
    await expect(main).toContainText("Consumed vs sold");
    await expect(main).toContainText("Forecast at completion");
    await expect(main).toContainText("Expected margin");
  });
});
