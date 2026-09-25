import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3210);
const baseURL = process.env.BASE ?? `http://localhost:${port}`;
const ci = !!process.env.CI;

/**
 * End-to-end tests (see e2e/). They need the database from .env: every worker
 * registers a throw-away account with the demo dataset and deletes it at the
 * end. Locally the config starts `next dev` on its own port (set BASE to reuse
 * a running server); in CI it serves the production build.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : undefined,
  reporter: ci ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    // an action on an element that never becomes ready must fail, not hang the test
    actionTimeout: 15_000,
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: process.env.BASE
    ? undefined
    : {
        command: ci ? `npx next start -p ${port}` : `npx next dev -p ${port}`,
        url: `${baseURL}/login`,
        reuseExistingServer: !ci,
        timeout: 180_000,
      },
});
