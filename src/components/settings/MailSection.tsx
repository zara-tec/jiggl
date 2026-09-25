"use client";

import * as React from "react";
import { useStore } from "@/lib/store";
import { useCurrentUser } from "@/hooks/useData";
import { EMAIL_RE, EMPTY_MAIL_SETTINGS, MAIL_SECURITY, defaultPort, type MailSecurity, type MailSettings, type MailSettingsView } from "@/lib/mail";
import { postJson } from "@/lib/passwords";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Lozenge } from "@/components/ui/Lozenge";

interface MailInfo {
  configured: boolean;
  settings: MailSettingsView | null;
}

const SECURITY_OPTIONS = MAIL_SECURITY.map((s) => ({ value: s.id, label: s.name, description: s.description }));

function stripView(v: MailSettingsView): MailSettings {
  return { host: v.host, port: v.port, security: v.security, user: v.user, fromName: v.fromName, fromEmail: v.fromEmail };
}

function sameSettings(a: MailSettings, b: MailSettings) {
  return a.host === b.host && a.port === b.port && a.security === b.security && a.user === b.user && a.fromName === b.fromName && a.fromEmail === b.fromEmail;
}

/** Settings → Outgoing email: the SMTP server of this workspace, workspace admins only */
export function MailSection() {
  const me = useCurrentUser();
  const workspaceName = useStore((s) => s.settings.name);
  const isAdmin = me?.role === "admin";
  const [info, setInfo] = React.useState<MailInfo | null>(null);
  const [form, setForm] = React.useState<MailSettings>(EMPTY_MAIL_SETTINGS);
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState<"save" | "test" | "remove" | null>(null);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  const apply = React.useCallback((j: MailInfo) => {
    setInfo(j);
    setForm(j.settings ? stripView(j.settings) : EMPTY_MAIL_SETTINGS);
    setPassword("");
  }, []);

  React.useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    fetch("/api/workspace/mail", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: MailInfo | null) => {
        if (!cancelled && j) apply(j);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isAdmin, apply]);

  if (!isAdmin || !info) return null;

  const stored = info.settings ? stripView(info.settings) : null;
  const hasPassword = !!info.settings?.hasPassword;
  const dirty = password !== "" || !stored || !sameSettings(form, stored);
  const portOk = Number.isInteger(form.port) && form.port >= 1 && form.port <= 65535;
  const valid = form.host.trim() !== "" && portOk && EMAIL_RE.test(form.fromEmail.trim()) && (!form.user.trim() || password !== "" || hasPassword);
  const set = (patch: Partial<MailSettings>) => setForm((f) => ({ ...f, ...patch }));
  // switching security moves the port along, unless it was set by hand
  const setSecurity = (security: MailSecurity) => setForm((f) => ({ ...f, security, port: f.port === defaultPort(f.security) ? defaultPort(security) : f.port }));

  const run = async (kind: "save" | "test" | "remove", fn: () => Promise<void>) => {
    setBusy(kind);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };
  const save = () =>
    run("save", async () => {
      apply(await postJson<MailInfo>("/api/workspace/mail", { ...form, password: password || undefined }));
      setMessage({ ok: true, text: "Saved. Send a test email to check it." });
    });
  const test = () =>
    run("test", async () => {
      const res = await postJson<{ to: string }>("/api/workspace/mail/test", {});
      setMessage({ ok: true, text: `Test email sent to ${res.to}.` });
    });
  const remove = () =>
    run("remove", async () => {
      if (!confirm("Remove the outgoing email settings? Invitations will no longer be emailed.")) return;
      apply(await postJson<MailInfo>("/api/workspace/mail", { remove: true }));
      setMessage({ ok: true, text: "Removed. Invitations and passwords are shared by hand again." });
    });

  const label = "mb-1 block text-xs font-semibold text-ds-text-subtle";
  return (
    <section>
      <h2 className="ds-heading-md mb-1 flex items-center gap-2">
        Outgoing email <Lozenge appearance={info.configured ? "success" : "default"}>{info.configured ? "Configured" : "Not configured"}</Lozenge>
      </h2>
      <p className="mb-3 text-sm text-ds-text-subtle">
        Invitations and passwords issued from the Team page are emailed through this SMTP server; without it, admins pass them on themselves. The settings belong to this workspace and the password is stored encrypted, never shown again.
      </p>
      <div className="grid grid-cols-3 gap-4">
        <label className="block"><span className={label}>Host</span><input value={form.host} onChange={(e) => set({ host: e.target.value })} className="ds-input" placeholder="smtp.example.com" /></label>
        <label className="block"><span className={label}>Port</span><input type="number" min={1} max={65535} value={form.port} onChange={(e) => set({ port: Number(e.target.value) })} className="ds-input" /></label>
        <label className="block"><span className={label}>Security</span><Select value={form.security} onChange={(v) => v && setSecurity(v as MailSecurity)} searchable={false} options={SECURITY_OPTIONS} menuClassName="w-80" /></label>
        <label className="block"><span className={label}>Username</span><input value={form.user} onChange={(e) => set({ user: e.target.value })} className="ds-input" autoComplete="off" placeholder="Empty for no authentication" /></label>
        <label className="block"><span className={label}>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="ds-input" autoComplete="new-password" placeholder={hasPassword ? "Unchanged" : ""} /></label>
        <div />
        <label className="block"><span className={label}>Sender name</span><input value={form.fromName} onChange={(e) => set({ fromName: e.target.value })} className="ds-input" placeholder={workspaceName} /></label>
        <label className="col-span-2 block"><span className={label}>Sender email</span><input type="email" value={form.fromEmail} onChange={(e) => set({ fromEmail: e.target.value })} className="ds-input" placeholder="noreply@example.com" /></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button appearance="primary" disabled={!dirty || !valid || !!busy} onClick={() => void save()}>
          {busy === "save" ? "Saving…" : "Save"}
        </Button>
        <Button appearance="default" disabled={!info.configured || dirty || !!busy} onClick={() => void test()}>
          {busy === "test" ? "Sending…" : "Send test email"}
        </Button>
        {info.configured && (
          <Button appearance="subtle" disabled={!!busy} onClick={() => void remove()}>
            Remove
          </Button>
        )}
        {message ? <span className={message.ok ? "text-sm text-ds-text-success" : "text-sm text-ds-text-danger"}>{message.text}</span> : <span className="text-xs text-ds-text-subtlest">Test messages go to {me.email}.</span>}
      </div>
    </section>
  );
}
