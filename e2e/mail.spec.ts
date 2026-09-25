import net from "node:net";
import { expect, test } from "./fixtures";

interface Received {
  auth?: { user: string; pass: string };
  from: string;
  to: string[];
  data: string;
}

/**
 * A minimal SMTP server on a random local port: just enough of the protocol
 * for the app to hand over a message (EHLO, AUTH PLAIN, MAIL, RCPT, DATA,
 * QUIT). The app under test runs on this machine, so it reaches 127.0.0.1.
 */
function startSmtp() {
  const messages: Received[] = [];
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => undefined);
    let buffer = "";
    let inData = false;
    let auth: Received["auth"];
    let current: Received = { from: "", to: [], data: "" };
    const reply = (s: string) => socket.write(`${s}\r\n`);
    const address = (line: string) => /<([^>]*)>/.exec(line)?.[1] ?? line;
    reply("220 e2e.smtp ESMTP");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let i: number;
      while ((i = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            messages.push({ ...current, auth });
            current = { from: "", to: [], data: "" };
            reply("250 OK queued");
          } else current.data += `${line.startsWith(".") ? line.slice(1) : line}\r\n`;
          continue;
        }
        const [cmd, ...rest] = line.split(" ");
        switch (cmd.toUpperCase()) {
          case "EHLO":
            socket.write("250-e2e.smtp\r\n250 AUTH PLAIN\r\n");
            break;
          case "HELO":
            reply("250 e2e.smtp");
            break;
          case "AUTH": {
            const [user, pass] = Buffer.from(rest[1] ?? "", "base64").toString("utf8").split("\0").slice(1);
            auth = { user, pass };
            reply("235 Authentication successful");
            break;
          }
          case "MAIL":
            current.from = address(line);
            reply("250 OK");
            break;
          case "RCPT":
            current.to.push(address(line));
            reply("250 OK");
            break;
          case "DATA":
            inData = true;
            reply("354 End data with <CR><LF>.<CR><LF>");
            break;
          case "QUIT":
            reply("221 Bye");
            socket.end();
            break;
          default:
            reply("250 OK");
        }
      }
    });
  });
  return new Promise<{ port: number; messages: Received[]; close: () => Promise<void> }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as net.AddressInfo).port;
      const close = () =>
        new Promise<void>((done) => {
          for (const s of sockets) s.destroy();
          server.close(() => done());
        });
      resolve({ port, messages, close });
    });
  });
}

test.describe("outgoing email", () => {
  let smtp: Awaited<ReturnType<typeof startSmtp>>;
  test.beforeAll(async () => {
    smtp = await startSmtp();
  });
  test.afterAll(async () => {
    await smtp?.close();
  });

  test("an admin sets up SMTP in Settings, tests it, and invitations go out with the welcome password", async ({ page, account, baseURL }) => {
    await page.goto("/settings");
    const section = page.locator("section", { hasText: "Outgoing email" });
    await expect(section).toContainText("Not configured");
    await section.getByLabel("Host").fill("127.0.0.1");
    await section.getByLabel("Port").fill(String(smtp.port));
    // the Select trigger is a button inside the "Security" label, so that is its accessible name
    const security = section.locator("label", { hasText: "Security" }).getByRole("button");
    await expect(security).toHaveText(/STARTTLS/);
    await security.click();
    await page.getByRole("option", { name: /None/ }).click();
    await expect(security).toHaveText(/None/);
    await section.getByLabel("Username").fill("relay-user");
    await section.getByLabel("Password", { exact: true }).fill("relay-s3cret");
    await section.getByLabel("Sender name").fill("Jiggl E2E");
    await section.getByLabel("Sender email").fill("noreply@jiggl.test");
    await section.getByRole("button", { name: "Save" }).click();
    await expect(section).toContainText("Saved.");
    await expect(section).toContainText("Configured");

    // the password is stored but never comes back
    const info = await (await page.request.get("/api/workspace/mail")).json();
    expect(info.configured).toBe(true);
    expect(info.settings).toMatchObject({ host: "127.0.0.1", port: smtp.port, security: "none", user: "relay-user", hasPassword: true, fromName: "Jiggl E2E", fromEmail: "noreply@jiggl.test" });
    expect(JSON.stringify(info)).not.toContain("relay-s3cret");

    // the test message reaches the admin through the configured server, with the stored credentials
    await section.getByRole("button", { name: "Send test email" }).click();
    await expect(section).toContainText(`Test email sent to ${account.email}`);
    expect(smtp.messages).toHaveLength(1);
    const probe = smtp.messages[0];
    expect(probe.auth).toEqual({ user: "relay-user", pass: "relay-s3cret" });
    expect(probe.from).toBe("noreply@jiggl.test");
    expect(probe.to).toEqual([account.email]);
    expect(probe.data).toContain("Subject: Test email from E2E workspace");

    // an invitation with a welcome password is emailed with the credentials and the sign-in link
    const email = `e2e-mailed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@jiggl.test`;
    await page.goto("/team");
    await page.getByRole("button", { name: "Invite member" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("The invitation is emailed to this address");
    await dialog.getByLabel("Name", { exact: true }).fill("Mailed Person");
    await dialog.getByLabel("Email", { exact: true }).fill(email);
    await dialog.getByRole("button", { name: "Generate" }).click();
    const welcome = await dialog.locator("input.font-mono").inputValue();
    await dialog.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(dialog).toContainText("Mailed Person can sign in now");
    await expect(dialog).toContainText(`Emailed to ${email}`);
    await dialog.getByRole("button", { name: "Done" }).click();
    expect(smtp.messages).toHaveLength(2);
    const invitation = smtp.messages[1];
    expect(invitation.to).toEqual([email]);
    const body = invitation.data.replace(/=\r\n/g, "");
    expect(body).toContain("Subject: E2E Tester invited you to E2E workspace");
    expect(body).toContain(`Password: ${welcome}`);
    expect(body).toContain(`${baseURL}/login`);

    // the emailed password works; the invited account then deletes itself (test addresses need no password)
    const ctx = await page.context().browser()!.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    try {
      const login = await ctx.request.post("/api/auth/login", { data: { email, password: welcome } });
      expect(login.ok()).toBe(true);
      const cleanup = await ctx.request.post("/api/auth/delete-account");
      expect(cleanup.ok()).toBe(true);
    } finally {
      await ctx.close();
    }

    // removing the settings puts invitations back in the admin's hands
    await page.goto("/settings");
    page.once("dialog", (d) => void d.accept());
    await section.getByRole("button", { name: "Remove" }).click();
    await expect(section).toContainText("Not configured");
    await expect(section).toContainText("Removed.");
  });
});
