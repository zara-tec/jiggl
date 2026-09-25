import nodemailer from "nodemailer";
import { prisma } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";
import { isMailSecurity, type MailMessage, type MailOutcome, type MailSettings, type MailSettingsView } from "@/lib/mail";

/** Stored settings of a workspace; the password stays encrypted until a message is sent */
export interface MailConfig extends MailSettings {
  encryptedPassword: string;
}

export async function getMailConfig(workspaceId: string): Promise<MailConfig | null> {
  const row = await prisma.workspaceMail.findUnique({ where: { workspaceId } });
  if (!row) return null;
  return { host: row.host, port: row.port, security: isMailSecurity(row.security) ? row.security : "starttls", user: row.user, encryptedPassword: row.password, fromName: row.fromName, fromEmail: row.fromEmail };
}

export function mailView(config: MailConfig): MailSettingsView {
  const { encryptedPassword, ...settings } = config;
  return { ...settings, hasPassword: encryptedPassword.length > 0 };
}

/** Upsert. `password` undefined keeps the stored one, "" clears it. */
export async function saveMailConfig(workspaceId: string, settings: MailSettings, password: string | undefined) {
  const stored = password === undefined ? undefined : password ? encryptSecret(password) : "";
  await prisma.workspaceMail.upsert({
    where: { workspaceId },
    create: { workspaceId, ...settings, password: stored ?? "" },
    update: { ...settings, ...(stored === undefined ? {} : { password: stored }) },
  });
}

export async function deleteMailConfig(workspaceId: string) {
  await prisma.workspaceMail.deleteMany({ where: { workspaceId } });
}

function transport(config: MailConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.security === "tls",
    requireTLS: config.security === "starttls",
    ignoreTLS: config.security === "none",
    auth: config.user ? { user: config.user, pass: config.encryptedPassword ? decryptSecret(config.encryptedPassword) : "" } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
}

/** Sends one message; throws with the SMTP error */
export async function deliver(config: MailConfig, workspaceName: string, to: { name: string; email: string }, message: MailMessage) {
  await transport(config).sendMail({
    from: { name: config.fromName || workspaceName, address: config.fromEmail },
    to: { name: to.name, address: to.email },
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

/** Best effort: undefined when the workspace has no outgoing mail, otherwise whether the message left */
export async function trySend(workspaceId: string, workspaceName: string, to: { name: string; email: string }, message: MailMessage): Promise<MailOutcome | undefined> {
  try {
    const config = await getMailConfig(workspaceId);
    if (!config) return undefined;
    await deliver(config, workspaceName, to, message);
    return { sent: true };
  } catch (e) {
    return { sent: false, error: describeError(e) };
  }
}

/** One line, short enough for a message in the UI */
export function describeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/\s+/g, " ").trim().slice(0, 200) || "Unknown error";
}
