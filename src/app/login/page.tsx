"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AuthCard, AuthField } from "@/components/layout/AuthCard";

/** useSearchParams needs a Suspense boundary for static prerendering of this page. */
export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Login failed");
      const next = params.get("next");
      window.location.assign(window.location.origin + (next && next.startsWith("/") ? next : "/for-you"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Log in to continue"
      footer={
        <>
          No account yet?{" "}
          <Link href="/register" className="text-ds-link hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={submit}>
        <AuthField label="Email">
          <input type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} className="ds-input" placeholder="you@company.com" />
        </AuthField>
        <AuthField label="Password">
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="ds-input" />
        </AuthField>
        {error && <div className="mb-3 rounded-ds bg-ds-danger px-3 py-2 text-sm text-ds-text-danger">{error}</div>}
        <Button type="submit" appearance="primary" shouldFitContainer disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-ds-text-subtlest">Sessions last 30 days on this browser.</p>
    </AuthCard>
  );
}
