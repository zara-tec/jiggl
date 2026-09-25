import { describe, expect, it } from "vitest";
import { EMPTY_MAIL_SETTINGS, MAIL_SECURITY, defaultPort, escapeHtml, invitationMail, isMailSecurity, parseMailSettings, passwordMail, testMail } from "./mail";

describe("mail settings", () => {
  it("security modes have a default port each", () => {
    expect(MAIL_SECURITY.map((s) => s.id)).toEqual(["tls", "starttls", "none"]);
    expect(defaultPort("tls")).toBe(465);
    expect(defaultPort("starttls")).toBe(587);
    expect(defaultPort("none")).toBe(25);
    expect(isMailSecurity("tls")).toBe(true);
    expect(isMailSecurity("ssl")).toBe(false);
    expect(EMPTY_MAIL_SETTINGS.port).toBe(defaultPort(EMPTY_MAIL_SETTINGS.security));
  });

  it("parseMailSettings trims, coerces and lowercases the sender", () => {
    const r = parseMailSettings({ host: " smtp.example.com ", port: "587", security: "starttls", user: " ada ", fromName: " Jiggl ", fromEmail: " NoReply@Example.com " });
    expect(r).toEqual({ ok: true, value: { host: "smtp.example.com", port: 587, security: "starttls", user: "ada", fromName: "Jiggl", fromEmail: "noreply@example.com" } });
  });

  it("parseMailSettings rejects what cannot work", () => {
    const base = { host: "smtp.example.com", port: 587, security: "starttls", user: "", fromName: "", fromEmail: "a@b.co" };
    expect(parseMailSettings({ ...base, host: "" })).toMatchObject({ ok: false, error: /host/ });
    expect(parseMailSettings({ ...base, host: "smtp://x" })).toMatchObject({ ok: false });
    expect(parseMailSettings({ ...base, port: 0 })).toMatchObject({ ok: false, error: /Port/ });
    expect(parseMailSettings({ ...base, port: 70000 })).toMatchObject({ ok: false, error: /Port/ });
    expect(parseMailSettings({ ...base, port: "abc" })).toMatchObject({ ok: false, error: /Port/ });
    expect(parseMailSettings({ ...base, security: "ssl" })).toMatchObject({ ok: false, error: /security/ });
    expect(parseMailSettings({ ...base, fromEmail: "nope" })).toMatchObject({ ok: false, error: /sender/ });
    expect(parseMailSettings(null)).toMatchObject({ ok: false });
    expect(parseMailSettings({ ...base })).toMatchObject({ ok: true });
  });
});

describe("mail messages", () => {
  const origin = "https://jiggl.example.com";

  it("invitation without a password points to registration", () => {
    const m = invitationMail({ workspace: "Acme", inviter: "Ada Lovelace", name: "Grace Hopper", email: "grace@acme.com", origin });
    expect(m.subject).toBe("Ada Lovelace invited you to Acme");
    expect(m.text).toContain("Hi Grace Hopper,");
    expect(m.text).toContain(`${origin}/register`);
    expect(m.text).not.toContain("Password:");
    expect(m.html).toContain(`href="${origin}/register"`);
    expect(m.html).not.toContain("/login");
  });

  it("invitation with a welcome password carries the credentials and the sign-in link", () => {
    const m = invitationMail({ workspace: "Acme", inviter: "Ada", name: "Grace", email: "grace@acme.com", origin, password: "abcd-efgh-jkmn" });
    expect(m.text).toContain("Email: grace@acme.com");
    expect(m.text).toContain("Password: abcd-efgh-jkmn");
    expect(m.text).toContain(`${origin}/login`);
    expect(m.html).toContain("abcd-efgh-jkmn");
    expect(m.html).toContain(`href="${origin}/login"`);
  });

  it("invitation of someone who already has an account sends them to sign in", () => {
    const m = invitationMail({ workspace: "Acme", inviter: "Ada", name: "Grace", email: "grace@acme.com", origin, existing: true });
    expect(m.text).toContain("already have a Jiggl account");
    expect(m.text).toContain(`${origin}/login`);
    expect(m.text).not.toContain("/register");
    expect(m.text).not.toContain("Password:");
  });

  it("password message tells whether the account is new", () => {
    const created = passwordMail({ workspace: "Acme", admin: "Ada", name: "Grace", email: "grace@acme.com", origin, password: "p4ss-w0rd-abcd", created: true });
    expect(created.subject).toBe("Your account on Acme");
    expect(created.text).toContain("created your account");
    const reset = passwordMail({ workspace: "Acme", admin: "Ada", name: "Grace", email: "grace@acme.com", origin, password: "p4ss-w0rd-abcd", created: false });
    expect(reset.subject).toBe("Your password on Acme was reset");
    expect(reset.text).toContain("reset your password");
    expect(reset.text).toContain("Password: p4ss-w0rd-abcd");
  });

  it("html escapes what people typed, text keeps it verbatim", () => {
    const m = invitationMail({ workspace: "R&D <lab>", inviter: "O'Brien", name: "X", email: "x@y.z", origin });
    expect(m.html).toContain("R&amp;D &lt;lab&gt;");
    expect(m.html).toContain("O&#39;Brien");
    expect(m.html).not.toContain("<lab>");
    expect(m.text).toContain('"R&D <lab>"');
    expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });

  it("test message names the workspace and links the app", () => {
    const m = testMail({ workspace: "Acme", origin });
    expect(m.subject).toBe("Test email from Acme");
    expect(m.text).toContain(`Open Jiggl: ${origin}`);
    expect(m.html).toContain("<!doctype html>");
  });
});
