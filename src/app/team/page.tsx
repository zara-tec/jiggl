"use client";

import * as React from "react";
import { KeyRound, MoreHorizontal, UserPlus } from "lucide-react";
import { useStore } from "@/lib/store";
import { AVATAR_COLORS, type User, type UserRole } from "@/lib/types";
import { entryDuration, formatDurationShort, inRange, weekRange, hashColor } from "@/lib/utils";
import { MIN_PASSWORD_LENGTH, postJson } from "@/lib/passwords";
import { inTeam, isTeamOpen } from "@/lib/team";
import { allocatedPercent } from "@/lib/allocations";
import { useEffectiveEntries } from "@/hooks/useData";
import { Page } from "@/components/layout/AppShell";
import { PageHeader, InlineEdit } from "@/components/ui/misc";
import { Button, IconButton } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Lozenge } from "@/components/ui/Lozenge";
import { DropdownMenu, MenuItem } from "@/components/ui/Popover";
import { RateCell, RateModal } from "@/components/rates/RateModal";
import { TimeOffSection } from "@/components/allocations/TimeOffSection";
import { IssuedCredentials, PasswordField } from "@/components/team/Credentials";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", description: "Everything, including workspace settings and passwords" },
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
  const setUserCostRate = useStore((s) => s.setUserCostRate);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [rateUserId, setRateUserId] = React.useState<string | null>(null);
  const [passwordUser, setPasswordUser] = React.useState<User | null>(null);
  const { start, end } = weekRange(new Date());
  const rateUser = users.find((u) => u.id === rateUserId);
  const isAdmin = users.find((u) => u.id === me)?.role === "admin";
  const explicitProjects = projects.filter((p) => !isTeamOpen(p));

  return (
    <>
      <PageHeader title="Team" actions={<Button appearance="primary" iconBefore={<UserPlus />} onClick={() => setInviteOpen(true)}>Invite member</Button>} />
      <Page>
        <p className="mt-2 text-sm text-ds-text-subtle">
          Cost rates value every tracked hour. Billing rates live on each project (Settings → Rates), with per-member overrides.
          {isAdmin ? " As an admin you can give new members a welcome password and reset a forgotten one." : ""}
        </p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ds-text-subtle">
              <th className="border-b border-ds-border py-2 font-semibold">Member</th>
              <th className="border-b border-ds-border py-2 font-semibold">Role</th>
              <th className="border-b border-ds-border py-2 font-semibold">Cost rate</th>
              <th className="border-b border-ds-border py-2 font-semibold">Projects</th>
              <th className="border-b border-ds-border py-2 font-semibold">Allocated</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">Open work items</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">This week</th>
              <th className="border-b border-ds-border py-2 text-right font-semibold">All time</th>
              {isAdmin && <th className="w-8 border-b border-ds-border py-2" />}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const mine = entries.filter((e) => e.userId === u.id);
              const week = mine.filter((e) => inRange(e.start, start, end)).reduce((a, e) => a + entryDuration(e), 0);
              const all = mine.reduce((a, e) => a + entryDuration(e), 0);
              const teams = explicitProjects.filter((p) => inTeam(p, u.id));
              return (
                <tr key={u.id} className="hover:bg-ds-surface-hovered">
                  <td className="border-b border-ds-border py-2 pr-4">
                    <span className="flex items-center gap-3">
                      <Avatar user={u} size="md" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-medium">
                          <InlineEdit value={u.name} onSave={(v) => v && updateUser(u.id, { name: v })} className="-mx-1.5 inline-block px-1.5 py-0.5" />
                          {u.id === me && <Lozenge appearance="inprogress">You</Lozenge>}
                          {u.linked === false && <Lozenge appearance="moved" maxWidth={120}>No account</Lozenge>}
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
                    {teams.length ? (
                      <span className="flex flex-wrap gap-1">
                        {teams.map((p) => (
                          <Lozenge key={p.id} appearance={p.leadId === u.id ? "inprogress" : "default"}>{p.key}</Lozenge>
                        ))}
                      </span>
                    ) : (
                      <span className="text-xs text-ds-text-subtlest">{explicitProjects.length ? "Open projects only" : "—"}</span>
                    )}
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
                  {isAdmin && (
                    <td className="border-b border-ds-border py-1 text-center">
                      {u.id !== me && (
                        <DropdownMenu align="end" trigger={({ ref, toggle }) => <IconButton ref={ref} icon={<MoreHorizontal />} label={`Actions for ${u.name}`} spacing="compact" onClick={toggle} />}>
                          {({ close }) => (
                            <MenuItem icon={<KeyRound />} onClick={() => { setPasswordUser(u); close(); }} description={u.linked === false ? "Creates the account so they can sign in" : "Replaces the current password"}>
                              {u.linked === false ? "Set a password" : "Reset password"}
                            </MenuItem>
                          )}
                        </DropdownMenu>
                      )}
                    </td>
                  )}
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

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} isAdmin={isAdmin} />
      {passwordUser && <ResetPasswordModal user={passwordUser} onClose={() => setPasswordUser(null)} />}
    </>
  );
}

function InviteModal({ open, onClose, isAdmin }: { open: boolean; onClose: () => void; isAdmin: boolean }) {
  const addUser = useStore((s) => s.addUser);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<UserRole>("member");
  const [rate, setRate] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [issued, setIssued] = React.useState<{ name: string; email: string; password: string; created: boolean } | null>(null);
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpen.current) {
      setName("");
      setEmail("");
      setRole("member");
      setRate("");
      setPassword("");
      setError(null);
      setIssued(null);
    }
    wasOpen.current = open;
  }, [open]);
  const valid = name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && (!password || password.length >= MIN_PASSWORD_LENGTH);

  const invite = async () => {
    const input = { name: name.trim(), email: email.trim().toLowerCase(), role, color: hashColor(email.trim().toLowerCase(), AVATAR_COLORS), costRates: rate ? [{ from: "1970-01-01", rate: Number(rate) }] : [] };
    if (!isAdmin) {
      addUser(input);
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<{ id: string; linked: boolean; accountCreated: boolean }>("/api/workspace/members", { ...input, password: password || undefined });
      addUser({ ...input, id: res.id, linked: res.linked });
      if (password) setIssued({ name: input.name, email: input.email, password, created: res.accountCreated });
      else onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={issued ? "Member invited" : "Invite member"}
      width={520}
      footer={
        issued ? (
          <Button appearance="primary" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button appearance="subtle" onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={!valid || busy} onClick={() => void invite()}>
              {busy ? "Inviting…" : "Invite"}
            </Button>
          </>
        )
      }
    >
      {issued ? (
        <IssuedCredentials name={issued.name} email={issued.email} password={issued.password} created={issued.created} />
      ) : (
        <>
          <label className="mb-4 block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Name</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="ds-input" /></label>
          <label className="mb-4 block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="ds-input" /></label>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Role</span><Select value={role} onChange={(v) => v && setRole(v as UserRole)} searchable={false} options={ROLE_OPTIONS} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-ds-text-subtle">Cost rate (/h)</span><input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))} className="ds-input" placeholder="e.g. 50" /></label>
          </div>
          {isAdmin ? (
            <PasswordField value={password} onChange={setPassword} label="Welcome password (optional)" hint="With a password the account is created now and the person can sign in right away. Without it, they register themselves with this email and land in this workspace." />
          ) : (
            <p className="text-xs text-ds-text-subtlest">The person registers with this email and lands in this workspace. Admins can also issue a welcome password.</p>
          )}
          {error && <p className="mt-3 text-sm text-ds-text-danger">{error}</p>}
        </>
      )}
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }: { user: User; onClose: () => void }) {
  const updateUser = useStore((s) => s.updateUser);
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [issued, setIssued] = React.useState<{ password: string; created: boolean } | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<{ accountCreated: boolean }>("/api/workspace/members/password", { memberId: user.id, password });
      updateUser(user.id, { linked: true });
      setIssued({ password, created: res.accountCreated });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Password · ${user.name}`}
      width={520}
      footer={
        issued ? (
          <Button appearance="primary" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button appearance="subtle" onClick={onClose}>Cancel</Button>
            <Button appearance="primary" disabled={password.length < MIN_PASSWORD_LENGTH || busy} onClick={() => void submit()}>
              {busy ? "Saving…" : user.linked === false ? "Create account" : "Set password"}
            </Button>
          </>
        )
      }
    >
      {issued ? (
        <IssuedCredentials name={user.name} email={user.email} password={issued.password} created={issued.created} />
      ) : (
        <>
          <p className="mb-4 text-sm text-ds-text-subtle">
            {user.linked === false ? `${user.name} has no account yet: this creates one with the password below.` : `Replaces the current password of ${user.name}. Their sessions stay open until they sign out.`}
          </p>
          <PasswordField value={password} onChange={setPassword} label="New password" autoFocus />
          {error && <p className="mt-3 text-sm text-ds-text-danger">{error}</p>}
        </>
      )}
    </Modal>
  );
}
