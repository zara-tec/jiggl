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

// Reports filter chips
await page.goto(base + "/reports", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: ".screenshots/reports.png" });
await page.getByRole("button", { name: /^Member/ }).click();
await page.getByRole("option", { name: /Giulia Bianchi/ }).click();
await page.waitForTimeout(300);
const chip = await page.locator("button", { hasText: "Member:" }).first().innerText();
console.log("member chip:", chip.replace(/\s+/g, " "));
await page.screenshot({ path: ".screenshots/reports_filtered.png" });

// List + projects + project time filters
for (const r of ["/projects/JIG/list", "/projects", "/projects/JIG/time"]) {
  await page.goto(base + r, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `.screenshots/${r.replace(/^\//, "").replace(/\//g, "_")}.png` });
}

// Calendar: drag on Friday 14:00 -> 15:00 must create an entry starting at 14:00
await page.goto(base + "/calendar", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const col = page.locator("main div.grid").nth(1).locator("> div").nth(5); // body grid; 0 = hours gutter, 5 = Friday
const box = await col.boundingBox();
const x = box.x + box.width / 2;
const y14 = box.y + 14 * 48 + 2;
await page.mouse.move(x, y14);
await page.mouse.down();
await page.mouse.move(x, y14 + 24, { steps: 4 });
await page.mouse.move(x, y14 + 48, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(500);
await page.waitForTimeout(1500); // let the sync push the new entry
const boot = await (await page.request.get(base + "/api/bootstrap")).json();
const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); monday.setDate(monday.getDate() + 4);
const friday = monday.toISOString().slice(0, 10);
const created = boot.data.timeEntries.find((e) => e.start.startsWith(friday + "T14:00")) ?? { error: "no entry at Friday 14:00", friday };
console.log("calendar drag created:", created);
await page.screenshot({ path: ".screenshots/calendar_after_drag.png" });
await cleanupDemo(page, process.env.BASE || "http://localhost:3210");
await b.close();
console.log("errors:", errs.length ? "\n" + [...new Set(errs)].join("\n") : "(none)");
