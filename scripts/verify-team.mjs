import { chromium } from "playwright";
import { loginDemo, cleanupDemo } from "./_session.mjs";

/**
 * Team page (invite with welcome password, reset), project team settings,
 * holidays and closures, and the password section of Settings.
 * BASE=http://localhost:3000 node scripts/verify-team.mjs   (THEME=dark for the dark theme)
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
const shot = (n) => page.screenshot({ path: `${dir}${n}.png` });
const go = async (r) => { await page.goto(base + r, { waitUntil: "networkidle" }); await page.waitForTimeout(500); };
const main = page.locator("main");

await go("/team");
await shot("team");
await page.getByRole("button", { name: "Invite member" }).click();
const dialog = page.getByRole("dialog");
await dialog.getByLabel("Name", { exact: true }).fill("Nadia Esposito");
await dialog.getByLabel("Email", { exact: true }).fill(`e2e-nadia-${Date.now()}@jiggl.test`);
await dialog.getByRole("button", { name: "Generate" }).click();
await shot("team_invite");
await dialog.getByRole("button", { name: "Invite", exact: true }).click();
await page.waitForTimeout(500);
await shot("team_invite_credentials");
console.log("invite result:", (await dialog.innerText()).split("\n")[0]);
await dialog.getByRole("button", { name: "Done" }).click();
await page.waitForTimeout(300);
const row = main.locator("tr", { hasText: "Nadia Esposito" });
await row.getByRole("button", { name: "Actions for Nadia Esposito" }).click();
await page.getByRole("button", { name: /Reset password/ }).click();
await page.getByRole("dialog").getByRole("button", { name: "Generate" }).click();
await shot("team_reset_password");
await page.keyboard.press("Escape");

await go("/projects/MOB/settings");
await shot("project_settings_team");
console.log("MOB team chips:", await main.getByTestId("team-member").count());
await go("/projects/MOB/offers/o_mob_1");
await main.getByRole("tab", { name: "Forecast" }).click();
const addMember = main.getByRole("button", { name: /^Add member/ });
if (await addMember.isDisabled()) console.log("forecast add-member: disabled, the whole team is already planned");
else {
  await addMember.click();
  console.log("forecast add-member options (team only):", (await page.getByRole("option").allInnerTexts()).map((t) => t.split("\n")[0]).join(", "));
  await page.keyboard.press("Escape");
}

await go("/settings");
await page.locator("h2", { hasText: "Working days" }).scrollIntoViewIfNeeded();
await shot("settings_holidays");
await page.locator("section", { hasText: "Working days" }).screenshot({ path: `${dir}settings_holidays_section.png` });
await page.locator("section", { hasText: "Current password" }).screenshot({ path: `${dir}settings_password_section.png` });

await cleanupDemo(page, base);
await b.close();
console.log("errors:", errs.length ? "\n" + [...new Set(errs)].join("\n") : "(none)");
