"use client";

import * as React from "react";
import { MIN_PASSWORD_LENGTH, postJson } from "@/lib/passwords";
import { Button } from "@/components/ui/Button";

/** Settings → Password: the logged-in person changes their own password */
export function ChangePasswordSection() {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);
  const mismatch = confirm.length > 0 && next !== confirm;
  const ready = current.length > 0 && next.length >= MIN_PASSWORD_LENGTH && next === confirm;

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await postJson("/api/auth/password", { currentPassword: current, newPassword: next });
      setMessage({ ok: true, text: "Password changed." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2 className="ds-heading-md mb-1">Password</h2>
      <p className="mb-3 text-sm text-ds-text-subtle">Choose a new password for your account. If you forget it, a workspace admin can set a new one from the Team page.</p>
      <form
        className="grid max-w-2xl grid-cols-3 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !busy) void submit();
        }}
      >
        <label className="block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Current password</span><input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="ds-input" /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">New password</span><input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className="ds-input" placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Repeat new password</span><input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="ds-input" aria-invalid={mismatch} /></label>
        <div className="col-span-3 flex items-center gap-3">
          <Button type="submit" appearance="primary" disabled={!ready || busy}>Change password</Button>
          {mismatch && <span className="text-sm text-ds-text-danger">The two passwords differ.</span>}
          {message && <span className={message.ok ? "text-sm text-ds-text-success" : "text-sm text-ds-text-danger"}>{message.text}</span>}
        </div>
      </form>
    </section>
  );
}
