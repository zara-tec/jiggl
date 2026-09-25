// Board layout: columns share the available width, the full-screen toggle hides the app chrome,
// Esc leaves it, and a dragged card keeps the width of its column.
// Usage: BASE=http://localhost:3000 node scripts/verify-board.mjs  (THEME=dark for the dark theme)
import { chromium } from "playwright";
import { loginDemo, cleanupDemo } from "./_session.mjs";

const BASE = process.env.BASE || "http://localhost:3210";
const dir = `.screenshots/${process.env.THEME === "dark" ? "dark/" : ""}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
if (process.env.THEME) await ctx.addInitScript((t) => localStorage.setItem("jiggl-theme", t), process.env.THEME);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
await loginDemo(page, BASE);

const columnWidths = () => page.$$eval("main .flex.gap-3 > div", (els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
const check = (ok, msg) => console.log(ok ? "ok  " : "FAIL", msg);

await page.goto(BASE + "/projects/JIG/board", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const wide = await columnWidths();
console.log("columns at 1920:", wide);
check(wide.length === 4 && wide.every((w) => w > 330), "columns stretch beyond the old 286px");
await page.screenshot({ path: `${dir}board-1920.png` });

await page.getByRole("button", { name: "Enter full screen" }).click();
await page.waitForTimeout(400);
const topbarCovered = await page.evaluate(() => document.elementFromPoint(20, 20)?.closest("header") === null);
const full = await columnWidths();
console.log("columns in full screen:", full);
check(topbarCovered && full[0] > wide[0], "full screen covers the top bar and sidebar and widens the columns");
await page.screenshot({ path: `${dir}board-full.png` });

// a card opened in full screen shows its dialog above the board; Esc closes the dialog first
await page.locator("main .flex.gap-3 > div").first().locator("[data-issue-card], [role=button], .cursor-pointer").first().click().catch(() => {});
await page.waitForTimeout(500);
const dialogOpen = await page.locator("[aria-modal]").count();
if (dialogOpen) {
  await page.screenshot({ path: `${dir}board-full-dialog.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check((await page.locator("[aria-modal]").count()) === 0 && (await page.getByRole("button", { name: "Exit full screen" }).count()) === 1, "Esc closes the dialog and stays in full screen");
} else console.log("note: no dialog opened by the card click");

await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check((await page.getByRole("button", { name: "Enter full screen" }).count()) === 1, "Esc leaves full screen");

// drag a card halfway: the overlay keeps the column width
const card = page.locator("main .flex.gap-3 > div").first().locator("div[style]").first();
const box = await card.boundingBox();
if (box) {
  await page.mouse.move(box.x + 30, box.y + 15);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 60, { steps: 8 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${dir}board-drag.png` });
  const overlay = await page.evaluate(() => {
    const els = [...document.querySelectorAll("body *")].filter((e) => getComputedStyle(e).position === "fixed" && e.getBoundingClientRect().height > 40 && e.getBoundingClientRect().height < 300);
    return els.map((e) => Math.round(e.getBoundingClientRect().width));
  });
  console.log("card width", Math.round(box.width), "fixed elements while dragging", overlay);
  check(overlay.some((w) => Math.abs(w - box.width) <= 2), "drag overlay keeps the card width");
  await page.keyboard.press("Escape");
  await page.mouse.up();
}

await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(400);
const narrow = await columnWidths();
console.log("columns at 1280:", narrow);
check(narrow.every((w) => w >= 230), "columns keep their 230px minimum on narrow windows");
await page.screenshot({ path: `${dir}board-1280.png` });

await cleanupDemo(page, BASE);
await browser.close();
console.log("errors:", errors.length ? errors : "(none)");
