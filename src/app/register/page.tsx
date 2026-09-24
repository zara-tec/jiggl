"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/misc";
import { AuthCard, AuthField } from "@/components/layout/AuthCard";

export default function RegisterPage() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [demo, setDemo] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password, workspaceName, demo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Sign up failed");
      window.location.assign(window.location.origin + "/for-you");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Sign up to continue"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-ds-link hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit}>
        <AuthField label="Full name">
          <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} className="ds-input" />
        </AuthField>
        <AuthField label="Email">
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="ds-input" placeholder="you@company.com" />
        </AuthField>
        <AuthField label="Password">
          <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="ds-input" />
        </AuthField>
        <AuthField label="Workspace name">
          <input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} className="ds-input" placeholder="e.g. Acme Inc." />
        </AuthField>
        <Checkbox checked={demo} onChange={setDemo} label="Load the demo dataset (projects, offers, time entries)" className="mb-4" />
        {error && <div className="mb-3 rounded-ds bg-ds-danger px-3 py-2 text-sm text-ds-text-danger">{error}</div>}
        <Button type="submit" appearance="primary" shouldFitContainer disabled={busy}>
          {busy ? "Creating your workspace…" : "Sign up"}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-ds-text-subtlest">If a colleague already added your email to a workspace, you will find it after signing up.</p>
    </AuthCard>
  );
}
