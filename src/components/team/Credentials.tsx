"use client";

import * as React from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { generatePassword } from "@/lib/passwords";
import { Button } from "@/components/ui/Button";
import { SectionMessage } from "@/components/ui/misc";

/** Password field with a generator, for invitations and resets */
export function PasswordField({ value, onChange, label = "Password", hint, autoFocus }: { value: string; onChange: (v: string) => void; label?: string; hint?: string; autoFocus?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ds-text-subtle">{label}</span>
      <span className="flex items-center gap-2">
        <input value={value} onChange={(e) => onChange(e.target.value)} className="ds-input font-mono" autoComplete="new-password" autoFocus={autoFocus} placeholder="At least 8 characters" />
        <Button appearance="default" iconBefore={<RefreshCw />} onClick={() => onChange(generatePassword())} className="shrink-0">
          Generate
        </Button>
      </span>
      {hint && <span className="mt-1 block text-xs text-ds-text-subtlest">{hint}</span>}
    </label>
  );
}

/** Credentials shown once after they are issued, with copy buttons */
export function IssuedCredentials({ name, email, password, created }: { name: string; email: string; password: string; created: boolean }) {
  return (
    <SectionMessage appearance="success" title={created ? `${name} can sign in now` : `Password of ${name} replaced`}>
      <p className="mb-2">Share these credentials privately. They are shown only now; {name.split(" ")[0]} can change the password from Settings.</p>
      <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
        <dt className="text-xs font-semibold text-ds-text-subtle">Email</dt>
        <dd className="font-mono">{email}</dd>
        <dd><CopyButton text={email} /></dd>
        <dt className="text-xs font-semibold text-ds-text-subtle">Password</dt>
        <dd className="font-mono">{password}</dd>
        <dd><CopyButton text={password} /></dd>
      </dl>
    </SectionMessage>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <Button
      appearance="subtle"
      spacing="compact"
      iconBefore={done ? <Check /> : <Copy />}
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copied" : "Copy"}
    </Button>
  );
}
