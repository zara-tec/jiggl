/**
 * Who may register on this installation. Settings live in the single
 * `Instance` row and are managed by the instance owner from Settings.
 */

export type RegistrationPolicy = "open" | "invited" | "domains";

export interface InstanceSettings {
  registration: RegistrationPolicy;
  /** Email domains allowed to register when the policy is "domains" (lowercase, no @) */
  domains: string[];
}

export const REGISTRATION_POLICIES: { id: RegistrationPolicy; name: string; description: string }[] = [
  { id: "open", name: "Open", description: "Anyone can create an account and a workspace" },
  { id: "invited", name: "Invited only", description: "Only people already invited to a workspace by email" },
  { id: "domains", name: "Invited, or allowed domains", description: "Invited people, plus any email of the listed domains" },
];

export const DEFAULT_INSTANCE: InstanceSettings = { registration: "open", domains: [] };

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 0 ? "" : email.slice(at + 1).trim().toLowerCase();
}

/** "Acme.com, @cliente.it ; foo" -> ["acme.com", "cliente.it", "foo"], unique, lowercase, no @ */
export function parseDomains(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const d = raw.trim().toLowerCase().replace(/^@+/, "").replace(/\/+$/, "");
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

export function isRegistrationPolicy(x: unknown): x is RegistrationPolicy {
  return x === "open" || x === "invited" || x === "domains";
}

/** Whether `email` may register; `invited` = a workspace member with that email is waiting to be linked */
export function registrationAllowed(settings: InstanceSettings, email: string, invited: boolean): { ok: true } | { ok: false; reason: string } {
  if (invited || settings.registration === "open") return { ok: true };
  if (settings.registration === "domains") {
    const domain = emailDomain(email);
    if (domain && settings.domains.some((d) => d === domain || domain.endsWith(`.${d}`))) return { ok: true };
    return { ok: false, reason: settings.domains.length ? `Registration is limited to ${settings.domains.map((d) => `@${d}`).join(", ")} addresses and invited people. Ask a workspace admin for an invitation.` : "Registration is by invitation only: ask a workspace admin to invite you." };
  }
  return { ok: false, reason: "Registration is by invitation only: ask a workspace admin to invite you." };
}

/** Sentence shown on the register page */
export function describeRegistration(settings: InstanceSettings): string | null {
  if (settings.registration === "open") return null;
  if (settings.registration === "domains" && settings.domains.length) return `Registration is open to ${settings.domains.map((d) => `@${d}`).join(", ")} addresses and to people invited by a workspace admin.`;
  return "Registration is by invitation only: use the email your workspace admin invited, or ask for a welcome password.";
}
