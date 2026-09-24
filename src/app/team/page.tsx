"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";
import { useStore } from "@/lib/store";
import { AVATAR_COLORS, type UserRole } from "@/lib/types";
import { entryDuration, formatDurationShort, inRange, weekRange, hashColor } from "@/lib/utils";
import { Page } from "@/components/layout/AppShell";
import { PageHeader, InlineEdit } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Lozenge } from "@/components/ui/Lozenge";
import { RateCell, RateModal } from "@/components/rates/RateModal";
import { TimeOffSection } from "@/components/allocations/TimeOffSection";
import { allocatedPercent } from "@/lib/allocations";
import { useEffectiveEntries } from "@/hooks/useData";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", description: "Everything, including workspace settings" },
  { value: "pm", label: "Project manager", description: "Offers, orders, rates and budgets" },
  { value: "member", label: "Member", description: "Tracks time and works on items" },
];

export default function TeamPage() {
  const users = useStore((s) => s.users);
  const me = useStore((s) => s.currentUserId);
  const entries = useEffectiveEntries();
  const issues = useStore((s) => s.issues);
  const settings = useStore((s) => s.settings);
  const allocations = useStore((s) => s.allocations);
  const projects = useStore((s) => s.projects);
  const updateUser = useStore((s) => s.updateUser);
  const addUser = useStore((s) => s.addUser);
  const setUserCostRate = useStore((s) => s.setUserCostRate);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [rateUserId, setRateUserId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<UserRole>("member");
  const [rate, setRate] = React.useState("");
  const { start, end } = weekRange(new Date());
  const rateUser = users.find((u) => u.id === rateUserId);

  return (
    <>
      <PageHeader title="Team" actions={<Button appearance="primary" iconBefore={<UserPlus />} onClick={() => setInviteOpen(true)}>Invite member</Button>} />
      <Page>
        <p className="mt-2 text-sm text-ds-text-subtle">Cost rates value every tracked hour. Billing rates live on each project (Settings → Rates), with per-member overrides.</p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ds-text-subtle">
              <th className="border-b border-ds-border py-2 font-semibold">Member</th>
              <th className="border-b border-ds-border py-2 font-semibold">Role</th>
              <th className="border-b border-ds-border py-2 font-semibold">Cost rate</th>
              <th className="border-b border-ds-border py-2 font-semibold">Allocated</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Open work items</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">This week</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">All time</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const mine = entries.filter((e) => e.userId === u.id);
              const week = mine.filter((e) => inRange(e.start, start, end)).reduce((a, e) => a + entryDuration(e), 0);
              const all = mine.reduce((a, e) => a + entryDuration(e), 0);
              return (
                <tr key={u.id} className="hover:bg-ds-surface-hovered">
                  <td className="border-b border-ds-border py-2 pr-4">
                    <span className="flex items-center gap-3">
                      <Avatar user={u} size="md" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-medium">
                          <InlineEdit value={u.name} onSave={(v) => v && updateUser(u.id, { name: v })} className="-mx-1.5 inline-block px-1.5 py-0.5" />
                          {u.id === me && <Lozenge appearance="inprogress">You</Lozenge>}
                        </span>
                        <span className="block text-xs text-ds-text-subtlest">{u.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className="border-b border-ds-border py-2 pr-4">
                    <Select value={u.role} onChange={(v) => v && updateUser(u.id, { role: v as UserRole })} searchable={false} appearance="subtle" className="w-auto" options={ROLE_OPTIONS} />
                  </td>
                  <td className="border-b border-ds-border py-2 pr-4">
                    <RateCell periods={u.costRates} currency={settings.currency} onChange={() => setRateUserId(u.id)} />
                  </td>
                  <td className="border-b border-ds-border py-2 pr-4">
                    {(() => {
                      const mineAl = allocations.filter((a) => a.userId === u.id && projects.find((p) => p.id === a.projectId)?.timeMode === "allocation");
                      const pct = allocatedPercent(u.id, new Date(), mineAl);
                      if (!mineAl.length) return <span className="text-ds-text-subtlest">—</span>;
                      return (
                        <span className={pct > 100 ? "text-ds-text-danger" : ""}>
                          <span className="font-semibold">{pct}%</span>
                          <span className="block text-xs text-ds-text-subtlest">{mineAl.map((a) => `${projects.find((p) => p.id === a.projectId)?.key} ${a.percent}%`).join(" · ")}</span>
                        </span>
                      );
                    })()}
                  </td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right">{issues.filter((i) => i.assigneeId === u.id && i.status !== "done").length}</td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right">{formatDurationShort(week)}</td>
                  <td className="tabular-nums border-b border-ds-border py-2 text-right text-ds-text-subtle">{formatDurationShort(all)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <TimeOffSection />
      </Page>

      {rateUser && (
        <RateModal
          open
          onClose={() => setRateUserId(null)}
          title={`Cost rate · ${rateUser.name}`}
          subtitle="Used to value this member's hours on every project without a project-specific cost override."
          periods={rateUser.costRates}
          currency={settings.currency}
          affectedFrom={(from) => entries.filter((e) => e.userId === rateUser.id && e.start.slice(0, 10) >= from).length}
          onApply={(r, from) => setUserCostRate(rateUser.id, r, from)}
        />
      )}

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite member"
        width={460}
        footer={
          <>
            <Button appearance="subtle" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              appearance="primary"
              disabled={!name.trim() || !email.trim()}
              onClick={() => {
                addUser({ name: name.trim(), email: email.trim(), role, color: hashColor(email, AVATAR_COLORS), costRates: rate ? [{ from: "1970-01-01", rate: Number(rate) }] : [] });
                setInviteOpen(false);
                setName("");
                setEmail("");
                setRate("");
              }}
            >
              Invite
            </Button>
          </>
        }
      >
        <label className="mb-4 block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Name</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="ds-input" /></label>
        <label className="mb-4 block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="ds-input" /></label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Role</span><Select value={role} onChange={(v) => v && setRole(v as UserRole)} searchable={false} options={ROLE_OPTIONS} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Cost rate (/h)</span><input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} className="ds-input" placeholder="e.g. 50" /></label>
        </div>
      </Modal>
    </>
  );
}
