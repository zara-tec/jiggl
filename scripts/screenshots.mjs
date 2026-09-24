import { chromium } from "playwright";
import { loginDemo, cleanupDemo } from "./_session.mjs";
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ["/for-you","/projects","/projects/JIG/summary","/projects/JIG/backlog","/projects/JIG/board","/projects/JIG/list","/projects/JIG/timeline","/projects/JIG/calendar","/projects/JIG/time","/projects/JIG/reports","/projects/JIG/settings","/browse/JIG-9","/timer","/calendar","/reports","/clients","/clients/c_acme","/tags","/team","/filters","/dashboards","/settings","/offers","/projects/JIG/offers","/projects/JIG/offers/o_jig_1","/projects/DATA/offers/o_data_1","/projects/JIG/budget","/projects/MOB/budget","/insights"];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
if (process.env.THEME) await ctx.addInitScript((t) => localStorage.setItem("jiggl-theme", t), process.env.THEME);
const page = await ctx.newPage();
await loginDemo(page, process.env.BASE || "http://localhost:3210");
const errors = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`[${m.type()}] ${page.url().replace(process.env.BASE || "http://localhost:3210","")} ${m.text().slice(0,300)}`); });
page.on("pageerror", (e) => errors.push(`[pageerror] ${page.url().replace(process.env.BASE || "http://localhost:3210","")} ${String(e).slice(0,300)}`));
for (const r of routes) {
  await page.goto((process.env.BASE || "http://localhost:3210") + r, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const name = r === "/" ? "root" : r.replace(/^\//, "").replace(/[\/?=]/g, "_");
  await page.screenshot({ path: `.screenshots/${process.env.THEME === "dark" ? "dark/" : ""}${name}.png`, fullPage: false });
  console.log("shot", r);
}
await cleanupDemo(page, process.env.BASE || "http://localhost:3210");
await browser.close();
console.log("---- console errors/warnings ----");
console.log(errors.length ? [...new Set(errors)].join("\n") : "(none)");
