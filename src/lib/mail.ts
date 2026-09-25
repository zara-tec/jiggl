/**
 * Outgoing mail of a workspace: the settings shape shared by Settings and the
 * server, and the messages Jiggl sends (invitations, issued passwords, the
 * test message). Delivery itself lives in src/server/mail.ts.
 */

export type MailSecurity = "tls" | "starttls" | "none";

export const MAIL_SECURITY: { id: MailSecurity; name: string; description: string; port: number }[] = [
  { id: "tls", name: "TLS", description: "Encrypted from the first byte, usually port 465", port: 465 },
  { id: "starttls", name: "STARTTLS", description: "Upgrades the connection, usually port 587", port: 587 },
  { id: "none", name: "None", description: "Plain connection: only for a relay on the same network", port: 25 },
];

export function isMailSecurity(x: unknown): x is MailSecurity {
  return x === "tls" || x === "starttls" || x === "none";
}

export function defaultPort(security: MailSecurity): number {
  return MAIL_SECURITY.find((s) => s.id === security)?.port ?? 587;
}

export interface MailSettings {
  host: string;
  port: number;
  security: MailSecurity;
  /** SMTP login; empty for a relay without authentication */
  user: string;
  /** Sender shown to the recipient; the workspace name when empty */
  fromName: string;
  fromEmail: string;
}

/** What the client sees: never the password, only whether one is stored */
export interface MailSettingsView extends MailSettings {
  hasPassword: boolean;
}

/** Whether a message left, reported by the routes that email invitations and passwords */
export interface MailOutcome {
  sent: boolean;
  error?: string;
}

export const EMPTY_MAIL_SETTINGS: MailSettings = { host: "", port: 587, security: "starttls", user: "", fromName: "", fromEmail: "" };

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates what Settings sends: trims strings, coerces the port, lowercases the sender */
export function parseMailSettings(input: unknown): { ok: true; value: MailSettings } | { ok: false; error: string } {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const host = str(o.host);
  if (!host || /[\s/]/.test(host)) return { ok: false, error: "Enter the SMTP host" };
  const port = Number(o.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, error: "Port must be between 1 and 65535" };
  if (!isMailSecurity(o.security)) return { ok: false, error: "Unknown security mode" };
  const fromEmail = str(o.fromEmail).toLowerCase();
  if (!EMAIL_RE.test(fromEmail)) return { ok: false, error: "Enter a valid sender email" };
  return { ok: true, value: { host, port, security: o.security, user: str(o.user), fromName: str(o.fromName), fromEmail } };
}

/* ---------- messages ---------- */

export interface MailMessage {
  subject: string;
  text: string;
  html: string;
}

/** Content model rendered once as plain text and once as HTML, so the two parts never drift */
type Block = { kind: "p"; text: string } | { kind: "link"; label: string; url: string } | { kind: "fields"; rows: [string, string][] };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

// Email clients do not support CSS variables, so the few colours here are literal.
function render(subject: string, blocks: Block[]): MailMessage {
  const text =
    blocks
      .map((b) => {
        if (b.kind === "p") return b.text;
        if (b.kind === "link") return `${b.label}: ${b.url}`;
        return b.rows.map(([k, v]) => `${k}: ${v}`).join("\n");
      })
      .join("\n\n") + "\n";
  const body = blocks
    .map((b) => {
      if (b.kind === "p") return `<p style="margin:0 0 16px">${escapeHtml(b.text)}</p>`;
      if (b.kind === "link") return `<p style="margin:0 0 16px"><a href="${escapeHtml(b.url)}" style="display:inline-block;padding:8px 14px;border-radius:3px;background:#0c66e4;color:#ffffff;text-decoration:none;font-weight:600">${escapeHtml(b.label)}</a></p>`;
      const rows = b.rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#626f86">${escapeHtml(k)}</td><td style="padding:4px 0;font-family:ui-monospace,Menlo,Consolas,monospace">${escapeHtml(v)}</td></tr>`).join("");
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse">${rows}</table>`;
    })
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f7f8f9"><div style="max-width:520px;margin:0 auto;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:20px;color:#172b4d">${body}</div></body></html>`;
  return { subject, text, html };
}

/**
 * Three situations: a welcome password was just issued (credentials inside),
 * the person already had an account with this email (it is linked, they just
 * sign in), or they still have to register.
 */
export function invitationMail(a: { workspace: string; inviter: string; name: string; email: string; origin: string; password?: string; existing?: boolean }): MailMessage {
  const blocks: Block[] = [
    { kind: "p", text: `Hi ${a.name},` },
    { kind: "p", text: `${a.inviter} invited you to the workspace "${a.workspace}" on Jiggl.` },
  ];
  if (a.password) {
    blocks.push({ kind: "p", text: "An account is ready for you. Sign in with these credentials, then change the password from Settings:" });
    blocks.push({ kind: "fields", rows: [["Email", a.email], ["Password", a.password]] });
    blocks.push({ kind: "link", label: "Sign in", url: `${a.origin}/login` });
  } else if (a.existing) {
    blocks.push({ kind: "p", text: `You already have a Jiggl account with this email (${a.email}): sign in and pick the workspace from the profile menu.` });
    blocks.push({ kind: "link", label: "Sign in", url: `${a.origin}/login` });
  } else {
    blocks.push({ kind: "p", text: `Create your account with this email address (${a.email}) and you will land in the workspace.` });
    blocks.push({ kind: "link", label: "Create your account", url: `${a.origin}/register` });
  }
  return render(`${a.inviter} invited you to ${a.workspace}`, blocks);
}

export function passwordMail(a: { workspace: string; admin: string; name: string; email: string; origin: string; password: string; created: boolean }): MailMessage {
  const blocks: Block[] = [
    { kind: "p", text: `Hi ${a.name},` },
    { kind: "p", text: a.created ? `${a.admin} created your account for the workspace "${a.workspace}" on Jiggl.` : `${a.admin} reset your password for the workspace "${a.workspace}" on Jiggl.` },
    { kind: "p", text: "Sign in with these credentials, then change the password from Settings:" },
    { kind: "fields", rows: [["Email", a.email], ["Password", a.password]] },
    { kind: "link", label: "Sign in", url: `${a.origin}/login` },
  ];
  return render(a.created ? `Your account on ${a.workspace}` : `Your password on ${a.workspace} was reset`, blocks);
}

export function testMail(a: { workspace: string; origin: string }): MailMessage {
  return render(`Test email from ${a.workspace}`, [
    { kind: "p", text: `Outgoing email of the workspace "${a.workspace}" works: this message went through the SMTP server set in Settings.` },
    { kind: "link", label: "Open Jiggl", url: a.origin },
  ]);
}
