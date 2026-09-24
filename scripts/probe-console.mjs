import { chromium } from "playwright";
import { loginDemo, cleanupDemo } from "./_session.mjs";
const base = process.env.BASE || "http://localhost:3000";
const routes = process.argv.slice(2);
const b = await chromium.launch({ channel: "chrome", headless: true });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await loginDemo(page, process.env.BASE || "http://localhost:3210");
const errs = [];
page.on("pageerror", (e) => errs.push("[pageerror] " + String(e).slice(0, 400)));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(`[${m.type()}] ${page.url().replace(base, "")} ${m.text().slice(0, 400)}`); });
for (const r of routes) { await page.goto(base + r, { waitUntil: "networkidle" }); await page.waitForTimeout(600); }
await cleanupDemo(page, process.env.BASE || "http://localhost:3210");
await b.close();
console.log(errs.length ? [...new Set(errs)].join("\n---\n") : "(no console errors)");
