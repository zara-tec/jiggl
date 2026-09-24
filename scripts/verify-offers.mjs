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
const shot = (n) => page.screenshot({ path: `.screenshots/${n}.png` });
const go = async (r) => { await page.goto(base + r, { waitUntil: "networkidle" }); await page.waitForTimeout(500); };

await go("/offers"); await shot("offers");
await go("/projects/JIG/offers"); await shot("projects_JIG_offers");
await go("/projects/JIG/offers/o_jig_1"); await shot("offer_order");
await go("/projects/JIG/timeline"); await shot("projects_JIG_timeline");
await go("/clients/c_acme"); await shot("client_acme");

// Draft offer: add a line, then accept and convert
await go("/projects/DATA/offers/o_data_1");
await shot("offer_draft");
const rowsBefore = await page.locator("tbody tr").count();
await page.getByRole("button", { name: "Add line" }).click();
await page.waitForTimeout(300);
const rowsAfter = await page.locator("tbody tr").count();
console.log("add line:", rowsBefore, "->", rowsAfter);
// fill the new line description
const lastDesc = page.locator("tbody tr").last().getByPlaceholder("Line description");
await lastDesc.fill("E2E extra line");
await lastDesc.press("Enter");
await page.waitForTimeout(200);
// status: Draft -> Accepted
await page.locator("main").getByRole("button", { name: /^Draft/ }).click();
await page.getByRole("option", { name: /Accepted/ }).click();
await page.waitForTimeout(300);
await shot("offer_accepted");
await page.getByRole("button", { name: "Convert to order" }).click();
await page.waitForTimeout(400);
await shot("offer_convert_modal");
await page.getByRole("button", { name: /Create \d+ work items?/ }).click();
await page.waitForTimeout(500);
await shot("offer_converted");
console.log("converted dialog:", (await page.locator("[role=dialog]").innerText()).split("\n").slice(0, 3).join(" | "));
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
console.log("offer status now:", (await page.locator("main").innerText()).includes("This offer is an order"));

await go("/projects/DATA/list");
const listText = await page.locator("main").innerText();
console.log("DATA list has DATA-O1 items:", (listText.match(/DATA-O1/g) || []).length, "| prospect lozenge gone:", !listText.includes("PROSPECT"));
await shot("projects_DATA_list");
await go("/projects/DATA/timeline"); await shot("projects_DATA_timeline");
await go("/browse/DATA-1"); await shot("browse_DATA-1");
await go("/projects"); await shot("projects");
await cleanupDemo(page, process.env.BASE || "http://localhost:3210");
await b.close();
console.log("errors:", errs.length ? "\n" + [...new Set(errs)].join("\n") : "(none)");
