import { chromium } from "playwright";
import { loginDemo, cleanupDemo } from "./_session.mjs";
const base = process.env.BASE || "http://localhost:3000";
const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem("jiggl-theme", "dark"));
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
// login page without a session
await page.goto(base + "/login", { waitUntil: "networkidle" });
await page.screenshot({ path: ".screenshots/dark/login.png" });
await loginDemo(page, base);
await page.goto(base + "/projects/JIG/board", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.keyboard.press("c");
await page.waitForTimeout(400);
await page.screenshot({ path: ".screenshots/dark/create_modal.png" });
await page.keyboard.press("Escape");
await page.getByRole("button", { name: /^Type/ }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: ".screenshots/dark/board_type_menu.png" });
await page.keyboard.press("Escape");
await page.getByText("Keyboard shortcut (S) to toggle timer").first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: ".screenshots/dark/issue_modal.png" });
await page.keyboard.press("Escape");
for (const r of ["/team", "/insights", "/dashboards", "/projects/JIG/backlog", "/projects/JIG/timeline", "/offers", "/clients/c_acme"]) {
  await page.goto(base + r, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `.screenshots/dark/${r.replace(/^\//, "").replace(/\//g, "_")}.png` });
}
await page.getByRole("button", { name: "Account" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: ".screenshots/dark/profile_menu.png" });
await cleanupDemo(page, base);
await b.close();
console.log("errors:", errs.length ? errs.join("\n") : "(none)");
