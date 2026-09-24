import { test as base, type BrowserContext } from "@playwright/test";

export { expect } from "@playwright/test";

export interface DemoAccount {
  email: string;
  password: string;
  /** Cookies of the registered session, applied to every page of the worker */
  storageState: Awaited<ReturnType<BrowserContext["storageState"]>>;
}

/**
 * One throw-away account per worker, registered through the API with the demo
 * dataset (same pattern as scripts/_session.mjs). Addresses matching
 * `e2e-*@jiggl.test` can delete themselves without a password, which keeps the
 * database clean when the worker ends.
 */
export const test = base.extend<Record<never, never>, { account: DemoAccount }>({
  account: [
    async ({ browser }, provide, workerInfo) => {
      const context = await browser.newContext({ baseURL: workerInfo.project.use.baseURL });
      const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@jiggl.test`;
      const password = "correct-horse-battery";
      const res = await context.request.post("/api/auth/register", {
        data: { name: "E2E Tester", email, password, workspaceName: "E2E workspace", demo: true },
      });
      if (!res.ok()) throw new Error(`register failed: ${res.status()} ${await res.text()}`);
      const storageState = await context.storageState();
      await provide({ email, password, storageState });
      const cleanup = await context.request.post("/api/auth/delete-account");
      if (!cleanup.ok()) console.warn(`cleanup failed: ${cleanup.status()} ${await cleanup.text()}`);
      await context.close();
    },
    { scope: "worker" },
  ],
  // Every page starts logged in as the worker's account.
  storageState: async ({ account }, provide) => {
    await provide(account.storageState);
  },
});
