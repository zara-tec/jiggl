import { chromium } from "playwright";
import { loginDemo, cleanupDemo } from "./_session.mjs";
const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await loginDemo(page, process.env.BASE || "http://localhost:3210");
const errs = [];
page.on("pageerror", (e) => errs.push("[pageerror] " + String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errs.push("[console] " + m.text().slice(0, 200)); });
const log = (...a) => console.log(...a);
const base = process.env.BASE || "http://localhost:3210";

// 1. Create a work item from the top-bar Create modal
await page.goto(base + "/projects/JIG/board", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Create", exact: true }).first().click();
await page.getByPlaceholder("What needs to be done?").fill("E2E: created from modal");
await page.locator("[role=dialog]").getByRole("button", { name: "Create", exact: true }).click();
await page.waitForURL(/\/browse\/JIG-\d+/);
log("1 created:", page.url());
await page.screenshot({ path: ".screenshots/e2e_issue.png" });

// 2. Start the timer from the work item page
await page.locator("main").getByRole("button", { name: "Start timer" }).click();
await page.waitForTimeout(2500);
const header = await page.locator("header").innerText();
log("2 top bar running timer:", /0:00:0[1-9]/.test(header), "|", header.replace(/\s+/g, " ").slice(0, 120));
await page.screenshot({ path: ".screenshots/e2e_running.png" });

// 3. Timer page shows the running entry; stop it
await page.goto(base + "/timer", { waitUntil: "networkidle" });
await page.getByTitle("Stop", { exact: true }).click();
await page.waitForTimeout(500);
log("3 timer page lists E2E entry after stop:", (await page.locator('main input[value="E2E: created from modal"]').count()) > 0);
await page.screenshot({ path: ".screenshots/e2e_timer_after_stop.png" });

// 4. Board drag & drop: TO DO -> IN PROGRESS
await page.goto(base + "/projects/JIG/board", { waitUntil: "networkidle" });
const card = page.getByText("Keyboard shortcut (S) to toggle timer").first();
const colHeader = page.locator("span", { hasText: /^In Progress$/ }).first();
const cb = await card.boundingBox();
const tb = await colHeader.boundingBox();
await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
await page.mouse.down();
await page.mouse.move(cb.x + cb.width / 2 + 12, cb.y + cb.height / 2 + 8, { steps: 4 });
await page.mouse.move(tb.x + 80, tb.y + 140, { steps: 20 });
await page.waitForTimeout(300);
await page.mouse.up();
await page.waitForTimeout(600);
await page.screenshot({ path: ".screenshots/e2e_board_after_drag.png" });
await page.goto(base + "/browse/JIG-11", { waitUntil: "networkidle" });
log("4 JIG-11 status after drag:", (await page.locator("main aside button").first().innerText()).trim());

// 5. Backlog: screenshot + open modal from a row
await page.goto(base + "/projects/JIG/backlog", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: ".screenshots/projects_JIG_backlog.png" });
await page.getByText("Continue a previous entry with one click").first().click();
await page.waitForTimeout(500);
log("5 issue modal open:", (await page.locator("[role=dialog]").count()) > 0);
await page.screenshot({ path: ".screenshots/e2e_issue_modal.png" });
await page.keyboard.press("Escape");

// 6. Global search
await page.locator("#global-search").fill("midnight");
await page.waitForTimeout(400);
await page.screenshot({ path: ".screenshots/e2e_search.png" });
await page.keyboard.press("Enter");
await page.waitForURL(/\/browse\/JIG-19/);
log("6 search navigated to:", page.url());

// 7. Create modal via keyboard shortcut
await page.keyboard.press("c");
await page.waitForTimeout(400);
log("7 create modal via 'c':", (await page.locator("[role=dialog]").count()) > 0);
await page.screenshot({ path: ".screenshots/e2e_create_modal.png" });
await page.keyboard.press("Escape");

// 8. Manual mode entry on timer page
await page.goto(base + "/timer", { waitUntil: "networkidle" });
await page.getByTitle("Manual mode").click();
await page.getByPlaceholder("What have you done?").fill("E2E manual entry");
await page.getByTitle("Add time entry").click();
await page.waitForTimeout(400);
log("8 manual entry added:", (await page.locator('main input[value="E2E manual entry"]').count()) > 0);

// 9. Reports tabs
await page.goto(base + "/reports", { waitUntil: "networkidle" });
await page.getByRole("tab", { name: "Detailed" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: ".screenshots/e2e_reports_detailed.png" });
await page.getByRole("tab", { name: "Weekly" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: ".screenshots/e2e_reports_weekly.png" });
log("9 reports tabs ok");

await cleanupDemo(page, process.env.BASE || "http://localhost:3210");
await b.close();
log("errors:", errs.length ? "\n" + [...new Set(errs)].join("\n") : "(none)");
