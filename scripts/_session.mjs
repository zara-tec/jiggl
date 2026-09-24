/**
 * Shared by the verification scripts: registers a throw-away account with the
 * demo dataset so every run works on a fresh, isolated workspace. The session
 * cookie lands in the browser context through page.request.
 */
export async function loginDemo(page, base) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@jiggl.test`;
  const res = await page.request.post(base + "/api/auth/register", {
    data: { name: "E2E Tester", email, password: "correct-horse-battery", workspaceName: "E2E workspace", demo: true },
  });
  if (!res.ok()) throw new Error(`register failed: ${res.status()} ${await res.text()}`);
  return email;
}

/** Remove the throw-away account and its workspace so the database stays clean. */
export async function cleanupDemo(page, base) {
  try {
    const res = await page.request.post(base + "/api/auth/delete-account");
    if (!res.ok()) console.warn("cleanup failed:", res.status());
  } catch (e) {
    console.warn("cleanup failed:", String(e));
  }
}
