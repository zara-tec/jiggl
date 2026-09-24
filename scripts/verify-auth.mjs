import { chromium } from "playwright";
import { cleanupDemo } from "./_session.mjs";
const base = process.env.BASE || "http://localhost:3000";
const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("[pageerror] " + String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") errs.push("[console] " + page.url().replace(base, "") + " " + m.text().slice(0, 300)); });
const shot = (n) => page.screenshot({ path: `.screenshots/${n}.png` });
const email = `e2e-${Date.now()}@jiggl.test`;
const password = "correct-horse-battery";

// 1. unauthenticated access redirects to login
await page.goto(base + "/for-you", { waitUntil: "networkidle" });
console.log("1 redirected to login:", page.url().includes("/login"));
await shot("login");

// 2. register with the demo dataset
await page.goto(base + "/register", { waitUntil: "networkidle" });
await page.getByLabel("Full name").fill("E2E Tester");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill(password);
await page.getByLabel("Workspace name").fill("E2E workspace");
await shot("register");
await page.getByRole("button", { name: "Sign up" }).click();
await page.waitForURL(/\/for-you/, { timeout: 60000 });
await page.getByText("Recent projects").waitFor({ timeout: 60000 });
console.log("2 registered, workspace loaded:", await page.locator("main").innerText().then((t) => t.includes("Jiggl Platform")));
await shot("for-you");

// 3. create a work item and wait for the sync
await page.getByRole("button", { name: "Create", exact: true }).first().click();
await page.getByPlaceholder("What needs to be done?").fill("E2E persisted item");
await page.locator("[role=dialog]").getByRole("button", { name: "Create", exact: true }).click();
await page.waitForURL(/\/browse\/[A-Z]+-\d+/);
const key = page.url().split("/browse/")[1];
await page.waitForTimeout(2500);
const header = await page.locator("header").innerText();
console.log("3 created", key, "| sync indicator:", header.match(/Saved|Saving|Not saved|Offline/)?.[0] ?? "(none)");

// 4. reload: the item must come back from the server
await page.reload({ waitUntil: "networkidle" });
await page.getByText("E2E persisted item").first().waitFor({ timeout: 30000 });
console.log("4 persisted after reload:", true);

// 5. log out, log in again, item still there
await page.request.post(base + "/api/auth/logout");
await page.goto(base + "/for-you", { waitUntil: "networkidle" });
console.log("5a after logout redirected:", page.url().includes("/login"));
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill(password);
await page.getByRole("button", { name: "Log in" }).click();
await page.waitForURL(/\/for-you/, { timeout: 60000 });
await page.goto(base + "/browse/" + key, { waitUntil: "networkidle" });
await page.getByText("E2E persisted item").first().waitFor({ timeout: 30000 });
console.log("5b logged in again, item found:", true);

// 6. profile menu shows the workspace
await page.getByRole("button", { name: "Account" }).click();
await page.waitForTimeout(300);
await shot("profile_menu");
console.log("6 profile menu lists workspace:", (await page.locator("[role=dialog]").innerText()).includes("E2E workspace"));
await page.keyboard.press("Escape");

// 7. reset demo: the created item disappears, seed comes back
const r = await page.request.post(base + "/api/workspace/reset-demo");
console.log("7 reset status:", r.status());
await page.goto(base + "/browse/" + key, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
console.log("7 item gone after reset:", (await page.locator("main").innerText()).includes("Work item not found"));

// 8. wrong password
const bad = await page.request.post(base + "/api/auth/login", { data: { email, password: "nope-nope-nope" } });
console.log("8 wrong password status:", bad.status());
await cleanupDemo(page, process.env.BASE || "http://localhost:3210");
await b.close();
console.log("errors:", errs.length ? "\n" + [...new Set(errs)].join("\n") : "(none)");
