"use client";

import * as React from "react";
import { useStore } from "@/lib/store";
import { REGISTRATION_POLICIES, parseDomains, type RegistrationPolicy } from "@/lib/registration";
import { postJson } from "@/lib/passwords";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Avatar } from "@/components/ui/Avatar";
import { Lozenge } from "@/components/ui/Lozenge";

interface InstanceInfo {
  registration: RegistrationPolicy;
  domains: string[];
  owner: boolean;
  ownerEmail?: string;
  ownerName?: string;
}

/** Settings → Instance: registration policy and ownership, visible to the instance owner only */
export function InstanceSection() {
  const users = useStore((s) => s.users);
  const me = useStore((s) => s.currentUserId);
  const [info, setInfo] = React.useState<InstanceInfo | null>(null);
  const [registration, setRegistration] = React.useState<RegistrationPolicy>("open");
  const [domains, setDomains] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/instance", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: InstanceInfo | null) => {
        if (cancelled || !j) return;
        setInfo(j);
        setRegistration(j.registration);
        setDomains(j.domains.join(", "));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info?.owner) return null;
  const parsed = parseDomains(domains);
  const dirty = registration !== info.registration || parsed.join(",") !== info.domains.join(",");
  const linked = users.filter((u) => u.linked !== false && !u.deactivatedAt && u.id !== me);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await postJson<InstanceInfo>("/api/instance", { registration, domains: parsed });
      setInfo({ ...info, registration: res.registration, domains: res.domains });
      setDomains(res.domains.join(", "));
      setMessage({ ok: true, text: "Saved. New registrations follow this rule from now on." });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const transfer = async (memberId: string) => {
    const target = users.find((u) => u.id === memberId);
    if (!target || !confirm(`Hand the instance over to ${target.name}? You will no longer see this section.`)) return;
    try {
      await postJson("/api/instance", { ownerMemberId: memberId });
      setInfo({ ...info, owner: false });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <section>
      <h2 className="ds-heading-md mb-1 flex items-center gap-2">
        Instance <Lozenge appearance="new">Owner</Lozenge>
      </h2>
      <p className="mb-3 text-sm text-ds-text-subtle">Rules for the whole installation, every workspace included. Invited people (a member row with their email, or a welcome password) can always sign up or sign in.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={registration} onChange={(v) => v && setRegistration(v as RegistrationPolicy)} searchable={false} appearance="chip" chipLabel="Registration" options={REGISTRATION_POLICIES.map((p) => ({ value: p.id, label: p.name, description: p.description }))} menuClassName="w-80" />
        {registration === "domains" && (
          <input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="acme.com, client.com" className="ds-input h-8 w-80 py-1" aria-label="Allowed domains" />
        )}
        <Button appearance="primary" disabled={!dirty || busy || (registration === "domains" && parsed.length === 0)} onClick={() => void save()}>
          Save
        </Button>
        {message && <span className={message.ok ? "text-sm text-ds-text-success" : "text-sm text-ds-text-danger"}>{message.text}</span>}
      </div>
      {registration === "domains" && parsed.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-ds-text-subtlest">
          Allowed: {parsed.map((d) => <Lozenge key={d}>@{d}</Lozenge>)}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ds-text-subtle">Owner: {info.ownerName ?? "you"}{info.ownerEmail ? ` (${info.ownerEmail})` : ""}.</span>
        <Select
          value={null}
          onChange={(v) => v && void transfer(v)}
          appearance="chip"
          chipLabel="Hand over to"
          placeholder="Hand over to"
          isDisabled={linked.length === 0}
          options={linked.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size="xs" />, description: u.email }))}
          menuClassName="w-72"
        />
        <span className="text-xs text-ds-text-subtlest">Members of this workspace with an account. The server variable INSTANCE_OWNER_EMAIL can also claim ownership.</span>
      </div>
    </section>
  );
}
