import { chromium } from "playwright";
import { loginDemo, cleanupDemo } from "./_session.mjs";
const base = process.env.BASE || "http://localhost:3000";
const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await loginDemo(page, process.env.BASE || "http://localhost:3210");
const errs = [];
page.on("pageerror", (e) => errs.push("[pageerror] " + String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error") errs.push("[console] " + page.url().replace(base, "") + " " + m.text().slice(0, 300)); });
const shot = (n) => page.screenshot({ path: `.screenshots/${n}.png` });
const go = async (r) => { await page.goto(base + r, { waitUntil: "networkidle" }); await page.waitForTimeout(600); };

await go("/timer");
const timerText = await page.locator("main").innerText();
console.log("timer shows allocated rows:", (timerText.match(/ALLOCATED/g) || []).length, "| capacity line:", timerText.match(/[^\n]*allocated · [^\n]*tracked[^\n]*/)?.[0]);
await shot("timer");

await go("/calendar");
const cal = await page.locator("main").innerText();
console.log("calendar allocated blocks:", await page.locator("button[data-entry].border-dashed").count(), "| header alloc:", (cal.match(/alloc\./g) || []).length);
await shot("calendar");
// click an allocated block -> popover -> convert
const block = page.locator("button[data-entry].border-dashed").first();
if (await block.count()) {
  await block.click();
  await page.waitForTimeout(300);
  await shot("calendar_alloc_popover");
  await page.getByRole("button", { name: "Convert to entry" }).click();
  await page.waitForTimeout(400);
  const after = await page.locator("main").innerText();
  void after;
  console.log("after convert, allocated blocks:", await page.locator("button[data-entry].border-dashed").count());
}

await go("/reports");
await page.locator("button", { hasText: /^Source/ }).click();
await page.getByRole("option", { name: /Allocated/ }).click();
await page.waitForTimeout(400);
const rep = await page.locator("main").innerText();
console.log("reports allocated-only total:", rep.match(/([^\n]+)\nTotal hours/)?.[1]);
await shot("reports_allocated");

await go("/projects/INT/settings");
await page.locator("main").evaluate((el) => { const h = [...el.querySelectorAll("h2")].find((x) => x.textContent === "Time mode"); h?.scrollIntoView(); });
await shot("projects_INT_settings");
console.log("INT allocations rows:", await page.locator("main table").last().locator("tbody tr").count());

await go("/team");
await shot("team");
console.log("team time off rows:", (await page.locator("main").innerText()).includes("Vacation"));
await go("/settings");
await page.locator("main").evaluate((el) => { const h = [...el.querySelectorAll("h2")].find((x) => x.textContent?.startsWith("Working days")); h?.scrollIntoView(); });
await shot("settings");
await go("/projects/JIG/summary");
await go("/for-you");
await go("/dashboards");
await go("/clients/c_acme");
await cleanupDemo(page, process.env.BASE || "http://localhost:3210");
await b.close();
console.log("errors:", errs.length ? "\n" + [...new Set(errs)].join("\n") : "(none)");
