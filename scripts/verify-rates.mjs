import { chromium } from "playwright";
import { loginDemo, cleanupDemo } from "./_session.mjs";
const base = process.env.BASE || "http://localhost:3000";
const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await loginDemo(page, process.env.BASE || "http://localhost:3210");
const errs = [];
page.on("pageerror", (e) => errs.push("[pageerror] " + String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errs.push("[console] " + m.text().slice(0, 200)); });

await page.goto(base + "/team", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: ".screenshots/team.png" });

// Reports before the rate change (This month to include everything)
await page.goto(base + "/reports", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const tiles = async () => (await page.locator("main").innerText()).match(/Revenue|Cost|Margin/g)?.length;
const before = await page.locator("main").innerText();
const costBefore = before.match(/([^\n]+)\nCost\n/)?.[1];
console.log("cost before:", costBefore);
await page.screenshot({ path: ".screenshots/reports.png" });

// Change the owner's cost rate retroactively (all entries) to 100
await page.goto(base + "/team", { waitUntil: "networkidle" });
await page.locator("tr", { hasText: "E2E Tester" }).getByText("Change").click();
await page.waitForTimeout(300);
await page.screenshot({ path: ".screenshots/rate_modal.png" });
await page.locator("[role=dialog] input").first().fill("100");
await page.getByText("All time entries").click();
const warn = await page.locator("[role=dialog]").innerText();
console.log("affected line:", warn.match(/\d+ existing time entr[^\n]*/)?.[0]);
await page.getByRole("button", { name: "Apply", exact: true }).click();
await page.waitForTimeout(300);
console.log("team cell:", (await page.locator("tr", { hasText: "E2E Tester" }).innerText()).replace(/\s+/g, " ").slice(0, 90));

await page.goto(base + "/reports", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const after = await page.locator("main").innerText();
console.log("cost after:", after.match(/([^\n]+)\nCost\n/)?.[1]);

// Project settings rates section
await page.goto(base + "/projects/MOB/settings", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.locator("main").evaluate((el) => el.querySelector("h2:nth-of-type(2)")?.scrollIntoView());
await page.screenshot({ path: ".screenshots/projects_MOB_settings.png" });
await page.goto(base + "/projects/JIG/time", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: ".screenshots/projects_JIG_time.png" });
await cleanupDemo(page, process.env.BASE || "http://localhost:3210");
await b.close();
console.log("errors:", errs.length ? "\n" + [...new Set(errs)].join("\n") : "(none)");
