import { chromium } from "playwright";
import { loginDemo, cleanupDemo } from "./_session.mjs";

/**
 * Forecast matrix and baselines of an order, plus the budget forecast card.
 * BASE=http://localhost:3000 node scripts/verify-forecast.mjs   (THEME=dark for the dark theme)
 */
const base = process.env.BASE || "http://localhost:3210";
const dir = `.screenshots/${process.env.THEME === "dark" ? "dark/" : ""}`;
const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
if (process.env.THEME) await ctx.addInitScript((t) => localStorage.setItem("jiggl-theme", t), process.env.THEME);
const page = await ctx.newPage();
await loginDemo(page, base);
const errs = [];
page.on("pageerror", (e) => errs.push("[pageerror] " + String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errs.push("[console] " + m.text().slice(0, 200)); });
const shot = (n) => page.screenshot({ path: `${dir}${n}.png`, fullPage: true });
const go = async (r) => { await page.goto(base + r, { waitUntil: "networkidle" }); await page.waitForTimeout(500); };
const main = page.locator("main");

await go("/projects/JIG/offers/o_jig_1");
await main.getByRole("tab", { name: "Forecast" }).click();
await page.waitForTimeout(300);
await shot("offer_forecast");
console.log("forecast summary:", (await main.innerText()).match(/Forecast \d+h vs \d+h sold[^\n]*/)?.[0]);

// days, then add a member column and type an effort
await main.getByRole("button", { name: /^Unit/ }).click();
await page.getByRole("option", { name: /Days/ }).click();
await page.waitForTimeout(200);
await shot("offer_forecast_days");
await main.getByRole("button", { name: /Add member/ }).click();
await page.getByRole("option", { name: /Elena/ }).click();
await page.waitForTimeout(200);
const cell = main.getByLabel("Elena Russo on Workshop");
await cell.fill("0.5");
await cell.press("Enter");
await page.waitForTimeout(300);
console.log("after Elena 0.5d on Workshop:", (await main.innerText()).match(/Forecast [\d.]+d vs [\d.]+d sold[^\n]*/)?.[0]);

await main.getByRole("tab", { name: "Baselines" }).click();
await page.waitForTimeout(300);
await shot("offer_baselines");
console.log("baseline compare heading:", (await main.innerText()).match(/Since “[^”]+”/)?.[0]);
await main.locator("h3", { hasText: "Since" }).locator("xpath=..").screenshot({ path: `${dir}offer_baselines_compare.png` });
await main.getByRole("button", { name: "Take baseline" }).click();
await page.waitForTimeout(200);
await shot("offer_baseline_modal");
await page.getByRole("dialog").getByRole("button", { name: "Take baseline" }).click();
await page.waitForTimeout(400);
await shot("offer_baselines_after");
console.log("baselines listed:", (await main.locator("tbody tr").count()));

await go("/projects/JIG/budget");
await shot("budget_forecast");
console.log("budget has forecast card:", (await main.innerText()).includes("Forecast at completion"));
await go("/projects/DATA/offers/o_data_1");
await main.getByRole("tab", { name: "Forecast" }).click();
await page.waitForTimeout(300);
await shot("offer_forecast_draft");
await go("/projects/JIG/offers");
await shot("projects_JIG_offers");

// lines table: compact rows, Details hidden by default, dependency between the two lines
await go("/projects/JIG/offers/o_jig_2");
await shot("offer_lines");
console.log("lines after column:", (await main.locator("tbody tr").nth(1).innerText()).replace(/\s+/g, " ").slice(0, 160));
await main.getByRole("button", { name: /^Columns/ }).click();
await page.getByRole("button", { name: /^Details/ }).click();
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
await shot("offer_lines_details");

await cleanupDemo(page, base);
await b.close();
console.log("errors:", errs.length ? "\n" + [...new Set(errs)].join("\n") : "(none)");
